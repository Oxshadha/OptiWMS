-- Normalize packaging material classification and repair legacy SKU codes
-- Safety goals:
-- 1) Never change material IDs (all references remain intact).
-- 2) Reclassify known packing consumables from raw_material -> packaging_material.
-- 3) Update only clearly bad SKU values where SKU is effectively the same as description.

-- Reclassify known packing materials.
UPDATE materials
SET material_type = 'packaging_material',
    updated_at = NOW()
WHERE
    (
        upper(material_code) IN ('BOX-SMALL', 'BOX-LARGE', 'BAG-PLASTIC')
        OR lower(description) IN ('small box', 'large box', 'plastic bag')
    )
    AND material_type <> 'packaging_material';

-- Repair legacy SKU codes where code is just the product name.
-- Example: material_code "Small Box" + description "Small Box" -> "SKU-<id8>"
-- Keep numeric ERP-style codes (e.g. 101300) unchanged.
WITH normalized AS (
    SELECT
        m.id,
        m.material_code,
        m.description,
        ('SKU-' || upper(substr(replace(m.id::text, '-', ''), 1, 8))) AS generated_code
    FROM materials m
    WHERE
        m.material_code IS NOT NULL
        AND m.description IS NOT NULL
        AND m.material_code !~ '^[0-9]{5,}$'
        AND lower(regexp_replace(m.material_code, '[^a-zA-Z0-9]+', '', 'g'))
            = lower(regexp_replace(m.description, '[^a-zA-Z0-9]+', '', 'g'))
)
UPDATE materials m
SET material_code = n.generated_code,
    updated_at = NOW()
FROM normalized n
WHERE m.id = n.id
  AND NOT EXISTS (
      SELECT 1
      FROM materials existing
      WHERE existing.material_code = n.generated_code
        AND existing.id <> n.id
  );

-- Keep denormalized inventory material_type in sync with materials table.
UPDATE inventory i
SET material_type = m.material_type
FROM materials m
WHERE i.material_id = m.id
  AND (i.material_type IS DISTINCT FROM m.material_type);
