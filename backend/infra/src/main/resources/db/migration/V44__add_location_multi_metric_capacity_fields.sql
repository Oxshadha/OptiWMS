-- Add multi-metric capacity fields for bin/rack putaway planning.
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS max_weight_kg DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS max_volume_cm3 DECIMAL(18,2),
    ADD COLUMN IF NOT EXISTS max_lpn_count INTEGER;

COMMENT ON COLUMN locations.max_weight_kg IS 'Maximum allowed total weight (kg) for this location/bin.';
COMMENT ON COLUMN locations.max_volume_cm3 IS 'Maximum allowed total occupied volume (cm3) for this location/bin.';
COMMENT ON COLUMN locations.max_lpn_count IS 'Maximum allowed active LPN count for this location/bin.';
