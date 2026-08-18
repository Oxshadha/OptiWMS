-- Canonical storage location format:
-- AREA-ROW-BAY-LEVEL-BIN => A-01-003-2-B
-- Row: 2 digits, Bay: 3 digits, Level: 1-10, Bin: single uppercase letter

DROP TABLE IF EXISTS tmp_location_code_map;
CREATE TEMP TABLE tmp_location_code_map (
    old_code VARCHAR(50) PRIMARY KEY,
    new_code VARCHAR(50) NOT NULL
) ON COMMIT DROP;

DROP TABLE IF EXISTS tmp_location_code_ranked;
CREATE TEMP TABLE tmp_location_code_ranked (
    id UUID PRIMARY KEY,
    old_code VARCHAR(50) NOT NULL,
    new_code VARCHAR(50) NOT NULL,
    rn INTEGER NOT NULL
) ON COMMIT DROP;

-- Temporarily relax FK checks while code values are being rewritten.
ALTER TABLE material_default_locations DROP CONSTRAINT IF EXISTS material_default_locations_location_code_fkey;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_location_code_fkey;

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

-- Build ranked old->new mapping for storage rows.
-- For collisions on the same canonical new_code, keep one winner and drop losers.
INSERT INTO tmp_location_code_ranked(id, old_code, new_code, rn)
SELECT
    l.id,
    l.location_code AS old_code,
    FORMAT('%s-%s-%s-%s-%s', l.area, l.row_number, l.bay_number, l.level_number, l.bin_position) AS new_code,
    ROW_NUMBER() OVER (
        PARTITION BY FORMAT('%s-%s-%s-%s-%s', l.area, l.row_number, l.bay_number, l.level_number, l.bin_position)
        ORDER BY CASE WHEN l.location_code = FORMAT('%s-%s-%s-%s-%s', l.area, l.row_number, l.bay_number, l.level_number, l.bin_position) THEN 0 ELSE 1 END,
                 l.id
    ) AS rn
FROM locations l
WHERE (l.zone_type = 'STORAGE' OR LOWER(COALESCE(l.location_type, '')) = 'storage');

INSERT INTO tmp_location_code_map(old_code, new_code)
SELECT old_code, new_code
FROM tmp_location_code_ranked
WHERE old_code IS DISTINCT FROM new_code;

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

-- Drop the legacy format check before rewriting any codes.
--
-- V26 adds this constraint conditionally -- only when every existing row already
-- matched the old two-digit-bay format. On a database whose data was dirty at
-- that point the constraint was skipped, so the rewrite below succeeded. On a
-- clean one it is present and rejects the three-digit codes this migration
-- exists to introduce, which meant the chain only applied to databases that had
-- previously been broken. Dropping first makes the outcome identical either way.
-- The constraint is re-added in its canonical form further down.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS chk_location_code_format;

-- Remove duplicate rows that map to the same canonical storage slot.
DELETE FROM locations l
USING tmp_location_code_ranked r
WHERE l.id = r.id
  AND r.rn > 1;

-- Update remaining primary locations to canonical code.
UPDATE locations l
SET location_code = r.new_code
FROM tmp_location_code_ranked r
WHERE l.id = r.id
  AND r.rn = 1
  AND l.location_code IS DISTINCT FROM r.new_code;

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

-- Restore location-code foreign keys after normalization.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'material_default_locations_location_code_fkey'
    ) THEN
        ALTER TABLE material_default_locations
            ADD CONSTRAINT material_default_locations_location_code_fkey
            FOREIGN KEY (location_code) REFERENCES locations(location_code) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'inventory_location_code_fkey'
    ) THEN
        ALTER TABLE inventory
            ADD CONSTRAINT inventory_location_code_fkey
            FOREIGN KEY (location_code) REFERENCES locations(location_code) ON DELETE SET NULL;
    END IF;
END $$;