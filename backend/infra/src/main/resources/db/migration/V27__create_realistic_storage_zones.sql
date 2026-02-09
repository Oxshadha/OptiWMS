-- V27: Create Realistic Storage Zones (A, B, C, D) for ABC/FMS Classification
-- Based on Training Report structure for optimal storage categorization
--
-- Zone Structure:
-- - Zone A: High accessibility (front/ground) - 1 row, 5 bays - for ABC-A items (fast movers)
-- - Zone B: Medium accessibility (middle) - 2 rows, 8 bays - for ABC-B items (medium movers)
-- - Zone C: Main storage (most locations) - 10 rows, 12 bays - for ABC-C items (general storage)
-- - Zone D: Low accessibility (back/upper) - 3 rows, 10 bays - for slow movers
--
-- Location Format: AREA-ROW-BAY-LEVEL-POS (e.g., C-01-01-1-A)
-- This format supports ABC/FMS categorization and optimal storage suggestions

-- This migration creates a function to generate realistic storage locations
-- The actual generation will be done by RealisticStorageLocationGenerator service

-- Add comment to locations table about zone structure
COMMENT ON COLUMN locations.area IS 'Storage zone: A (high accessibility), B (medium), C (main storage), D (low accessibility). Used for ABC/FMS classification.';
COMMENT ON COLUMN locations.accessibility_rating IS 'Accessibility rating 1-10 (1=least, 10=most accessible). Zone A: 9-10, Zone B: 6-8, Zone C: 4-6, Zone D: 1-3.';

-- Ensure zone_type is set to STORAGE for all storage zones
UPDATE locations 
SET zone_type = 'STORAGE'
WHERE area IN ('A', 'B', 'C', 'D')
  AND (zone_type IS NULL OR zone_type != 'STORAGE');

-- Standardize area codes: Convert 'ST' to 'C' for main storage
UPDATE locations
SET area = 'C',
    location_code = REPLACE(location_code, 'ST-', 'C-')
WHERE area = 'ST' 
  AND zone_type = 'STORAGE'
  AND is_active = TRUE;

-- Add index for area-based queries (for ABC/FMS zone assignment)
CREATE INDEX IF NOT EXISTS idx_locations_area_zone ON locations(area, zone_type, is_active)
WHERE zone_type = 'STORAGE';

-- Add index for accessibility-based queries (for optimal storage suggestions)
CREATE INDEX IF NOT EXISTS idx_locations_accessibility ON locations(accessibility_rating, zone_type)
WHERE zone_type = 'STORAGE' AND is_active = TRUE;
