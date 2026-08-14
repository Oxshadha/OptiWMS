-- Hardens the canonical storage location_code format originally established in
-- V54.
--
-- These changes were authored against V54 directly on the manodya-dev branch.
-- V54 has already been applied on every existing environment, so editing it in
-- place would change its Flyway checksum and fail validate-on-migrate. The
-- improvements are therefore re-applied here as a forward migration.

-- Drop the constraint so any remaining legacy values can be rewritten.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS chk_location_code_format;

-- Safety net: rewrite any storage location_code not yet in canonical format.
UPDATE locations
SET location_code = FORMAT('%s-%s-%s-%s-%s', area, row_number, bay_number, level_number, bin_position)
WHERE (zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage')
  AND location_code !~ '^[A-Z]-[0-9]{2}-[0-9]{3}-[0-9]{1,2}-[A-Z]$'
  AND area IS NOT NULL
  AND row_number IS NOT NULL
  AND bay_number IS NOT NULL
  AND level_number IS NOT NULL
  AND bin_position IS NOT NULL;

-- Re-add the constraint, failing loudly rather than silently if any storage
-- location still holds a non-canonical code.
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM locations
    WHERE (zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage')
      AND location_code IS NOT NULL
      AND location_code !~ '^[A-Z]-[0-9]{2}-[0-9]{3}-[0-9]{1,2}-[A-Z]$';

    IF invalid_count <> 0 THEN
        RAISE EXCEPTION 'Cannot add chk_location_code_format: % storage locations have non-canonical codes', invalid_count;
    END IF;

    ALTER TABLE locations
        ADD CONSTRAINT chk_location_code_format
        CHECK (
            NOT (zone_type = 'STORAGE' OR LOWER(COALESCE(location_type, '')) = 'storage')
            OR location_code ~ '^[A-Z]-[0-9]{2}-[0-9]{3}-[0-9]{1,2}-[A-Z]$'
        );
END $$;
