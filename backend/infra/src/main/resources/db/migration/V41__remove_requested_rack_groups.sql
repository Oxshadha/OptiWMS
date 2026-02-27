-- Remove user-requested rack groups and all dependent references.
-- This targets rack keys (AREA-ROW-BAY) regardless of level/bin.

DO $$
DECLARE
    rec RECORD;
BEGIN
    CREATE TEMP TABLE tmp_target_rack_keys (
        rack_key VARCHAR(20) PRIMARY KEY
    ) ON COMMIT DROP;

    INSERT INTO tmp_target_rack_keys (rack_key)
    VALUES
        ('D-01-09'),
        ('D-01-10'),
        ('D-02-09'),
        ('D-02-10'),
        ('A-04-01'),
        ('A-04-02'),
        ('D-03-01'),
        ('D-03-02'),
        ('D-03-03'),
        ('D-03-04'),
        ('D-03-05'),
        ('D-03-06'),
        ('D-03-07'),
        ('D-03-08'),
        ('D-03-09'),
        ('D-03-10'),
        ('A-03-01'),
        ('A-03-02'),
        ('A-03-03'),
        ('A-03-04'),
        ('A-03-05'),
        ('A-03-06'),
        ('A-03-07'),
        ('A-03-08'),
        ('A-03-09'),
        ('A-03-10')
,
        ('C-03-01'),
        ('C-03-02'),
        ('C-03-03'),
        ('C-03-04'),
        ('C-04-01'),
        ('C-04-02'),
        ('C-04-03'),
        ('C-04-04'),
        ('C-05-01'),
        ('C-05-02'),
        ('C-05-03'),
        ('C-05-04'),
        ('C-06-01'),
        ('C-06-02'),
        ('C-06-03'),
        ('C-06-04'),
        ('C-07-01'),
        ('C-07-02'),
        ('C-07-03'),
        ('C-07-04'),
        ('C-08-01'),
        ('C-08-02'),
        ('C-08-03'),
        ('C-08-04'),
        ('C-09-01'),
        ('C-09-02'),
        ('C-09-03'),
        ('C-09-04'),
        ('C-10-01'),
        ('C-10-02'),
        ('C-10-03'),
        ('C-10-04'),
        ('C-11-01'),
        ('C-11-02'),
        ('C-11-03'),
        ('C-11-04'),
        ('C-12-01'),
        ('C-12-02'),
        ('C-12-03'),
        ('C-12-04'),
        ('C-13-01'),
        ('C-13-02'),
        ('C-13-03'),
        ('C-13-04'),
        ('C-14-01'),
        ('C-14-02'),
        ('C-14-03'),
        ('C-14-04'),
        ('C-15-01'),
        ('C-15-02'),
        ('C-15-03'),
        ('C-15-04'),
        ('C-16-01'),
        ('C-16-02'),
        ('C-16-03'),
        ('C-16-04'),
        ('C-17-01'),
        ('C-17-02'),
        ('C-17-03'),
        ('C-17-04'),
        ('C-18-01'),
        ('C-18-02'),
        ('C-18-03'),
        ('C-18-04'),
        ('C-19-01'),
        ('C-19-02'),
        ('C-19-03'),
        ('C-19-04'),
        ('C-20-01'),
        ('C-20-02'),
        ('C-20-03'),
        ('C-20-04')    ;

    CREATE TEMP TABLE tmp_target_locations AS
    SELECT l.id, l.location_code
    FROM locations l
    JOIN tmp_target_rack_keys t
      ON t.rack_key = (
          UPPER(COALESCE(l.area, ''))
          || '-'
          || CASE
              WHEN COALESCE(l.row_number, '') ~ '^[0-9]+$' THEN LPAD((l.row_number::INTEGER)::TEXT, 2, '0')
              ELSE LPAD(COALESCE(l.row_number, ''), 2, '0')
          END
          || '-'
          || CASE
              WHEN COALESCE(l.bay_number, '') ~ '^[0-9]+$' THEN LPAD((l.bay_number::INTEGER)::TEXT, 2, '0')
              ELSE LPAD(COALESCE(l.bay_number, ''), 2, '0')
          END
      );

    -- material_default_locations.location_code is NOT NULL; rows must be removed.
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'material_default_locations'
    ) THEN
        DELETE FROM material_default_locations mdl
        USING tmp_target_locations t
        WHERE mdl.location_code = t.location_code;
    END IF;

    -- Null out direct location-code references across operational tables.
    FOR rec IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.column_name IN (
              'location_code',
              'source_location_code',
              'dest_location_code',
              'recommended_location_code',
              'ai_suggested_location_code',
              'source_scan_location',
              'dest_scan_location'
          )
          AND c.table_name NOT IN ('locations', 'material_default_locations')
    LOOP
        EXECUTE format(
            'UPDATE %I SET %I = NULL WHERE %I IN (SELECT location_code FROM tmp_target_locations)',
            rec.table_name,
            rec.column_name,
            rec.column_name
        );
    END LOOP;

    -- Null out direct location-id references.
    FOR rec IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.column_name IN ('location_id', 'recommended_location_id')
          AND c.table_name <> 'locations'
    LOOP
        EXECUTE format(
            'UPDATE %I SET %I = NULL WHERE %I IN (SELECT id FROM tmp_target_locations)',
            rec.table_name,
            rec.column_name,
            rec.column_name
        );
    END LOOP;

    DELETE FROM locations l
    USING tmp_target_locations t
    WHERE l.id = t.id;
END $$;
