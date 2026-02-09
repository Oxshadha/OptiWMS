-- Script to standardize area codes in locations table
-- Converts "ST" (Storage) to "C" for consistency with single-letter area codes
-- This ensures all storage locations use consistent naming (C-01-01, A-01-01, etc.)

-- Check current area code distribution
SELECT 
    area,
    COUNT(*) as count,
    COUNT(DISTINCT warehouse_id) as warehouses
FROM locations
WHERE zone_type = 'STORAGE'
GROUP BY area
ORDER BY count DESC;

-- Update: Convert "ST" to "C" for storage locations
-- This standardizes the area code to single-letter format
UPDATE locations
SET area = 'C'
WHERE area = 'ST' 
  AND zone_type = 'STORAGE'
  AND is_active = TRUE;

-- Also update location_code to match (if it starts with "ST-")
-- This ensures location_code and area field are consistent
UPDATE locations
SET location_code = REPLACE(location_code, 'ST-', 'C-')
WHERE location_code LIKE 'ST-%'
  AND zone_type = 'STORAGE'
  AND is_active = TRUE;

-- Verify the changes
SELECT 
    area,
    COUNT(*) as count
FROM locations
WHERE zone_type = 'STORAGE'
GROUP BY area
ORDER BY area;

-- Show sample of updated locations
SELECT 
    location_code,
    area,
    row_number,
    bay_number,
    zone_type
FROM locations
WHERE zone_type = 'STORAGE'
ORDER BY area, row_number, bay_number
LIMIT 20;
