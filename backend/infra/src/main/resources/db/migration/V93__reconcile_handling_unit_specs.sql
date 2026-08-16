-- V93: Reconcile contradictory handling-unit master data.
--
-- Two earlier migrations derived packaging fields from different generations of
-- materials.pallet_spaces and left them disagreeing:
--   * V48 set max_pallet_weight_kg from weight_kg * pallet_spaces (clamped 250..1250).
--   * V69 copied the then-current pallet_spaces into BOTH units_per_handling_unit and
--     order_multiple.
-- For material 100037 that produced a "handling unit" of 243 units x 25 kg = 6075 kg
-- against a max_pallet_weight_kg of 255.15 kg — a pallet 25x heavier than its own limit,
-- and an order multiple of 243 that forced every order to that impossible size.
--
-- This migration makes the three fields describe the same physical pallet again.

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'v93_impossible_handling_units', COUNT(*)
FROM materials
WHERE weight_kg IS NOT NULL
  AND weight_kg > 0
  AND units_per_handling_unit IS NOT NULL
  AND max_pallet_weight_kg IS NOT NULL
  AND max_pallet_weight_kg > 0
  AND units_per_handling_unit * weight_kg > max_pallet_weight_kg;

-- 1) Recompute the pallet weight ceiling from the physical pallet, capped by the SOP
-- limits from V15 (raw materials 1500 kg, packing materials 1000 kg).
UPDATE materials
SET max_pallet_weight_kg = LEAST(
        ROUND((weight_kg * units_per_pallet)::numeric, 2),
        CASE material_type
            WHEN 'raw_material' THEN 1500.0
            WHEN 'packing_material' THEN 1000.0
            ELSE 1500.0
        END
    )
WHERE weight_kg IS NOT NULL
  AND weight_kg > 0
  AND units_per_pallet IS NOT NULL
  AND units_per_pallet > 0
  AND LOWER(COALESCE(storage_type, '')) <> 'bulk';

-- 2) A handling unit heavier than its own pallet limit cannot be built. Shrink it to
-- what actually fits on one pallet.
UPDATE materials
SET units_per_handling_unit = GREATEST(FLOOR(max_pallet_weight_kg / weight_kg), 1)
WHERE weight_kg IS NOT NULL
  AND weight_kg > 0
  AND max_pallet_weight_kg IS NOT NULL
  AND max_pallet_weight_kg > 0
  AND units_per_handling_unit IS NOT NULL
  AND units_per_handling_unit * weight_kg > max_pallet_weight_kg;

-- 3) V69 defaulted handling_unit_type from unit_type, which rendered as the meaningless
-- "Units/unit" in the ordering UI. Pallet-stored materials are handled as pallets.
UPDATE materials
SET handling_unit_type = 'pallet'
WHERE LOWER(COALESCE(storage_type, '')) = 'pallet'
  AND (handling_unit_type IS NULL OR LOWER(handling_unit_type) IN ('unit', 'units', 'pcs'));

-- 4) Order multiple is a supplier pack quantity, not the pallet quantity. V69 copied
-- pallet_spaces into it, which is why a 3-unit request rounded up to 243. Where it was
-- only ever a copy of the pallet size, fall back to the minimum order quantity.
UPDATE materials
SET order_multiple = COALESCE(NULLIF(min_order_quantity, 0), 1)
WHERE order_multiple IS NOT NULL
  AND pallet_spaces IS NOT NULL
  AND order_multiple = pallet_spaces
  AND order_multiple > COALESCE(NULLIF(min_order_quantity, 0), 1);

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'v93_impossible_handling_units', COUNT(*)
FROM materials
WHERE weight_kg IS NOT NULL
  AND weight_kg > 0
  AND units_per_handling_unit IS NOT NULL
  AND max_pallet_weight_kg IS NOT NULL
  AND max_pallet_weight_kg > 0
  AND units_per_handling_unit * weight_kg > max_pallet_weight_kg;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'v93_materials_with_coherent_pallet_specs', COUNT(*)
FROM materials
WHERE max_pallet_weight_kg IS NOT NULL
  AND units_per_handling_unit IS NOT NULL
  AND units_per_pallet IS NOT NULL;
