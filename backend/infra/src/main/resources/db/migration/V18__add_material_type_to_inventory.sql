-- OptiWMS Database Migration
-- Version 18: Add material_type to inventory table for filtering
-- Industry Best Practice: Denormalize material_type for performance
-- This allows filtering inventory by material type without joins

-- ============================================
-- ADD MATERIAL_TYPE COLUMN TO INVENTORY
-- ============================================

ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS material_type VARCHAR(20);

-- Populate material_type from materials table
UPDATE inventory i
SET material_type = COALESCE(m.material_type, 'raw_material')
FROM materials m
WHERE i.material_id = m.id;

-- Set default for any NULL values (safety check)
UPDATE inventory 
SET material_type = 'raw_material' 
WHERE material_type IS NULL;

-- Create index for filtering performance
CREATE INDEX IF NOT EXISTS idx_inventory_material_type 
  ON inventory(material_type);

-- Add comment for documentation
COMMENT ON COLUMN inventory.material_type IS 
  'Denormalized material type for filtering: raw_material, packaging_material, product. Synced from materials table.';

-- ============================================
-- CLASSIFY EXISTING MATERIALS
-- ============================================

-- Classify packaging materials based on description patterns
UPDATE materials
SET material_type = 'packaging_material'
WHERE material_type IS NULL 
  AND (
    LOWER(description) LIKE '%pouch%' OR
    LOWER(description) LIKE '%pe back%' OR
    LOWER(description) LIKE '%sheet%' OR
    LOWER(description) LIKE '%woven%' OR
    LOWER(description) LIKE '%paper%' OR
    LOWER(description) LIKE '%reel%' OR
    LOWER(description) LIKE '%tape%' OR
    LOWER(unit_type) LIKE '%reel%'
  );

-- Set remaining NULL materials as raw_material
UPDATE materials
SET material_type = 'raw_material'
WHERE material_type IS NULL;

-- Update inventory material_type to match materials
UPDATE inventory i
SET material_type = m.material_type
FROM materials m
WHERE i.material_id = m.id;

-- ============================================
-- VALIDATION
-- ============================================

-- Ensure no NULL material_type remains
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM inventory WHERE material_type IS NULL) THEN
        RAISE EXCEPTION 'Some inventory items still have NULL material_type';
    END IF;
    
    IF EXISTS (SELECT 1 FROM materials WHERE material_type IS NULL) THEN
        RAISE EXCEPTION 'Some materials still have NULL material_type';
    END IF;
END $$;
