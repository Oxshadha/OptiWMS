-- OptiWMS Finalized Database Schema
-- Version 4: Complete Schema with AI Support (Optional) and International Support
-- Core WMS works independently, AI fields are optional enhancements

-- ============================================
-- ENHANCE EXISTING TABLES
-- ============================================

-- Enhance Materials Table (Add Material Planning Fields and Type)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS material_type VARCHAR(20) DEFAULT 'raw_material';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sku_id VARCHAR(50);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS reorder_method VARCHAR(20) DEFAULT 'STATIC';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS static_min_stock DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS ai_min_stock DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS unit_cost_standard DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS storage_location_type VARCHAR(20) DEFAULT 'warehouse';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS third_party_location VARCHAR(200);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS requires_pallet BOOLEAN DEFAULT TRUE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS buffer_days INTEGER;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS future_average DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS lead_time_months DECIMAL(5,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS expected_value DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS variance_demand DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS variance_lead_time_demand DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS rop_days DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS order_delivery_days INTEGER;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS order_quantity DECIMAL(15,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS pallet_requirement DECIMAL(15,2);

CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_sku ON materials(sku_id) WHERE sku_id IS NOT NULL;

-- Enhance Suppliers Table (International Support)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country_code VARCHAR(3);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'LKR';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS risk_category VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ai_rating_score DECIMAL(3,2);

CREATE INDEX IF NOT EXISTS idx_suppliers_country ON suppliers(country);
CREATE INDEX IF NOT EXISTS idx_suppliers_risk ON suppliers(risk_category);

-- Enhance Customers Table (International Support)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country_code VARCHAR(3);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'LKR';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS priority_tier VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(15,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_customers_country ON customers(country);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(priority_tier);

-- Enhance Delivery Partners Table (International Courier Support)
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS country_code VARCHAR(3);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'LKR';
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS carrier_type VARCHAR(20);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS international_coverage TEXT[];
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_delivery_partners_country ON delivery_partners(country);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_type ON delivery_partners(carrier_type);

-- Enhance Inventory Table (Add Batch/Expiry and AI Fields)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS grn_id UUID;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_movement_date DATE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS days_since_last_movement INTEGER;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS ai_suggested_location_code VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(5,4);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS ai_last_updated TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory(batch_number) WHERE batch_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_movement ON inventory(last_movement_date);

-- Enhance Locations Table (Add Zone and Storage Conditions)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS zone_type VARCHAR(20);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(20);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS x_coord DECIMAL(10,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS y_coord DECIMAL(10,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS z_coord DECIMAL(10,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS max_weight_kg DECIMAL(15,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ai_optimal_for_material_types TEXT[];
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ai_velocity_score DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS idx_locations_zone ON locations(zone_type) WHERE zone_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_condition ON locations(storage_condition) WHERE storage_condition IS NOT NULL;

-- Enhance Orders Table (Add AI Fields)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ai_suggested_priority_score INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ai_suggested_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(5,4);

CREATE INDEX IF NOT EXISTS idx_orders_ai_priority ON orders(ai_suggested_priority_score) WHERE ai_suggested_priority_score IS NOT NULL;

-- Enhance Tasks Table (Add AI Pathfinding Fields)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_suggested_sequence_order INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_suggested_path JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_path_efficiency_score DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS idx_tasks_ai_sequence ON tasks(ai_suggested_sequence_order) WHERE ai_suggested_sequence_order IS NOT NULL;

-- ============================================
-- NEW TABLES FOR MATERIAL PLANNING
-- ============================================

-- Supply Plans (Monthly Supply Planning Data)
CREATE TABLE IF NOT EXISTS supply_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    plan_year INTEGER NOT NULL,
    plan_month INTEGER NOT NULL CHECK (plan_month BETWEEN 1 AND 12),
    planned_quantity DECIMAL(15,2) NOT NULL,
    actual_quantity DECIMAL(15,2),
    variance DECIMAL(15,2), -- actual - planned
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(material_id, warehouse_id, plan_year, plan_month)
);

CREATE INDEX idx_supply_plans_material ON supply_plans(material_id);
CREATE INDEX idx_supply_plans_warehouse ON supply_plans(warehouse_id);
CREATE INDEX idx_supply_plans_date ON supply_plans(plan_year, plan_month);

-- Material Planning Summary (Denormalized for performance)
CREATE TABLE IF NOT EXISTS material_planning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    buffer_days INTEGER,
    future_average DECIMAL(15,2),
    lead_time_days INTEGER,
    lead_time_months DECIMAL(5,2),
    expected_value DECIMAL(15,2),
    variance_demand DECIMAL(15,2),
    variance_lead_time_demand DECIMAL(15,2),
    rop_days DECIMAL(10,2),
    order_delivery_days INTEGER,
    order_quantity DECIMAL(15,2),
    pallet_requirement DECIMAL(15,2),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(material_id, warehouse_id)
);

CREATE INDEX idx_material_planning_material ON material_planning(material_id);
CREATE INDEX idx_material_planning_warehouse ON material_planning(warehouse_id);

-- ============================================
-- AI SERVICE TABLES (Optional - Core WMS works without these)
-- ============================================

-- AI Demand Forecasts
CREATE TABLE IF NOT EXISTS ai_demand_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL, -- The future date being predicted
    predicted_quantity DECIMAL(15,2) NOT NULL,
    confidence_score DECIMAL(5,4) CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    model_version VARCHAR(50), -- Version of AI model used
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(material_id, warehouse_id, forecast_date)
);

CREATE INDEX idx_ai_forecasts_material ON ai_demand_forecasts(material_id);
CREATE INDEX idx_ai_forecasts_warehouse ON ai_demand_forecasts(warehouse_id);
CREATE INDEX idx_ai_forecasts_date ON ai_demand_forecasts(forecast_date);

-- AI Sourcing Recommendations
CREATE TABLE IF NOT EXISTS ai_sourcing_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    trigger_event VARCHAR(50), -- LOW_STOCK, DEMAND_SPIKE, LEAD_TIME_RISK
    recommended_action VARCHAR(50), -- PURCHASE, TRANSFER, WAIT
    recommended_quantity DECIMAL(15,2),
    recommended_supplier_id UUID REFERENCES suppliers(id),
    calculated_roi DECIMAL(10,2),
    space_freed_via_ga DECIMAL(15,2), -- Space optimized via Genetic Algorithms
    llm_justification TEXT, -- Natural language explanation from LLM
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, IGNORED, EXECUTED
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_sourcing_material ON ai_sourcing_recommendations(material_id);
CREATE INDEX idx_ai_sourcing_status ON ai_sourcing_recommendations(status);
CREATE INDEX idx_ai_sourcing_trigger ON ai_sourcing_recommendations(trigger_event);

-- AI Storage Slotting Recommendations (GA-based)
CREATE TABLE IF NOT EXISTS ai_slotting_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    recommended_location_code VARCHAR(50),
    recommended_location_id UUID REFERENCES locations(id),
    ga_fitness_score DECIMAL(10,4), -- Genetic Algorithm fitness score
    space_utilization_improvement DECIMAL(5,2), -- Percentage improvement
    velocity_score DECIMAL(5,2), -- Material velocity score
    compatibility_score DECIMAL(5,2), -- Compatibility with nearby materials
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPLIED, REJECTED
    created_at TIMESTAMP DEFAULT NOW(),
    applied_at TIMESTAMP
);

CREATE INDEX idx_ai_slotting_material ON ai_slotting_recommendations(material_id);
CREATE INDEX idx_ai_slotting_status ON ai_slotting_recommendations(status);

-- AI Path Recommendations (Optimal Picking/Putaway Paths)
CREATE TABLE IF NOT EXISTS ai_path_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    task_type VARCHAR(50), -- picking, putaway
    recommended_path JSONB NOT NULL, -- Array of location coordinates
    estimated_time_minutes DECIMAL(10,2),
    estimated_distance_meters DECIMAL(10,2),
    efficiency_score DECIMAL(5,2), -- Path efficiency score
    algorithm_used VARCHAR(50), -- A_STAR, GENETIC_ALGORITHM, etc.
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPLIED, REJECTED
    created_at TIMESTAMP DEFAULT NOW(),
    applied_at TIMESTAMP
);

CREATE INDEX idx_ai_path_task ON ai_path_recommendations(task_id);
CREATE INDEX idx_ai_path_type ON ai_path_recommendations(task_type);
CREATE INDEX idx_ai_path_status ON ai_path_recommendations(status);

-- AI Anomaly Detections
CREATE TABLE IF NOT EXISTS ai_anomaly_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anomaly_type VARCHAR(50) NOT NULL, -- INVENTORY_VARIANCE, DEMAND_SPIKE, MOVEMENT_PATTERN, etc.
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    location_id UUID REFERENCES locations(id),
    detected_value DECIMAL(15,2), -- The anomalous value detected
    expected_value DECIMAL(15,2), -- Expected normal value
    variance_percentage DECIMAL(10,4), -- Percentage variance
    severity VARCHAR(20), -- LOW, MEDIUM, HIGH, CRITICAL
    confidence_score DECIMAL(5,4) CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    description TEXT,
    status VARCHAR(20) DEFAULT 'DETECTED', -- DETECTED, REVIEWED, RESOLVED, FALSE_POSITIVE
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_anomalies_type ON ai_anomaly_detections(anomaly_type);
CREATE INDEX idx_ai_anomalies_material ON ai_anomaly_detections(material_id);
CREATE INDEX idx_ai_anomalies_status ON ai_anomaly_detections(status);
CREATE INDEX idx_ai_anomalies_severity ON ai_anomaly_detections(severity);

-- ============================================
-- SUPPLIER-PRODUCT LINK (Many-to-Many)
-- ============================================

CREATE TABLE IF NOT EXISTS supplier_product_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    moq DECIMAL(15,2), -- Minimum Order Quantity
    lead_time_days INTEGER,
    unit_price DECIMAL(15,2),
    currency_code VARCHAR(3) DEFAULT 'LKR',
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(supplier_id, material_id)
);

CREATE INDEX idx_supplier_links_supplier ON supplier_product_links(supplier_id);
CREATE INDEX idx_supplier_links_material ON supplier_product_links(material_id);

-- ============================================
-- GRN (Goods Received Note) - For Traceability
-- ============================================

CREATE TABLE IF NOT EXISTS grns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    po_id UUID, -- Will reference purchase_orders when created
    supplier_id UUID REFERENCES suppliers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    received_date TIMESTAMP NOT NULL,
    received_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'PENDING_QA', -- PENDING_QA, COMPLETED, REJECTED
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_grns_number ON grns(grn_number);
CREATE INDEX idx_grns_supplier ON grns(supplier_id);
CREATE INDEX idx_grns_warehouse ON grns(warehouse_id);
CREATE INDEX idx_grns_status ON grns(status);

-- Quality Check Log
CREATE TABLE IF NOT EXISTS quality_check_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_id UUID REFERENCES grns(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id),
    qty_received DECIMAL(15,2) NOT NULL,
    qty_passed DECIMAL(15,2) NOT NULL,
    qty_rejected DECIMAL(15,2) NOT NULL,
    rejection_reason TEXT,
    checked_by UUID REFERENCES users(id),
    check_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_qc_grn ON quality_check_logs(grn_id);
CREATE INDEX idx_qc_material ON quality_check_logs(material_id);

-- ============================================
-- UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================

-- Update inventory to reference GRN (only if constraint doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_inventory_grn'
    ) THEN
        ALTER TABLE inventory 
            ADD CONSTRAINT fk_inventory_grn 
            FOREIGN KEY (grn_id) REFERENCES grns(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_supply_plans_updated_at BEFORE UPDATE ON supply_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_planning_updated_at BEFORE UPDATE ON material_planning
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_sourcing_updated_at BEFORE UPDATE ON ai_sourcing_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grns_updated_at BEFORE UPDATE ON grns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE ai_demand_forecasts IS 'AI service table - Optional. Core WMS works without this.';
COMMENT ON TABLE ai_sourcing_recommendations IS 'AI service table - Optional. Core WMS works without this.';
COMMENT ON TABLE ai_slotting_recommendations IS 'AI service table - Optional. Core WMS works without this.';
COMMENT ON TABLE ai_path_recommendations IS 'AI service table - Optional. Core WMS works without this.';
COMMENT ON TABLE ai_anomaly_detections IS 'AI service table - Optional. Core WMS works without this.';

COMMENT ON COLUMN materials.ai_min_stock IS 'AI-suggested minimum stock. NULL if AI not used. Core WMS uses static_min_stock.';
COMMENT ON COLUMN inventory.ai_suggested_location_code IS 'AI-suggested location. NULL if AI not used. Core WMS uses manual assignment.';
COMMENT ON COLUMN orders.ai_suggested_priority_score IS 'AI-suggested priority. NULL if AI not used. Core WMS uses manual priority.';
COMMENT ON COLUMN tasks.ai_suggested_sequence_order IS 'AI-suggested sequence. NULL if AI not used. Core WMS uses manual sequence.';

