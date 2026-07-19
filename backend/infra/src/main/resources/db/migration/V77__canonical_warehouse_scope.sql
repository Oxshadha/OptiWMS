ALTER TABLE warehouses
    ALTER COLUMN dataset_version SET DEFAULT 'OPERATIONAL_ENTRY';

CREATE INDEX IF NOT EXISTS idx_warehouses_dataset_version
    ON warehouses (dataset_version, status, code);

CREATE INDEX IF NOT EXISTS idx_inventory_operational_material
    ON inventory (warehouse_id, material_id, data_quality_tier);
