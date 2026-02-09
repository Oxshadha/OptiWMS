-- V28: Add ABC/FMS Classification Fields to Materials
-- Supports rule-based storage assignment (works without AI)
-- AI service can update these fields later for optimal suggestions

-- ABC Classification (Volume-based)
-- A = High Volume (~80% of volume, 7-25% of SKUs)
-- B = Medium Volume (~10% of volume)
-- C = Low Volume (~10% of volume, 50-80% of SKUs)

-- FMS Classification (Frequency-based)
-- F = Fast Moving (high frequency of issues)
-- M = Medium Moving
-- S = Slow Moving

-- Preferred Zone (derived from Amalgamated Analysis)
-- A = AF, AM, BF (critical/high-turn) → front, ground level
-- B = BM, AS, CF (medium priority) → middle racks
-- C = BS, CM (low priority) → back, middle/upper
-- D = CS (slow movers) → back, upper levels

ALTER TABLE materials ADD COLUMN IF NOT EXISTS abc_class VARCHAR(1);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS fms_class VARCHAR(1);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS preferred_zone VARCHAR(1);

-- Add constraints for valid values
ALTER TABLE materials ADD CONSTRAINT chk_abc_class 
    CHECK (abc_class IS NULL OR abc_class IN ('A', 'B', 'C'));
ALTER TABLE materials ADD CONSTRAINT chk_fms_class 
    CHECK (fms_class IS NULL OR fms_class IN ('F', 'M', 'S'));
ALTER TABLE materials ADD CONSTRAINT chk_preferred_zone 
    CHECK (preferred_zone IS NULL OR preferred_zone IN ('A', 'B', 'C', 'D'));

-- Index for zone-based queries
CREATE INDEX IF NOT EXISTS idx_materials_preferred_zone ON materials(preferred_zone);
CREATE INDEX IF NOT EXISTS idx_materials_abc_fms ON materials(abc_class, fms_class);

-- Comments
COMMENT ON COLUMN materials.abc_class IS 'ABC Classification: A=High Volume, B=Medium, C=Low';
COMMENT ON COLUMN materials.fms_class IS 'FMS Classification: F=Fast Moving, M=Medium, S=Slow';
COMMENT ON COLUMN materials.preferred_zone IS 'Preferred storage zone based on ABC/FMS amalgamation';
