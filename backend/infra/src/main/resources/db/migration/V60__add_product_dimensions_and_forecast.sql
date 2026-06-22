-- V60: Add product dimensions, forecast, and classification columns to materials table

ALTER TABLE materials ADD COLUMN IF NOT EXISTS material_type VARCHAR(10);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS category VARCHAR(64);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS length_cm NUMERIC(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS width_cm NUMERIC(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS height_cm NUMERIC(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS units_per_pallet INTEGER;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS hazard_class VARCHAR(20);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS abc_class VARCHAR(1);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS fms_class VARCHAR(10);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_p50 NUMERIC(14,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_p10 NUMERIC(14,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_p90 NUMERIC(14,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_materials_material_type ON materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_storage_type ON materials(storage_type);
CREATE INDEX IF NOT EXISTS idx_materials_abc_class ON materials(abc_class);
CREATE INDEX IF NOT EXISTS idx_materials_fms_class ON materials(fms_class);

COMMENT ON COLUMN materials.storage_type IS 'How this material is stored: PALLET, DRUM, CARTON, BAG, IBC, ROLL, REEL';
COMMENT ON COLUMN materials.abc_class IS 'ABC classification by value: A (top 80%), B (next 15%), C (bottom 5%)';
COMMENT ON COLUMN materials.fms_class IS 'Movement frequency: Fast, Medium, Slow';
COMMENT ON COLUMN materials.forecast_p50 IS 'Median (p50) demand forecast for next period';
COMMENT ON COLUMN materials.forecast_p10 IS '10th percentile demand forecast (downside)';
COMMENT ON COLUMN materials.forecast_p90 IS '90th percentile demand forecast (upside / safety stock basis)';
