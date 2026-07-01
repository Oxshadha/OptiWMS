CREATE TABLE IF NOT EXISTS order_number_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    alias_order_number VARCHAR(80) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS handling_unit_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS units_per_handling_unit NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS order_multiple NUMERIC(15, 2);

ALTER TABLE supplier_materials
    ADD COLUMN IF NOT EXISTS minimum_order_quantity NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS order_multiple NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS units_per_handling_unit NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS lead_time_days INTEGER,
    ADD COLUMN IF NOT EXISTS preferred BOOLEAN DEFAULT FALSE;

UPDATE materials
SET handling_unit_type = COALESCE(handling_unit_type, unit_type, 'pcs'),
    units_per_handling_unit = COALESCE(units_per_handling_unit, pallet_spaces, 1),
    order_multiple = COALESCE(order_multiple, pallet_spaces, min_order_quantity, 1)
WHERE handling_unit_type IS NULL
   OR units_per_handling_unit IS NULL
   OR order_multiple IS NULL;

INSERT INTO order_number_aliases (order_id, alias_order_number)
SELECT id, order_number
FROM orders
WHERE order_number IS NOT NULL
  AND (
      (LOWER(order_type) = 'inbound' AND order_number !~ '^PO-[0-9]{8}-[0-9]{6}$')
      OR
      (LOWER(order_type) = 'outbound' AND order_number !~ '^SO-[0-9]{8}-[0-9]{6}$')
  )
ON CONFLICT (alias_order_number) DO NOTHING;

WITH inbound AS (
    SELECT id,
           'PO-' || TO_CHAR(COALESCE(order_date, CURRENT_DATE), 'YYYYMMDD') || '-' ||
           LPAD((
                ROW_NUMBER() OVER (PARTITION BY COALESCE(order_date, CURRENT_DATE) ORDER BY created_at, id)
                + (
                    SELECT COALESCE(MAX(RIGHT(existing.order_number, 6)::INTEGER), 0)
                    FROM orders existing
                    WHERE LOWER(existing.order_type) = 'inbound'
                      AND COALESCE(existing.order_date, CURRENT_DATE) = COALESCE(orders.order_date, CURRENT_DATE)
                      AND existing.order_number ~ '^PO-[0-9]{8}-[0-9]{6}$'
                )
           )::TEXT, 6, '0') AS next_number
    FROM orders
    WHERE LOWER(order_type) = 'inbound'
      AND order_number !~ '^PO-[0-9]{8}-[0-9]{6}$'
)
UPDATE orders o
SET order_number = inbound.next_number
FROM inbound
WHERE o.id = inbound.id;

WITH outbound AS (
    SELECT id,
           'SO-' || TO_CHAR(COALESCE(order_date, CURRENT_DATE), 'YYYYMMDD') || '-' ||
           LPAD((
                ROW_NUMBER() OVER (PARTITION BY COALESCE(order_date, CURRENT_DATE) ORDER BY created_at, id)
                + (
                    SELECT COALESCE(MAX(RIGHT(existing.order_number, 6)::INTEGER), 0)
                    FROM orders existing
                    WHERE LOWER(existing.order_type) = 'outbound'
                      AND COALESCE(existing.order_date, CURRENT_DATE) = COALESCE(orders.order_date, CURRENT_DATE)
                      AND existing.order_number ~ '^SO-[0-9]{8}-[0-9]{6}$'
                )
           )::TEXT, 6, '0') AS next_number
    FROM orders
    WHERE LOWER(order_type) = 'outbound'
      AND order_number !~ '^SO-[0-9]{8}-[0-9]{6}$'
)
UPDATE orders o
SET order_number = outbound.next_number
FROM outbound
WHERE o.id = outbound.id;

UPDATE orders
SET notes = CONCAT_WS(E'\n', NULLIF(notes, ''), 'DATA_QUALITY: Missing supplier for inbound order.')
WHERE LOWER(order_type) = 'inbound'
  AND supplier_id IS NULL
  AND COALESCE(notes, '') NOT LIKE '%DATA_QUALITY: Missing supplier%';

UPDATE orders o
SET notes = CONCAT_WS(E'\n', NULLIF(o.notes, ''), 'DATA_QUALITY: Invalid or missing warehouse reference.')
WHERE (o.warehouse_id IS NULL OR NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id = o.warehouse_id))
  AND COALESCE(o.notes, '') NOT LIKE '%DATA_QUALITY: Invalid or missing warehouse%';
