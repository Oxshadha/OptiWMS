-- Remove duplicate inventory rows within the same logical inventory bucket.
-- Keep the most recently updated row for each bucket.
WITH ranked_inventory AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY
                material_id,
                warehouse_id,
                COALESCE(location_code, ''),
                COALESCE(lpn_code, ''),
                COALESCE(batch_number, ''),
                COALESCE(expiry_date, DATE '0001-01-01')
            ORDER BY
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST,
                id DESC
        ) AS rn
    FROM inventory
),
duplicates AS (
    SELECT id
    FROM ranked_inventory
    WHERE rn > 1
)
DELETE FROM inventory i
USING duplicates d
WHERE i.id = d.id;

-- Enforce uniqueness for logical inventory bucket keys.
-- Expression-based unique index is used so NULL values are normalized.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_bucket_expr
    ON inventory (
        material_id,
        warehouse_id,
        COALESCE(location_code, ''),
        COALESCE(lpn_code, ''),
        COALESCE(batch_number, ''),
        COALESCE(expiry_date, DATE '0001-01-01')
    );
