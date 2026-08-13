-- Physical rack F/M/S is a travel-depth zone, not a randomized attribute.
-- Preserve the ABC capacity prefix, assign the nearest door third to Fast,
-- the middle third to Medium, and the deepest third to Slow.

WITH doors AS (
    SELECT
        warehouse_id,
        COALESCE(dataset_version, '') AS dataset_scope,
        coordinate_x::DOUBLE PRECISION AS x,
        coordinate_y::DOUBLE PRECISION AS y
    FROM locations
    WHERE is_active = TRUE
      AND zone_type = 'DOOR'
),
racks AS (
    SELECT
        l.warehouse_id,
        COALESCE(l.dataset_version, '') AS dataset_scope,
        l.area,
        l.row_number,
        l.bay_number,
        MIN(
            ABS(l.coordinate_x::DOUBLE PRECISION - d.x)
            + ABS(l.coordinate_y::DOUBLE PRECISION - d.y)
        ) AS door_distance
    FROM locations l
    JOIN doors d
      ON d.warehouse_id = l.warehouse_id
     AND d.dataset_scope = COALESCE(l.dataset_version, '')
    WHERE l.is_active = TRUE
      AND l.zone_type IN ('PICK_FACE', 'RESERVE')
    GROUP BY
        l.warehouse_id,
        COALESCE(l.dataset_version, ''),
        l.area,
        l.row_number,
        l.bay_number
),
ranked AS (
    SELECT
        racks.*,
        ROW_NUMBER() OVER (
            PARTITION BY warehouse_id, dataset_scope
            ORDER BY door_distance, area, row_number, bay_number
        ) AS rack_rank,
        COUNT(*) OVER (
            PARTITION BY warehouse_id, dataset_scope
        ) AS rack_count
    FROM racks
),
zones AS (
    SELECT
        ranked.*,
        CASE
            WHEN (rack_rank - 1) * 3 < rack_count THEN 'F'
            WHEN (rack_rank - 1) * 3 < rack_count * 2 THEN 'M'
            ELSE 'S'
        END AS velocity_class
    FROM ranked
)
UPDATE locations l
SET
    amalgamated_class = UPPER(LEFT(l.amalgamated_class, 1)) || z.velocity_class,
    source_lineage = (
        CASE
            WHEN COALESCE(l.source_lineage, '{}'::JSONB)
                    ? 'pre_door_zone_amalgamated_class'
                THEN COALESCE(l.source_lineage, '{}'::JSONB)
            ELSE COALESCE(l.source_lineage, '{}'::JSONB)
                || JSONB_BUILD_OBJECT(
                    'pre_door_zone_amalgamated_class', l.amalgamated_class
                )
        END
    ) || JSONB_BUILD_OBJECT(
        'velocity_zone_method', 'nearest_door_manhattan_tercile_v1',
        'velocity_zone_distance_m', z.door_distance,
        'velocity_zone_aligned_at', TO_JSONB(NOW())
    )
FROM zones z
WHERE l.warehouse_id = z.warehouse_id
  AND COALESCE(l.dataset_version, '') = z.dataset_scope
  AND l.area = z.area
  AND l.row_number = z.row_number
  AND l.bay_number = z.bay_number
  AND l.is_active = TRUE
  AND l.zone_type IN ('PICK_FACE', 'RESERVE')
  AND UPPER(LEFT(l.amalgamated_class, 1)) IN ('A', 'B', 'C');

-- Graph node metadata carries rack class. Retiring active graphs makes the API
-- rebuild them from the newly aligned source locations on the next ensure call.
UPDATE warehouse_route_graphs g
SET status = 'RETIRED', retired_at = NOW()
WHERE g.status = 'ACTIVE'
  AND EXISTS (
      SELECT 1
      FROM locations l
      WHERE l.warehouse_id = g.warehouse_id
        AND l.is_active = TRUE
        AND l.zone_type = 'DOOR'
  );
