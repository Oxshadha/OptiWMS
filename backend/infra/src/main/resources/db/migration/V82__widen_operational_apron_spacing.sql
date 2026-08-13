-- Keep operational work points far enough apart for physical navigation and
-- legible map labels at normal control-room zoom levels.
WITH apron(location_code, coordinate_x, coordinate_y) AS (
    VALUES
        ('QTN-01', -31.0::NUMERIC, -12.0::NUMERIC),
        ('RCV-01',  -7.0::NUMERIC, -12.0::NUMERIC),
        ('STG-01',  17.0::NUMERIC, -12.0::NUMERIC),
        ('PACK-01', 41.0::NUMERIC, -12.0::NUMERIC),
        ('DSP-01',  65.0::NUMERIC, -12.0::NUMERIC),
        ('DOOR-01', 17.0::NUMERIC, -24.0::NUMERIC)
), affected_warehouses AS (
    SELECT DISTINCT l.warehouse_id
      FROM locations l
      JOIN apron a ON a.location_code = l.location_code
     WHERE l.is_active = TRUE
), moved AS (
    UPDATE locations l
       SET coordinate_x = a.coordinate_x,
           coordinate_y = a.coordinate_y,
           source_lineage = COALESCE(l.source_lineage, '{}'::JSONB) ||
               jsonb_build_object(
                   'operational_apron_method', 'separated_function_lanes_v2',
                   'operational_apron_spacing_m', 24
               )
      FROM apron a
     WHERE l.location_code = a.location_code
       AND l.is_active = TRUE
    RETURNING l.warehouse_id
)
UPDATE warehouse_route_graphs g
   SET status = 'RETIRED',
       retired_at = NOW()
 WHERE g.status = 'ACTIVE'
   AND EXISTS (
       SELECT 1
         FROM affected_warehouses aw
        WHERE aw.warehouse_id = g.warehouse_id
   );
