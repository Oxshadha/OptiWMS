-- Update existing inventory records with planning fields from CSV data
-- This migration will be run after CSV import to populate missing fields
-- Note: This is a data migration that should be run manually or after CSV import

-- The CSV import should handle this, but this migration ensures any existing records
-- that were created before V20 migration get updated when CSV is re-imported

-- No SQL needed here - the CSV importer handles all field updates
-- This migration file exists to document that V20 added the columns
-- and CSV import populates them

-- If you need to backfill data, you would:
-- 1. Re-run CSV import which will update existing records
-- 2. Or manually update records based on material_code matching

COMMENT ON TABLE inventory IS 'Inventory table with all planning fields from Active stock.csv. Fields are populated via CSV import.';
