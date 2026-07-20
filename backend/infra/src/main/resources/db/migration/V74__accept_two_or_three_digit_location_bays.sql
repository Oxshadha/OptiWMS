-- PROJECT_OPERATIONAL_BASELINE uses compact two-digit bay identifiers while
-- existing imported layouts may use three digits. Preserve the structural
-- location-code contract and accept both representations.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS chk_location_code_format;

ALTER TABLE locations
    ADD CONSTRAINT chk_location_code_format
    CHECK (
        NOT (
            zone_type = 'STORAGE'
            OR lower(COALESCE(location_type, '')) = 'storage'
        )
        OR location_code ~ '^[A-Z]-[0-9]{2}-[0-9]{2,3}-[0-9]{1,2}-[A-Z]$'
    );

COMMENT ON CONSTRAINT chk_location_code_format ON locations IS
    'Storage locations use Z-RR-BB[B]-L-P; two- and three-digit bay identifiers are supported.';
