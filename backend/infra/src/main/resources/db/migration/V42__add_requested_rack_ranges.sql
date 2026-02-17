-- Add requested rack ranges to warehouse layout
-- Requested:
--   A-01-02 .. A-01-10
--   C-01-04 .. C-01-10
--   C-02-04 .. C-02-10
-- Inserts all locations as 5 levels x 2 bins (A,B) per rack.

DO $$
DECLARE
    target_warehouse_id UUID;
    spec RECORD;
    bay_num INTEGER;
    level_num INTEGER;
    bin_pos TEXT;
    row_code TEXT;
    bay_code TEXT;
    new_location_code TEXT;
BEGIN
    SELECT id INTO target_warehouse_id
    FROM warehouses
    WHERE code = 'WH-001'
    ORDER BY created_at
    LIMIT 1;

    IF target_warehouse_id IS NULL THEN
        SELECT id INTO target_warehouse_id
        FROM warehouses
        ORDER BY created_at
        LIMIT 1;
    END IF;

    IF target_warehouse_id IS NULL THEN
        RAISE NOTICE 'No warehouse found. Skipping V42 rack range insertion.';
        RETURN;
    END IF;

    CREATE TEMP TABLE tmp_requested_specs (
        area VARCHAR(2),
        row_no INTEGER,
        bay_from INTEGER,
        bay_to INTEGER,
        slot_class VARCHAR(2)
    ) ON COMMIT DROP;

    INSERT INTO tmp_requested_specs (area, row_no, bay_from, bay_to, slot_class)
    VALUES
        ('A', 1, 2, 10, 'AF'),
        ('C', 1, 4, 10, 'CM'),
        ('C', 2, 4, 10, 'CM');

    FOR spec IN SELECT * FROM tmp_requested_specs LOOP
        row_code := LPAD(spec.row_no::TEXT, 2, '0');

        FOR bay_num IN spec.bay_from..spec.bay_to LOOP
            bay_code := LPAD(bay_num::TEXT, 2, '0');

            FOR level_num IN 1..5 LOOP
                FOREACH bin_pos IN ARRAY ARRAY['A', 'B'] LOOP
                    new_location_code := FORMAT('%s-%s-%s-%s-%s', spec.area, row_code, bay_code, level_num, bin_pos);

                    INSERT INTO locations (
                        warehouse_id,
                        location_code,
                        area,
                        row_number,
                        bay_number,
                        level_number,
                        bin_position,
                        location_type,
                        zone_type,
                        is_active,
                        rack_status,
                        amalgamated_class,
                        description,
                        max_pallet_capacity,
                        current_pallet_count
                    )
                    SELECT
                        target_warehouse_id,
                        new_location_code,
                        spec.area,
                        row_code,
                        bay_code,
                        level_num,
                        bin_pos,
                        'storage',
                        'STORAGE',
                        TRUE,
                        'active',
                        spec.slot_class,
                        FORMAT('Zone %s Rack %s-%s', spec.area, row_code, bay_code),
                        10,
                        0
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM locations l
                        WHERE l.location_code = new_location_code
                    );
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;
