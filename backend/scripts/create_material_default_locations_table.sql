-- Manual SQL script to create material_default_locations table
-- Run this if migration V25 doesn't work
-- Connect: psql -h localhost -p 5434 -U optiwms -d optiwms

CREATE TABLE IF NOT EXISTS material_default_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    location_code VARCHAR(50) NOT NULL REFERENCES locations(location_code),
    priority INTEGER DEFAULT 1,
    material_type VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_id, warehouse_id, location_code)
);

CREATE INDEX IF NOT EXISTS idx_material_default_locations_material ON material_default_locations(material_id);
CREATE INDEX IF NOT EXISTS idx_material_default_locations_warehouse ON material_default_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_material_default_locations_location ON material_default_locations(location_code);
CREATE INDEX IF NOT EXISTS idx_material_default_locations_type ON material_default_locations(material_type);

-- Add zone_type to locations if missing
ALTER TABLE locations ADD COLUMN IF NOT EXISTS zone_type VARCHAR(20);
UPDATE locations SET zone_type = 'STORAGE' WHERE location_type = 'storage' AND zone_type IS NULL;
ALTER TABLE locations ALTER COLUMN zone_type SET DEFAULT 'STORAGE';

COMMENT ON TABLE material_default_locations IS 'Default bin locations for materials in each warehouse. Used for putaway suggestions and catalog management.';
COMMENT ON COLUMN locations.zone_type IS 'Zone type: STORAGE, STAGING, RECEIVING, SHIPMENT, PACKING. Only STORAGE locations shown in warehouse map.';
