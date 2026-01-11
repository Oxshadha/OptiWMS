-- V24: Add Material Default Locations Table
-- Stores default/suggested bin locations for materials in each warehouse
-- This allows materials to have pre-assigned locations in the catalog

CREATE TABLE IF NOT EXISTS material_default_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    location_code VARCHAR(50) NOT NULL REFERENCES locations(location_code),
    priority INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary, etc.
    material_type VARCHAR(50), -- raw_material, packing_material, finished_good
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_id, warehouse_id, location_code)
);

CREATE INDEX idx_material_default_locations_material ON material_default_locations(material_id);
CREATE INDEX idx_material_default_locations_warehouse ON material_default_locations(warehouse_id);
CREATE INDEX idx_material_default_locations_location ON material_default_locations(location_code);
CREATE INDEX idx_material_default_locations_type ON material_default_locations(material_type);

COMMENT ON TABLE material_default_locations IS 'Default bin locations for materials in each warehouse. Used for putaway suggestions and catalog management.';
COMMENT ON COLUMN material_default_locations.priority IS 'Priority: 1 = primary location, 2 = secondary, etc.';
COMMENT ON COLUMN material_default_locations.material_type IS 'Material type: raw_material, packing_material, finished_good';

-- Update location_type to distinguish storage from staging/receiving/shipment/packing
-- Only locations with location_type = 'storage' should be shown in warehouse map
-- Staging, receiving, shipment, packing areas should be excluded

-- Add zone_type column if it doesn't exist (for better filtering)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS zone_type VARCHAR(20);
COMMENT ON COLUMN locations.zone_type IS 'Zone type: STORAGE, STAGING, RECEIVING, SHIPMENT, PACKING. Only STORAGE locations shown in warehouse map.';

-- Update existing locations: if location_type is 'storage', set zone_type to 'STORAGE'
UPDATE locations SET zone_type = 'STORAGE' WHERE location_type = 'storage' AND zone_type IS NULL;

-- Set default zone_type for new locations
ALTER TABLE locations ALTER COLUMN zone_type SET DEFAULT 'STORAGE';
