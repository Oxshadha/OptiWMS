-- Script to check location-warehouse relationships
-- Run this to diagnose putaway errors

-- 1. Check which warehouse a specific location belongs to
SELECT 
    l.id as location_id,
    l.location_code,
    l.warehouse_id,
    w.name as warehouse_name,
    w.code as warehouse_code,
    l.is_active,
    l.location_type
FROM locations l
LEFT JOIN warehouses w ON l.warehouse_id = w.id
WHERE l.location_code = 'C-01-01-1-A';  -- Replace with your location code

-- 2. Check all locations for a specific warehouse
SELECT 
    l.location_code,
    l.area,
    l.row_number,
    l.bay_number,
    l.level_number,
    l.bin_position,
    l.is_active,
    l.location_type
FROM locations l
WHERE l.warehouse_id = '7262019d-9bf4-4824-997c-d7b5c9158ef3'  -- Replace with your warehouse ID
AND l.is_active = TRUE
ORDER BY l.location_code;

-- 3. Find locations that might be in wrong warehouse (locations starting with 'C' but not in expected warehouse)
SELECT 
    l.location_code,
    l.warehouse_id,
    w.name as current_warehouse,
    l.is_active
FROM locations l
LEFT JOIN warehouses w ON l.warehouse_id = w.id
WHERE l.location_code LIKE 'C-%'
AND l.warehouse_id != '7262019d-9bf4-4824-997c-d7b5c9158ef3';  -- Replace with expected warehouse ID

-- 4. Count locations per warehouse
SELECT 
    w.id,
    w.name as warehouse_name,
    w.code as warehouse_code,
    COUNT(l.id) as total_locations,
    COUNT(CASE WHEN l.is_active = TRUE THEN 1 END) as active_locations
FROM warehouses w
LEFT JOIN locations l ON w.id = l.warehouse_id
GROUP BY w.id, w.name, w.code
ORDER BY total_locations DESC;

-- 5. Check worker's warehouse assignment
SELECT 
    u.id,
    u.username,
    u.warehouse_id,
    w.name as warehouse_name,
    w.code as warehouse_code
FROM users u
LEFT JOIN warehouses w ON u.warehouse_id = w.id
WHERE u.warehouse_id = '7262019d-9bf4-4824-997c-d7b5c9158ef3';  -- Replace with warehouse ID

-- 6. Find all locations that don't match their warehouse (data quality check)
-- This finds locations where the location_code prefix doesn't match warehouse code
SELECT 
    l.location_code,
    l.warehouse_id,
    w.code as warehouse_code,
    CASE 
        WHEN l.location_code LIKE 'C-%' AND w.code != 'C' THEN 'Mismatch: C location in non-C warehouse'
        WHEN l.location_code LIKE 'A-%' AND w.code != 'A' THEN 'Mismatch: A location in non-A warehouse'
        ELSE 'OK'
    END as status
FROM locations l
JOIN warehouses w ON l.warehouse_id = w.id
WHERE (l.location_code LIKE 'C-%' AND w.code != 'C')
   OR (l.location_code LIKE 'A-%' AND w.code != 'A');
