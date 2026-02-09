-- V15: Add SOP Enhancement Features
-- 1. Weight limits for materials
-- 2. Re-count workflow for cycle counts
-- 3. Quarterly cycle count scheduler

-- =============================================
-- 1. WEIGHT LIMITS (for receiving validation)
-- =============================================

-- Add weight limit fields to materials (optional, backward compatible)
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS max_pallet_weight_kg DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS min_order_quantity DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS safety_stock_level DECIMAL(15,2);

-- Set default weight limits based on material type
-- Raw materials: 1500kg, Packing materials: 1000kg (as per SOP)
UPDATE materials
SET max_pallet_weight_kg = CASE
    WHEN material_type = 'raw_material' THEN 1500.0
    WHEN material_type = 'packing_material' THEN 1000.0
    ELSE NULL -- No limit for other types
END
WHERE max_pallet_weight_kg IS NULL;

-- =============================================
-- 2. RE-COUNT WORKFLOW (for cycle counts)
-- =============================================

-- Add recount fields to cycle_counts table
ALTER TABLE cycle_counts
    ADD COLUMN IF NOT EXISTS recount_required BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS recount_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS previous_variance DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS variance_threshold DECIMAL(15,2) DEFAULT 5.0,
    ADD COLUMN IF NOT EXISTS final_variance DECIMAL(15,2);

-- Create recount history table (tracks each recount attempt)
CREATE TABLE IF NOT EXISTS cycle_count_recounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
    recount_number INTEGER NOT NULL,
    counted_quantity DECIMAL(15,2) NOT NULL,
    variance DECIMAL(15,2) NOT NULL,
    counted_by UUID REFERENCES users(id),
    notes TEXT,
    counted_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_cycle_count_recount UNIQUE (cycle_count_id, recount_number)
);

CREATE INDEX IF NOT EXISTS idx_cycle_count_recounts_cycle_count_id
    ON cycle_count_recounts(cycle_count_id);

-- =============================================
-- 3. QUARTERLY CYCLE COUNT SCHEDULER
-- =============================================

-- Create cycle count schedule configuration table
CREATE TABLE IF NOT EXISTS cycle_count_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL DEFAULT 'quarterly', -- quarterly, monthly, weekly, custom
    interval_days INTEGER, -- For custom frequency
    next_scheduled_date DATE NOT NULL,
    location_pattern VARCHAR(100), -- NULL = all locations, 'A%' = zone A, etc.
    auto_create BOOLEAN DEFAULT true,
    auto_assign_workers BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cycle_count_schedules_warehouse_id
    ON cycle_count_schedules(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_cycle_count_schedules_next_date
    ON cycle_count_schedules(next_scheduled_date)
    WHERE active = true AND auto_create = true;

-- Create default quarterly schedules for existing warehouses
INSERT INTO cycle_count_schedules (warehouse_id, frequency, next_scheduled_date, location_pattern, auto_create)
SELECT
    id,
    'quarterly',
    CURRENT_DATE + INTERVAL '7 days', -- Start 7 days from now
    NULL, -- All locations
    false -- Disabled by default (admin must enable)
FROM warehouses
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. AUDIT & TRACKING ENHANCEMENTS
-- =============================================

-- Note: Weight validation tracking is implemented at the service layer
-- No dedicated receiving table exists - receiving is tracked via orders/inbound operations

-- =============================================
-- Comments for clarity
-- =============================================

COMMENT ON COLUMN materials.max_pallet_weight_kg IS 'Maximum weight per pallet (kg) - enforced during receiving';
COMMENT ON COLUMN cycle_counts.recount_required IS 'True if variance exceeds threshold and recount is needed';
COMMENT ON COLUMN cycle_counts.recount_count IS 'Number of recounts performed (max 2)';
COMMENT ON COLUMN cycle_counts.variance_threshold IS 'Variance threshold (units) that triggers recount requirement';
COMMENT ON TABLE cycle_count_recounts IS 'History of recount attempts for cycle counts';
COMMENT ON TABLE cycle_count_schedules IS 'Automated cycle count scheduling configuration';
COMMENT ON COLUMN cycle_count_schedules.frequency IS 'quarterly, monthly, weekly, or custom';
COMMENT ON COLUMN cycle_count_schedules.location_pattern IS 'SQL LIKE pattern for location codes (NULL = all)';
