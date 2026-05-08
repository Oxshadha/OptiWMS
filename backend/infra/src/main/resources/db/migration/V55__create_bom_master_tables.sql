-- WMS BOM master tables for enterprise demand planning

CREATE TABLE IF NOT EXISTS bom_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    warehouse_id UUID NULL REFERENCES warehouses(id) ON DELETE SET NULL,
    version VARCHAR(64) NOT NULL DEFAULT 'v1',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    effective_from DATE NULL,
    effective_to DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bom_header_status CHECK (status IN ('active', 'inactive', 'draft', 'retired')),
    CONSTRAINT chk_bom_header_effective_range CHECK (
        effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bom_headers_parent_wh_version
    ON bom_headers(parent_material_id, COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid), version);

CREATE INDEX IF NOT EXISTS idx_bom_headers_parent_material_id ON bom_headers(parent_material_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_warehouse_id ON bom_headers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_status ON bom_headers(status);
CREATE INDEX IF NOT EXISTS idx_bom_headers_effective_from ON bom_headers(effective_from);

CREATE TABLE IF NOT EXISTS bom_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_header_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
    component_material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    component_type VARCHAR(32) NOT NULL,
    qty_per_parent NUMERIC(18,6) NOT NULL,
    scrap_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
    lead_time_days INTEGER NULL,
    uom VARCHAR(32) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bom_component_qty_positive CHECK (qty_per_parent > 0),
    CONSTRAINT chk_bom_component_scrap_nonnegative CHECK (scrap_rate >= 0),
    CONSTRAINT chk_bom_component_lead_time_nonnegative CHECK (lead_time_days IS NULL OR lead_time_days >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bom_components_header_component
    ON bom_components(bom_header_id, component_material_id);

CREATE INDEX IF NOT EXISTS idx_bom_components_header_id ON bom_components(bom_header_id);
CREATE INDEX IF NOT EXISTS idx_bom_components_component_material_id ON bom_components(component_material_id);
CREATE INDEX IF NOT EXISTS idx_bom_components_component_type ON bom_components(component_type);

CREATE TABLE IF NOT EXISTS bom_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(16) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NULL,
    actor VARCHAR(128) NULL,
    payload_json TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bom_audit_action CHECK (action IN ('create', 'update', 'delete', 'bulk_upsert'))
);

CREATE INDEX IF NOT EXISTS idx_bom_audit_created_at ON bom_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_bom_audit_entity_type ON bom_audit_log(entity_type);

