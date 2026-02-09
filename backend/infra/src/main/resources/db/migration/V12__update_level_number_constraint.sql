-- V12: Update Level Number Constraint
-- Fixes constraint to allow levels 1-10 (was 1-4) to support 5-level rack systems

-- Drop existing constraint
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_level_number_check;

-- Add new constraint allowing levels 1-10
ALTER TABLE locations ADD CONSTRAINT locations_level_number_check CHECK (level_number BETWEEN 1 AND 10);

COMMENT ON CONSTRAINT locations_level_number_check ON locations IS 'Allows rack levels 1-10 (updated from 1-4 to support taller rack systems)';

