-- Enterprise-style runtime bootstrap for forecast serving.
-- Purpose:
-- 1) Ensure a stable set of finished goods exists as materials.material_type='product'
-- 2) Ensure product inventory rows are tagged and have planning fields
-- 3) Ensure outbound SKU line history exists in order_items (idempotent)
--
-- Safe to re-run: operations are idempotent by design.

BEGIN;

-- Select candidate finished goods from inventory-backed materials.
WITH candidate_products AS (
    SELECT
        i.material_id
    FROM inventory i
    JOIN materials m ON m.id = i.material_id
    GROUP BY i.material_id
    ORDER BY SUM(COALESCE(i.quantity, 0)) DESC, MIN(m.material_code)
    LIMIT 120
)
UPDATE materials m
SET material_type = 'product'
WHERE m.id IN (SELECT material_id FROM candidate_products)
  AND COALESCE(LOWER(m.material_type), '') <> 'product';

-- Keep inventory denormalized material_type in sync for selected products.
WITH candidate_products AS (
    SELECT id AS material_id
    FROM materials
    WHERE LOWER(material_type) = 'product'
)
UPDATE inventory i
SET material_type = 'product'
WHERE i.material_id IN (SELECT material_id FROM candidate_products)
  AND COALESCE(LOWER(i.material_type), '') <> 'product';

-- Ensure essential planning fields exist for product inventory rows.
UPDATE inventory i
SET
    reorder_point = CASE
        WHEN COALESCE(i.reorder_point, 0) > 0 THEN i.reorder_point
        ELSE GREATEST(ROUND(COALESCE(i.quantity, 0) * 0.6), 1)
    END,
    max_stock = CASE
        WHEN COALESCE(i.max_stock, 0) > 0 THEN i.max_stock
        ELSE GREATEST(ROUND(COALESCE(i.quantity, 0) * 1.5), 2)
    END,
    buffer_stock = CASE
        WHEN COALESCE(i.buffer_stock, 0) > 0 THEN i.buffer_stock
        ELSE GREATEST(ROUND(COALESCE(i.quantity, 0) * 0.15), 1)
    END
FROM materials m
WHERE m.id = i.material_id
  AND LOWER(m.material_type) = 'product';

-- Ensure every outbound order has at least 3 SKU lines from product materials.
WITH outbound_orders AS (
    SELECT
        o.id,
        ROW_NUMBER() OVER (ORDER BY o.order_date, o.id) AS rn
    FROM orders o
    WHERE LOWER(COALESCE(o.order_type, '')) = 'outbound'
),
product_pool AS (
    SELECT
        m.id AS material_id,
        ROW_NUMBER() OVER (ORDER BY m.material_code, m.id) AS rn,
        COUNT(*) OVER () AS total
    FROM materials m
    WHERE LOWER(COALESCE(m.material_type, '')) = 'product'
),
seed_offsets AS (
    SELECT 0 AS off
    UNION ALL SELECT 1
    UNION ALL SELECT 2
),
target_pairs AS (
    SELECT
        o.id AS order_id,
        ((o.rn + s.off - 1) % p.total) + 1 AS target_rn,
        s.off
    FROM outbound_orders o
    CROSS JOIN seed_offsets s
    CROSS JOIN (SELECT MAX(total) AS total FROM product_pool) p
),
resolved_pairs AS (
    SELECT
        t.order_id,
        p.material_id,
        t.off
    FROM target_pairs t
    JOIN product_pool p ON p.rn = t.target_rn
),
missing_pairs AS (
    SELECT
        rp.order_id,
        rp.material_id,
        rp.off
    FROM resolved_pairs rp
    LEFT JOIN order_items oi
      ON oi.order_id = rp.order_id
     AND oi.material_id = rp.material_id
    WHERE oi.id IS NULL
)
INSERT INTO order_items (
    order_id,
    material_id,
    quantity,
    unit_price,
    picked_quantity,
    packed_quantity,
    status
)
SELECT
    mp.order_id,
    mp.material_id,
    10 + (mp.off * 5) AS quantity,
    100.00 + (mp.off * 25) AS unit_price,
    0 AS picked_quantity,
    0 AS packed_quantity,
    'pending' AS status
FROM missing_pairs mp;

COMMIT;
