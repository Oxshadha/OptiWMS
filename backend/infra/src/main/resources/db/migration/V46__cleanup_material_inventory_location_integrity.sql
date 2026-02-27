-- V46: One-time integrity cleanup for Material Catalog, Inventory, and Default Locations
-- Goals:
-- 1) Normalize material handling/storage fields used by operations
-- 2) Remove ambiguous default-location primaries
-- 3) Align inventory location_code with valid, type-compatible default/storage locations
-- 4) Persist before/after metrics for audit visibility

CREATE TABLE IF NOT EXISTS data_integrity_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage VARCHAR(20) NOT NULL, -- BEFORE / AFTER
    metric_name VARCHAR(120) NOT NULL,
    metric_value BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BEFORE snapshot
INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'materials_total', COUNT(*) FROM materials;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'materials_missing_unit_type', COUNT(*)
FROM materials
WHERE unit_type IS NULL OR TRIM(unit_type) = '';

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'materials_missing_storage_type', COUNT(*)
FROM materials
WHERE storage_type IS NULL OR TRIM(storage_type) = '';

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'pallet_materials_missing_units_per_pallet', COUNT(*)
FROM materials
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND pallet_spaces IS NULL;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'pallet_materials_missing_max_pallet_weight', COUNT(*)
FROM materials
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND max_pallet_weight_kg IS NULL;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'inventory_rows_null_location', COUNT(*)
FROM inventory
WHERE location_code IS NULL OR TRIM(COALESCE(location_code, '')) = '';

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'default_primary_duplicates_per_location', COUNT(*)
FROM (
    SELECT warehouse_id, location_code
    FROM material_default_locations
    WHERE COALESCE(priority, 1) = 1
    GROUP BY warehouse_id, location_code
    HAVING COUNT(*) > 1
) t;

-- 1) Normalize material fields
UPDATE materials
SET unit_type = LOWER(TRIM(unit_type))
WHERE unit_type IS NOT NULL;

UPDATE materials
SET unit_type = 'pcs'
WHERE unit_type IN ('piece', 'pieces');

UPDATE materials
SET unit_type = 'unit'
WHERE unit_type IS NULL OR TRIM(unit_type) = '';

UPDATE materials
SET storage_type = LOWER(TRIM(storage_type))
WHERE storage_type IS NOT NULL;

UPDATE materials
SET storage_type = CASE
    WHEN unit_type IN ('drum', 'bucket') THEN 'bulk'
    WHEN unit_type = 'reel' THEN 'rack'
    ELSE 'pallet'
END
WHERE storage_type IS NULL OR TRIM(storage_type) = '';

-- Safe operational defaults for existing legacy rows
UPDATE materials
SET pallet_spaces = 1
WHERE LOWER(storage_type) = 'pallet'
  AND pallet_spaces IS NULL;

UPDATE materials
SET max_pallet_weight_kg = 1000
WHERE LOWER(storage_type) = 'pallet'
  AND max_pallet_weight_kg IS NULL;

UPDATE materials
SET volume_cm3 = ROUND((length_cm * width_cm * height_cm)::numeric, 2)
WHERE volume_cm3 IS NULL
  AND length_cm IS NOT NULL
  AND width_cm IS NOT NULL
  AND height_cm IS NOT NULL;

-- Minimal non-zero fallbacks for capacity-based checks
UPDATE materials
SET weight_kg = 1
WHERE weight_kg IS NULL;

UPDATE materials
SET volume_cm3 = 1000
WHERE volume_cm3 IS NULL;

-- 2) Normalize default-location priorities to eliminate ambiguous primaries
-- Per material+warehouse, enforce sequential priority (1..N)
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY material_id, warehouse_id
               ORDER BY COALESCE(priority, 999), created_at, id
           ) AS rn
    FROM material_default_locations
)
UPDATE material_default_locations mdl
SET priority = ranked.rn
FROM ranked
WHERE mdl.id = ranked.id
  AND mdl.priority IS DISTINCT FROM ranked.rn;

-- Across location+warehouse, allow only one primary (priority=1)
WITH location_rank AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY warehouse_id, location_code
               ORDER BY priority, created_at, material_id
           ) AS rn
    FROM material_default_locations
    WHERE priority = 1
),
to_demote AS (
    SELECT id, rn
    FROM location_rank
    WHERE rn > 1
)
UPDATE material_default_locations mdl
SET priority = 1 + to_demote.rn
FROM to_demote
WHERE mdl.id = to_demote.id;

-- 3) Ensure default locations are active storage and storage-type compatible.
-- If incompatible/blocked/inactive, remap to first valid location in same warehouse.
WITH bad_defaults AS (
    SELECT mdl.id,
           mdl.material_id,
           mdl.warehouse_id,
           m.storage_type
    FROM material_default_locations mdl
    JOIN materials m ON m.id = mdl.material_id
    JOIN locations l ON l.location_code = mdl.location_code
    WHERE
      COALESCE(l.is_active, true) = false
      OR LOWER(COALESCE(l.rack_status, 'active')) IN ('reserved', 'maintenance', 'out_of_service')
      OR LOWER(COALESCE(l.location_type, 'storage')) <> 'storage'
      OR (
          LOWER(COALESCE(m.storage_type, 'pallet')) = 'bulk'
          AND LOWER(COALESCE(l.location_type, 'storage')) <> 'bulk'
      )
      OR (
          LOWER(COALESCE(m.storage_type, 'pallet')) <> 'bulk'
          AND LOWER(COALESCE(l.location_type, 'storage')) = 'bulk'
      )
),
replacement AS (
    SELECT bd.id,
           (
               SELECT l2.location_code
               FROM locations l2
               WHERE l2.warehouse_id = bd.warehouse_id
                 AND LOWER(COALESCE(l2.location_type, 'storage')) = CASE
                     WHEN LOWER(COALESCE(bd.storage_type, 'pallet')) = 'bulk' THEN 'bulk'
                     ELSE 'storage'
                 END
                 AND COALESCE(l2.is_active, true) = true
                 AND LOWER(COALESCE(l2.rack_status, 'active')) NOT IN ('reserved', 'maintenance', 'out_of_service')
               ORDER BY l2.area, l2.row_number, l2.bay_number, l2.level_number, l2.bin_position
               LIMIT 1
           ) AS new_location
    FROM bad_defaults bd
)
UPDATE material_default_locations mdl
SET location_code = replacement.new_location
FROM replacement
WHERE mdl.id = replacement.id
  AND replacement.new_location IS NOT NULL;

-- Re-sequence priorities again after remaps.
WITH ranked2 AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY material_id, warehouse_id
               ORDER BY COALESCE(priority, 999), created_at, id
           ) AS rn
    FROM material_default_locations
)
UPDATE material_default_locations mdl
SET priority = ranked2.rn
FROM ranked2
WHERE mdl.id = ranked2.id
  AND mdl.priority IS DISTINCT FROM ranked2.rn;

-- 4) Align inventory locations.
-- 4a) Fill NULL/blank inventory location_code from primary default (priority=1)
UPDATE inventory i
SET location_code = mdl.location_code
FROM material_default_locations mdl
WHERE i.material_id = mdl.material_id
  AND i.warehouse_id = mdl.warehouse_id
  AND mdl.priority = 1
  AND (i.location_code IS NULL OR TRIM(COALESCE(i.location_code, '')) = '');

-- 4b) Correct type mismatches using primary default if available and compatible.
WITH mismatch AS (
    SELECT i.id,
           i.material_id,
           i.warehouse_id,
           m.storage_type,
           LOWER(COALESCE(l.location_type, 'storage')) AS current_loc_type
    FROM inventory i
    JOIN materials m ON m.id = i.material_id
    LEFT JOIN locations l ON l.location_code = i.location_code
    WHERE i.location_code IS NOT NULL
      AND (
          (LOWER(COALESCE(m.storage_type, 'pallet')) = 'bulk'
           AND LOWER(COALESCE(l.location_type, 'storage')) <> 'bulk')
       OR (LOWER(COALESCE(m.storage_type, 'pallet')) <> 'bulk'
           AND LOWER(COALESCE(l.location_type, 'storage')) = 'bulk')
      )
),
primary_target AS (
    SELECT mm.id,
           mdl.location_code AS new_location
    FROM mismatch mm
    JOIN material_default_locations mdl
      ON mdl.material_id = mm.material_id
     AND mdl.warehouse_id = mm.warehouse_id
     AND mdl.priority = 1
    JOIN locations l2 ON l2.location_code = mdl.location_code
    WHERE (
        LOWER(COALESCE(mm.storage_type, 'pallet')) = 'bulk'
        AND LOWER(COALESCE(l2.location_type, 'storage')) = 'bulk'
    ) OR (
        LOWER(COALESCE(mm.storage_type, 'pallet')) <> 'bulk'
        AND LOWER(COALESCE(l2.location_type, 'storage')) = 'storage'
    )
)
UPDATE inventory i
SET location_code = pt.new_location
FROM primary_target pt
WHERE i.id = pt.id;

-- 4c) For any remaining mismatches, fallback to first compatible active location in same warehouse.
WITH mismatch2 AS (
    SELECT i.id,
           i.warehouse_id,
           m.storage_type
    FROM inventory i
    JOIN materials m ON m.id = i.material_id
    LEFT JOIN locations l ON l.location_code = i.location_code
    WHERE i.location_code IS NULL
       OR (
          (LOWER(COALESCE(m.storage_type, 'pallet')) = 'bulk'
           AND LOWER(COALESCE(l.location_type, 'storage')) <> 'bulk')
       OR (LOWER(COALESCE(m.storage_type, 'pallet')) <> 'bulk'
           AND LOWER(COALESCE(l.location_type, 'storage')) = 'bulk')
       )
),
fallback AS (
    SELECT mm.id,
           (
             SELECT l2.location_code
             FROM locations l2
             WHERE l2.warehouse_id = mm.warehouse_id
               AND LOWER(COALESCE(l2.location_type, 'storage')) = CASE
                 WHEN LOWER(COALESCE(mm.storage_type, 'pallet')) = 'bulk' THEN 'bulk'
                 ELSE 'storage'
               END
               AND COALESCE(l2.is_active, true) = true
               AND LOWER(COALESCE(l2.rack_status, 'active')) NOT IN ('reserved', 'maintenance', 'out_of_service')
             ORDER BY l2.area, l2.row_number, l2.bay_number, l2.level_number, l2.bin_position
             LIMIT 1
           ) AS new_location
    FROM mismatch2 mm
)
UPDATE inventory i
SET location_code = fb.new_location
FROM fallback fb
WHERE i.id = fb.id
  AND fb.new_location IS NOT NULL;

-- AFTER snapshot
INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'materials_total', COUNT(*) FROM materials;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'materials_missing_unit_type', COUNT(*)
FROM materials
WHERE unit_type IS NULL OR TRIM(unit_type) = '';

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'materials_missing_storage_type', COUNT(*)
FROM materials
WHERE storage_type IS NULL OR TRIM(storage_type) = '';

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'pallet_materials_missing_units_per_pallet', COUNT(*)
FROM materials
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND pallet_spaces IS NULL;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'pallet_materials_missing_max_pallet_weight', COUNT(*)
FROM materials
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND max_pallet_weight_kg IS NULL;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'inventory_rows_null_location', COUNT(*)
FROM inventory
WHERE location_code IS NULL OR TRIM(COALESCE(location_code, '')) = '';

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'default_primary_duplicates_per_location', COUNT(*)
FROM (
    SELECT warehouse_id, location_code
    FROM material_default_locations
    WHERE COALESCE(priority, 1) = 1
    GROUP BY warehouse_id, location_code
    HAVING COUNT(*) > 1
) t;
