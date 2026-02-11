-- Normalize legacy material descriptions that were imported with packed metadata
-- Example legacy value: "Flour 10kg,raw_material,kg,pallet"
-- Keep only the human-readable name when trailing segments are metadata tokens.

UPDATE materials
SET description = btrim(split_part(description, ',', 1)),
    updated_at = NOW()
WHERE description LIKE '%,%'
  AND btrim(split_part(description, ',', 1)) <> ''
  AND (
    lower(btrim(split_part(description, ',', 2))) IN (
      'raw_material',
      'raw material',
      'packing_material',
      'packaging_material',
      'product'
    )
    OR lower(btrim(split_part(description, ',', 3))) IN (
      'kg',
      'g',
      'gram',
      'grams',
      'l',
      'liter',
      'litre',
      'ml',
      'pcs',
      'pc',
      'unit',
      'box',
      'pallet'
    )
    OR lower(btrim(split_part(description, ',', 4))) IN (
      'pallet',
      'shelf',
      'bin',
      'rack',
      'bulk',
      'carton',
      'container'
    )
  );
