-- Separate operational functions into a readable physical apron. The former
-- source coordinates compressed six functions into a 5 x 6 metre corner.

WITH apron(location_code, coordinate_x, coordinate_y) AS (
    VALUES
        ('QTN-01', -7.0::NUMERIC, -12.0::NUMERIC),
        ('RCV-01',  5.0::NUMERIC, -12.0::NUMERIC),
        ('STG-01', 17.0::NUMERIC, -12.0::NUMERIC),
        ('PACK-01', 29.0::NUMERIC, -12.0::NUMERIC),
        ('DSP-01', 41.0::NUMERIC, -12.0::NUMERIC),
        ('DOOR-01', 17.0::NUMERIC, -24.0::NUMERIC)
)
UPDATE locations l
SET
    coordinate_x = apron.coordinate_x,
    coordinate_y = apron.coordinate_y,
    source_lineage = COALESCE(l.source_lineage, '{}'::JSONB)
        || JSONB_BUILD_OBJECT(
            'operational_apron_method', 'separated_function_lanes_v1',
            'operational_apron_aligned_at', TO_JSONB(NOW())
        )
FROM apron
WHERE l.location_code = apron.location_code
  AND l.is_active = TRUE;

-- Moving the door changes travel-depth distance. Recalculate physical F/M/S
-- zones while preserving each rack's ABC compatibility prefix.
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
thresholds AS (
    SELECT
        warehouse_id,
        dataset_scope,
        PERCENTILE_DISC(1.0 / 3.0) WITHIN GROUP (ORDER BY door_distance) AS fast_max,
        PERCENTILE_DISC(2.0 / 3.0) WITHIN GROUP (ORDER BY door_distance) AS medium_max
    FROM racks
    GROUP BY warehouse_id, dataset_scope
),
zones AS (
    SELECT
        racks.*,
        CASE
            WHEN racks.door_distance <= thresholds.fast_max THEN 'F'
            WHEN racks.door_distance <= thresholds.medium_max THEN 'M'
            ELSE 'S'
        END AS velocity_class
    FROM racks
    JOIN thresholds USING (warehouse_id, dataset_scope)
)
UPDATE locations l
SET
    amalgamated_class = UPPER(LEFT(l.amalgamated_class, 1)) || z.velocity_class,
    source_lineage = COALESCE(l.source_lineage, '{}'::JSONB)
        || JSONB_BUILD_OBJECT(
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

-- Node coordinates and rack class are persisted in the graph snapshot.
UPDATE warehouse_route_graphs g
SET status = 'RETIRED', retired_at = NOW()
WHERE g.status = 'ACTIVE'
  AND EXISTS (
      SELECT 1
      FROM locations l
      WHERE l.warehouse_id = g.warehouse_id
        AND l.is_active = TRUE
        AND l.location_code IN (
            'QTN-01', 'RCV-01', 'STG-01', 'PACK-01', 'DSP-01', 'DOOR-01'
        )
  );
