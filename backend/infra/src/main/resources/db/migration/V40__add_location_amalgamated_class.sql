-- Add optional amalgamated slotting class to locations.
-- Example values: AF, AM, AS, BF, BM, BS, CF, CM, CS
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS amalgamated_class VARCHAR(2);

-- Allow only valid class values or NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_locations_amalgamated_class'
    ) THEN
        ALTER TABLE locations
        ADD CONSTRAINT chk_locations_amalgamated_class
        CHECK (
            amalgamated_class IS NULL
            OR amalgamated_class IN ('AF','AM','AS','BF','BM','BS','CF','CM','CS')
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_locations_amalgamated_class ON locations(amalgamated_class);

COMMENT ON COLUMN locations.amalgamated_class IS
'Slotting class label (AF/AM/AS/BF/BM/BS/CF/CM/CS) used for manual zone strategy until demand forecasting is active.';
