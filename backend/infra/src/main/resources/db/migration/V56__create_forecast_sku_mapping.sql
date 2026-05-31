-- Explicit forecast SKU -> WMS material mapping for enterprise forecast governance.
-- This replaces heuristic namespace conversion during shadow/evaluation joins.

CREATE TABLE IF NOT EXISTS forecast_sku_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset VARCHAR(32) NULL,
    forecast_sku VARCHAR(64) NOT NULL,
    wms_material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    warehouse_id UUID NULL REFERENCES warehouses(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_forecast_sku_not_blank CHECK (length(trim(forecast_sku)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_forecast_sku_mapping_scope
    ON forecast_sku_mapping (
        COALESCE(dataset, ''),
        lower(trim(forecast_sku)),
        COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

CREATE INDEX IF NOT EXISTS idx_forecast_sku_mapping_material
    ON forecast_sku_mapping(wms_material_id);

CREATE INDEX IF NOT EXISTS idx_forecast_sku_mapping_active
    ON forecast_sku_mapping(is_active);
