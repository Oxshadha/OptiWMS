-- V48: Derive realistic pallet specs from existing planning data in inventory table.
-- Replaces fallback defaults (e.g., pallet_spaces=1) with data-driven values.

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'v48_pallet_spaces_eq_1', COUNT(*)
FROM materials
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND COALESCE(pallet_spaces, 0) = 1;

-- 1) Derive units-per-pallet from planning data: quantity / pallet_requirement.
-- Use average per material and round up to nearest integer.
WITH inferred AS (
    SELECT
        i.material_id,
        CEIL(AVG(i.quantity / NULLIF(i.pallet_requirement, 0)))::numeric(10,2) AS inferred_units_per_pallet
    FROM inventory i
    WHERE i.quantity IS NOT NULL
      AND i.quantity > 0
      AND i.pallet_requirement IS NOT NULL
      AND i.pallet_requirement > 0
    GROUP BY i.material_id
)
UPDATE materials m
SET pallet_spaces = inf.inferred_units_per_pallet
FROM inferred inf
WHERE m.id = inf.material_id
  AND LOWER(COALESCE(m.storage_type, '')) = 'pallet'
  AND (
      m.pallet_spaces IS NULL
      OR m.pallet_spaces = 1
      OR m.pallet_spaces <= 0
  );

-- 2) For bulk materials, pallet specs are not applicable.
UPDATE materials
SET pallet_spaces = NULL,
    max_pallet_weight_kg = NULL
WHERE LOWER(COALESCE(storage_type, '')) = 'bulk';

-- 3) Recalculate max pallet weight from unit weight * units-per-pallet.
-- Clamp to realistic floor/ceiling to avoid extreme noise.
UPDATE materials
SET max_pallet_weight_kg = LEAST(
    1250::numeric,
    GREATEST(250::numeric, ROUND((weight_kg * pallet_spaces * 1.05)::numeric, 2))
)
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND weight_kg IS NOT NULL
  AND weight_kg > 0
  AND pallet_spaces IS NOT NULL
  AND pallet_spaces > 0;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'v48_pallet_spaces_eq_1', COUNT(*)
FROM materials
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND COALESCE(pallet_spaces, 0) = 1;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'v48_pallet_materials_with_derived_specs', COUNT(*)
FROM materials
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND pallet_spaces IS NOT NULL
  AND max_pallet_weight_kg IS NOT NULL;
