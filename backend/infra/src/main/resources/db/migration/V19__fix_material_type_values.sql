-- OptiWMS Database Migration
-- Version 19: Fix material_type inconsistencies and add constraints
-- Industry Best Practice: Normalize data and enforce constraints

-- ============================================
-- FIX EXISTING DATA INCONSISTENCIES
-- ============================================

-- Fix any "packing_material" (without 'g') to "packaging_material" (with 'g')
UPDATE materials
SET material_type = 'packaging_material'
WHERE material_type = 'packing_material';

-- Fix any "packaging" to "packaging_material"
UPDATE materials
SET material_type = 'packaging_material'
WHERE material_type = 'packaging';

-- Fix any "raw" to "raw_material"
UPDATE materials
SET material_type = 'raw_material'
WHERE material_type = 'raw';

-- Fix any "product" variations
UPDATE materials
SET material_type = 'product'
WHERE material_type IN ('finished_good', 'finished_goods', 'finished_product', 'products');

-- Set default for any remaining invalid values
UPDATE materials
SET material_type = 'raw_material'
WHERE material_type IS NULL 
   OR material_type NOT IN ('raw_material', 'packaging_material', 'product');

-- ============================================
-- FIX INVENTORY TABLE
-- ============================================

-- Fix inventory table material_type values
UPDATE inventory
SET material_type = 'packaging_material'
WHERE material_type = 'packing_material';

UPDATE inventory
SET material_type = 'packaging_material'
WHERE material_type = 'packaging';

UPDATE inventory
SET material_type = 'raw_material'
WHERE material_type = 'raw';

UPDATE inventory
SET material_type = 'product'
WHERE material_type IN ('finished_good', 'finished_goods', 'finished_product', 'products');

-- Sync inventory material_type from materials table (denormalized)
UPDATE inventory i
SET material_type = COALESCE(m.material_type, 'raw_material')
FROM materials m
WHERE i.material_id = m.id;

-- Set default for any remaining NULL values
UPDATE inventory
SET material_type = 'raw_material'
WHERE material_type IS NULL;

-- ============================================
-- ADD DATABASE CONSTRAINT (CHECK CONSTRAINT)
-- ============================================

-- Add check constraint to materials table to enforce valid values
ALTER TABLE materials
  DROP CONSTRAINT IF EXISTS chk_material_type_valid;

ALTER TABLE materials
  ADD CONSTRAINT chk_material_type_valid 
  CHECK (material_type IN ('raw_material', 'packaging_material', 'product'));

-- Add check constraint to inventory table
ALTER TABLE inventory
  DROP CONSTRAINT IF EXISTS chk_inventory_material_type_valid;

ALTER TABLE inventory
  ADD CONSTRAINT chk_inventory_material_type_valid 
  CHECK (material_type IN ('raw_material', 'packaging_material', 'product'));

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN materials.material_type IS 
  'Material type: raw_material, packaging_material, or product. Enforced by CHECK constraint.';

COMMENT ON COLUMN inventory.material_type IS 
  'Denormalized material type for filtering: raw_material, packaging_material, or product. Synced from materials table. Enforced by CHECK constraint.';
