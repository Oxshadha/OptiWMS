-- Standardize selected demo material codes to numeric SKUs (109xxx series)
-- Safety:
-- 1) Keep material IDs unchanged (all FK references remain intact).
-- 2) Update only selected 6 demo materials.
-- 3) Guarantee no SKU duplicates with existing material_code values.

DO $$
DECLARE
    target_id UUID;
    next_code BIGINT := 109000;
    assigned_code TEXT;
BEGIN
    -- Process only the 6 target materials (by known current code/description patterns).
    FOR target_id IN
        SELECT id
        FROM materials
        WHERE
            upper(material_code) IN (
                'RICE-5KG',
                'BOX-SMALL',
                'BOX-LARGE',
                'BAG-PLASTIC'
            )
            OR lower(description) IN (
                'rice 5kg bag',
                'small box',
                'large box',
                'plastic bag',
                'flour 10kg',
                'sugar 1kg'
            )
        ORDER BY created_at NULLS LAST, id
    LOOP
        -- Find next unused numeric 109xxx code
        LOOP
            assigned_code := next_code::TEXT;
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM materials WHERE material_code = assigned_code
            );
            next_code := next_code + 1;
        END LOOP;

        UPDATE materials
        SET material_code = assigned_code,
            updated_at = NOW()
        WHERE id = target_id;

        next_code := next_code + 1;
    END LOOP;
END $$;
