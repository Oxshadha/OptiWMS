-- V12: Add Material Dimensions and Location Z Coordinate
-- Adds physical dimensions to materials for AI algorithms (GA, TSP)
-- Adds Z coordinate to locations for FIFO logic and 3D pathfinding

-- ============================================
-- ENHANCE MATERIALS TABLE - Add Physical Dimensions
-- ============================================

ALTER TABLE materials 
  ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS volume_cm3 DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS pallet_spaces DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_stack_height INTEGER,
  ADD COLUMN IF NOT EXISTS temperature_controlled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hazardous BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fragile BOOLEAN DEFAULT FALSE;

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_materials_stackable ON materials(stackable);
CREATE INDEX IF NOT EXISTS idx_materials_temperature ON materials(temperature_controlled) WHERE temperature_controlled = TRUE;
CREATE INDEX IF NOT EXISTS idx_materials_hazardous ON materials(hazardous) WHERE hazardous = TRUE;

-- ============================================
-- ENHANCE LOCATIONS TABLE - Add Z Coordinate
-- ============================================

ALTER TABLE locations 
  ADD COLUMN IF NOT EXISTS coordinate_z DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_locations_coordinate_z ON locations(coordinate_z);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN materials.length_cm IS 'Product length in centimeters';
COMMENT ON COLUMN materials.width_cm IS 'Product width in centimeters';
COMMENT ON COLUMN materials.height_cm IS 'Product height in centimeters';
COMMENT ON COLUMN materials.weight_kg IS 'Product weight in kilograms';
COMMENT ON COLUMN materials.volume_cm3 IS 'Product volume in cubic centimeters (calculated)';
COMMENT ON COLUMN materials.pallet_spaces IS 'Number of pallet spaces required (from Active stock.csv)';
COMMENT ON COLUMN materials.stackable IS 'Whether product can be stacked on top of other products';
COMMENT ON COLUMN materials.max_stack_height IS 'Maximum stack height (number of units)';
COMMENT ON COLUMN materials.temperature_controlled IS 'Requires temperature-controlled storage';
COMMENT ON COLUMN materials.hazardous IS 'Hazardous material requiring special handling';
COMMENT ON COLUMN materials.fragile IS 'Fragile material requiring careful handling';

COMMENT ON COLUMN locations.coordinate_z IS 'Z coordinate (height) for FIFO logic and 3D pathfinding - ground level = 0.0, level 2 = 2.0m, etc.';

-- ============================================
-- UPDATE EXISTING DATA
-- ============================================

-- Set default stackable to TRUE for existing materials
UPDATE materials SET stackable = TRUE WHERE stackable IS NULL;

-- Calculate Z coordinate for existing locations based on level_number
-- Ground level (level 1) = 0.0m, level 2 = 2.0m, level 3 = 4.0m, level 4 = 6.0m
UPDATE locations 
SET coordinate_z = (level_number - 1) * 2.0 
WHERE coordinate_z IS NULL;
