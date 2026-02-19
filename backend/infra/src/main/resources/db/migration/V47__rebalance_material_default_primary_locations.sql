-- V47: Rebalance primary material default locations to reduce repeated bin assignments.
-- Keeps one primary (priority=1) per material+warehouse and distributes primaries
-- across compatible active locations by storage type (bulk vs storage).

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'v47_primary_duplicate_locations', COUNT(*)
FROM (
    SELECT warehouse_id, location_code
    FROM material_default_locations
    WHERE COALESCE(priority, 1) = 1
    GROUP BY warehouse_id, location_code
    HAVING COUNT(*) > 1
) t;

WITH primary_rows AS (
    SELECT
        mdl.id,
        mdl.material_id,
        mdl.warehouse_id,
        LOWER(COALESCE(m.storage_type, 'pallet')) AS storage_type,
        ROW_NUMBER() OVER (
            PARTITION BY mdl.material_id, mdl.warehouse_id
            ORDER BY COALESCE(mdl.priority, 999), mdl.created_at, mdl.id
        ) AS rn
    FROM material_default_locations mdl
    JOIN materials m ON m.id = mdl.material_id
),
material_primary AS (
    SELECT
        id AS primary_id,
        material_id,
        warehouse_id,
        CASE WHEN storage_type = 'bulk' THEN 'bulk' ELSE 'storage' END AS location_group
    FROM primary_rows
    WHERE rn = 1
),
storage_locations AS (
    SELECT
        l.warehouse_id,
        l.location_code,
        ROW_NUMBER() OVER (
            PARTITION BY l.warehouse_id
            ORDER BY l.area, l.row_number, l.bay_number, l.level_number, l.bin_position
        ) AS loc_rn,
        COUNT(*) OVER (PARTITION BY l.warehouse_id) AS loc_cnt
    FROM locations l
    WHERE LOWER(COALESCE(l.location_type, 'storage')) = 'storage'
      AND COALESCE(l.is_active, true) = true
      AND LOWER(COALESCE(l.rack_status, 'active')) NOT IN ('reserved', 'maintenance', 'out_of_service')
),
bulk_locations AS (
    SELECT
        l.warehouse_id,
        l.location_code,
        ROW_NUMBER() OVER (
            PARTITION BY l.warehouse_id
            ORDER BY l.area, l.row_number, l.bay_number, l.level_number, l.bin_position
        ) AS loc_rn,
        COUNT(*) OVER (PARTITION BY l.warehouse_id) AS loc_cnt
    FROM locations l
    WHERE LOWER(COALESCE(l.location_type, 'storage')) = 'bulk'
      AND COALESCE(l.is_active, true) = true
      AND LOWER(COALESCE(l.rack_status, 'active')) NOT IN ('reserved', 'maintenance', 'out_of_service')
),
storage_materials AS (
    SELECT
        mp.primary_id,
        mp.warehouse_id,
        ROW_NUMBER() OVER (PARTITION BY mp.warehouse_id ORDER BY mp.material_id) AS mat_rn
    FROM material_primary mp
    WHERE mp.location_group = 'storage'
),
bulk_materials AS (
    SELECT
        mp.primary_id,
        mp.warehouse_id,
        ROW_NUMBER() OVER (PARTITION BY mp.warehouse_id ORDER BY mp.material_id) AS mat_rn
    FROM material_primary mp
    WHERE mp.location_group = 'bulk'
),
storage_map AS (
    SELECT
        sm.primary_id,
        sl.location_code
    FROM storage_materials sm
    JOIN storage_locations sl
      ON sl.warehouse_id = sm.warehouse_id
     AND sl.loc_cnt > 0
     AND sl.loc_rn = ((sm.mat_rn - 1) % sl.loc_cnt) + 1
),
bulk_map AS (
    SELECT
        bm.primary_id,
        COALESCE(
            (
                SELECT bl.location_code
                FROM bulk_locations bl
                WHERE bl.warehouse_id = bm.warehouse_id
                  AND bl.loc_cnt > 0
                  AND bl.loc_rn = ((bm.mat_rn - 1) % bl.loc_cnt) + 1
                LIMIT 1
            ),
            (
                SELECT sl.location_code
                FROM storage_locations sl
                WHERE sl.warehouse_id = bm.warehouse_id
                  AND sl.loc_cnt > 0
                  AND sl.loc_rn = ((bm.mat_rn - 1) % sl.loc_cnt) + 1
                LIMIT 1
            )
        ) AS location_code
    FROM bulk_materials bm
),
mapped_primary AS (
    SELECT primary_id, location_code FROM storage_map
    UNION ALL
    SELECT primary_id, location_code FROM bulk_map WHERE location_code IS NOT NULL
)
UPDATE material_default_locations mdl
SET location_code = mp.location_code,
    priority = 1
FROM mapped_primary mp
WHERE mdl.id = mp.primary_id
  AND (mdl.location_code IS DISTINCT FROM mp.location_code OR COALESCE(mdl.priority, 999) <> 1);

-- Re-sequence all defaults so each material+warehouse has clean 1..N priority ordering.
WITH ranked AS (
    SELECT
        mdl.id,
        ROW_NUMBER() OVER (
            PARTITION BY mdl.material_id, mdl.warehouse_id
            ORDER BY COALESCE(mdl.priority, 999), mdl.created_at, mdl.id
        ) AS rn
    FROM material_default_locations mdl
)
UPDATE material_default_locations mdl
SET priority = ranked.rn
FROM ranked
WHERE mdl.id = ranked.id
  AND mdl.priority IS DISTINCT FROM ranked.rn;

-- Sync inventory location to primary default location for consistency.
UPDATE inventory i
SET location_code = mdl.location_code
FROM material_default_locations mdl
WHERE mdl.material_id = i.material_id
  AND mdl.warehouse_id = i.warehouse_id
  AND mdl.priority = 1
  AND i.location_code IS DISTINCT FROM mdl.location_code;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'v47_primary_duplicate_locations', COUNT(*)
FROM (
    SELECT warehouse_id, location_code
    FROM material_default_locations
    WHERE COALESCE(priority, 1) = 1
    GROUP BY warehouse_id, location_code
    HAVING COUNT(*) > 1
) t;
