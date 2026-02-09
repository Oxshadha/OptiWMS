-- V11: Add Rack System Fields
-- Adds rack properties, level capacities, and storage area support

-- Add rack properties to locations table
ALTER TABLE locations 
  ADD COLUMN IF NOT EXISTS rack_status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS accessibility_rating INTEGER CHECK (accessibility_rating BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS coordinate_x DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS coordinate_y DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS max_pallet_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS current_pallet_count INTEGER DEFAULT 0;

-- Create location_levels table for level-specific capacities
CREATE TABLE IF NOT EXISTS location_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 10),
    weight_capacity_kg DECIMAL(10,2) NOT NULL,
    pallet_capacity INTEGER NOT NULL,
    height_cm DECIMAL(10,2),
    accessibility_rating INTEGER CHECK (accessibility_rating BETWEEN 1 AND 10),
    current_weight_kg DECIMAL(10,2) DEFAULT 0,
    current_pallet_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(location_id, level_number)
);

CREATE INDEX idx_location_levels_location ON location_levels(location_id);
CREATE INDEX idx_location_levels_level ON location_levels(level_number);
CREATE INDEX idx_locations_rack_status ON locations(rack_status);
CREATE INDEX idx_locations_accessibility ON locations(accessibility_rating);

-- Add comments for documentation
COMMENT ON COLUMN locations.rack_status IS 'Rack status: active, maintenance, reserved, out_of_service';
COMMENT ON COLUMN locations.description IS 'Description of what is typically stored in this rack';
COMMENT ON COLUMN locations.notes IS 'Additional notes or special instructions';
COMMENT ON COLUMN locations.accessibility_rating IS 'Accessibility rating 1-10 (1=least accessible, 10=most accessible)';
COMMENT ON COLUMN locations.coordinate_x IS 'X coordinate for path finding and layout visualization';
COMMENT ON COLUMN locations.coordinate_y IS 'Y coordinate for path finding and layout visualization';
COMMENT ON COLUMN locations.max_pallet_capacity IS 'Maximum pallets this rack can hold across all levels';
COMMENT ON COLUMN locations.current_pallet_count IS 'Current pallets stored in this rack across all levels';

COMMENT ON TABLE location_levels IS 'Stores level-specific capacity and current usage for each location level';
COMMENT ON COLUMN location_levels.weight_capacity_kg IS 'Maximum weight capacity for this level in kilograms';
COMMENT ON COLUMN location_levels.pallet_capacity IS 'Maximum number of pallets this level can hold';
COMMENT ON COLUMN location_levels.height_cm IS 'Height of this level in centimeters';
COMMENT ON COLUMN location_levels.accessibility_rating IS 'Accessibility rating for this specific level (lower levels = higher rating)';
COMMENT ON COLUMN location_levels.current_weight_kg IS 'Current weight stored in this level';
COMMENT ON COLUMN location_levels.current_pallet_count IS 'Current number of pallets stored in this level';

