-- Canonical storage location format:
-- AREA-ROW-BAY-LEVEL-BIN => A-01-003-2-B
-- Row: 2 digits, Bay: 3 digits, Level: 1-10, Bin: single uppercase letter

DROP TABLE IF EXISTS tmp_location_code_map;
CREATE TEMP TABLE tmp_location_code_map (
    old_code VARCHAR(50) PRIMARY KEY,
    new_code VARCHAR(50) NOT NULL
) ON COMMIT DROP;

-- Parse "new-style" hybrid codes such as C-RFW-01-003-2-B and
-- fold them into canonical area-row-bay-level-bin columns.
UPDATE locations l
SET area = p.parts[1],
    row_number = LPAD((p.parts[3])::INT::TEXT, 2, '0'),
    bay_number = LPAD((p.parts[4])::INT::TEXT, 3, '0'),
    level_number = (p.parts[5])::INT,
    bin_position = UPPER(SUBSTRING(p.parts[6] FROM 1 FOR 1))
FROM (
    SELECT id, regexp_match(location_code, '^([A-Z])-([A-Z]{2,5})-([0-9]{1,2})-([0-9]{1,3})-([0-9]{1,2})-([A-Z])$') AS parts
    FROM locations
    WHERE zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage'
) p
WHERE l.id = p.id
  AND p.parts IS NOT NULL;

-- Parse classic V26-style codes such as A-01-02-3-B.
UPDATE locations l
SET area = p.parts[1],
    row_number = LPAD((p.parts[2])::INT::TEXT, 2, '0'),
    bay_number = LPAD((p.parts[3])::INT::TEXT, 3, '0'),
    level_number = (p.parts[4])::INT,
    bin_position = UPPER(SUBSTRING(p.parts[5] FROM 1 FOR 1))
FROM (
    SELECT id, regexp_match(location_code, '^([A-Z])-([0-9]{1,2})-([0-9]{1,3})-([0-9]{1,2})-([A-Z])$') AS parts
    FROM locations
    WHERE zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage'
) p
WHERE l.id = p.id
  AND p.parts IS NOT NULL;

-- Final structural normalization for storage slots.
UPDATE locations
SET area = COALESCE(NULLIF(UPPER(SUBSTRING(TRIM(area) FROM 1 FOR 1)), ''), 'C'),
    row_number = CASE
        WHEN COALESCE(row_number, '') ~ '^[0-9]+$' THEN LPAD((row_number::INT)::TEXT, 2, '0')
        ELSE '01'
    END,
    bay_number = CASE
        WHEN COALESCE(bay_number, '') ~ '^[0-9]+$' THEN LPAD((bay_number::INT)::TEXT, 3, '0')
        ELSE '001'
    END,
    level_number = CASE
        WHEN level_number BETWEEN 1 AND 10 THEN level_number
        ELSE 1
    END,
    bin_position = CASE
        WHEN COALESCE(bin_position, '') ~ '^[A-Za-z]$' THEN UPPER(bin_position)
        ELSE 'A'
    END
WHERE zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage';

-- Build old->new location code map for storage rows.
INSERT INTO tmp_location_code_map(old_code, new_code)
SELECT
    location_code AS old_code,
    FORMAT('%s-%s-%s-%s-%s', area, row_number, bay_number, level_number, bin_position) AS new_code
FROM locations
WHERE (zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage')
  AND location_code IS DISTINCT FROM FORMAT('%s-%s-%s-%s-%s', area, row_number, bay_number, level_number, bin_position);

-- Fail fast if normalization would create code collisions.
DO $$
DECLARE
    duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT new_code
        FROM tmp_location_code_map
        GROUP BY new_code
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Location code normalization would create % duplicate canonical codes. Resolve conflicting slots first.', duplicate_count;
    END IF;
END $$;

-- Update all location-code references in public schema.
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name <> 'locations'
          AND column_name IN (
              'location_code',
              'source_location_code',
              'dest_location_code',
              'recommended_location_code',
              'ai_suggested_location_code'
          )
    LOOP
        EXECUTE FORMAT(
            'UPDATE %I.%I t SET %I = m.new_code FROM tmp_location_code_map m WHERE t.%I = m.old_code',
            rec.table_schema,
            rec.table_name,
            rec.column_name,
            rec.column_name
        );
    END LOOP;
END $$;

-- Update primary locations table last.
UPDATE locations l
SET location_code = m.new_code
FROM tmp_location_code_map m
WHERE l.location_code = m.old_code;

-- Enforce canonical storage-code format.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS chk_location_code_format;
ALTER TABLE locations
    ADD CONSTRAINT chk_location_code_format
    CHECK (
        NOT (zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage')
        OR location_code ~ '^[A-Z]-[0-9]{2}-[0-9]{3}-[0-9]{1,2}-[A-Z]$'
    );

-- Enforce structural uniqueness for storage slots.
CREATE UNIQUE INDEX IF NOT EXISTS ux_locations_storage_slot
    ON locations (warehouse_id, area, row_number, bay_number, level_number, bin_position)
    WHERE zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage';
