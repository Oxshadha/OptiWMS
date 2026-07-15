ALTER TABLE materials
    ALTER COLUMN data_quality_tier SET DEFAULT 'OPERATIONAL_ENTRY';

ALTER TABLE inventory
    ALTER COLUMN data_quality_tier SET DEFAULT 'OPERATIONAL_ENTRY';

CREATE INDEX IF NOT EXISTS idx_materials_operational_scope
    ON materials (data_quality_tier, material_type, material_code);

CREATE INDEX IF NOT EXISTS idx_inventory_operational_scope
    ON inventory (data_quality_tier, warehouse_id, material_type, status);
