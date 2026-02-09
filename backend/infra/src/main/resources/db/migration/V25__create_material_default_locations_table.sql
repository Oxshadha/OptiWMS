-- V25: Create Material Default Locations Table (if missing)
-- This migration ensures the table exists even if V24 was marked as applied but didn't create it

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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_material_default_locations_material ON material_default_locations(material_id);
CREATE INDEX IF NOT EXISTS idx_material_default_locations_warehouse ON material_default_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_material_default_locations_location ON material_default_locations(location_code);
CREATE INDEX IF NOT EXISTS idx_material_default_locations_type ON material_default_locations(material_type);

-- Add zone_type column to locations if it doesn't exist
ALTER TABLE locations ADD COLUMN IF NOT EXISTS zone_type VARCHAR(20);
COMMENT ON COLUMN locations.zone_type IS 'Zone type: STORAGE, STAGING, RECEIVING, SHIPMENT, PACKING. Only STORAGE locations shown in warehouse map.';

-- Update existing locations: if location_type is 'storage', set zone_type to 'STORAGE'
UPDATE locations SET zone_type = 'STORAGE' WHERE location_type = 'storage' AND zone_type IS NULL;

-- Set default zone_type for new locations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'locations' 
        AND column_name = 'zone_type' 
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE locations ALTER COLUMN zone_type SET DEFAULT 'STORAGE';
    END IF;
END $$;
