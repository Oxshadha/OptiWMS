-- Inbound receipts were recorded in order_items.picked_quantity, a column outbound picking also
-- writes. Sharing it meant the inbound list could not distinguish "picked for despatch" from
-- "received from a supplier", and there was no honest per-line received figure to show progress
-- against. Give inbound its own column.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS received_quantity INTEGER NOT NULL DEFAULT 0;

-- Carry across what the shared column already recorded for inbound lines.
UPDATE order_items oi
   SET received_quantity = COALESCE(oi.picked_quantity, 0)
  FROM orders o
 WHERE o.id = oi.order_id
   AND LOWER(o.order_type) = 'inbound'
   AND COALESCE(oi.picked_quantity, 0) > 0;

-- Seeded history closed its orders without ever running the receiving flow, so those lines carry
-- no received figure at all. An order in a terminal inbound state has, by definition, taken its
-- stock in; leaving them at zero would render every completed order as 0% received.
UPDATE order_items oi
   SET received_quantity = oi.quantity
  FROM orders o
 WHERE o.id = oi.order_id
   AND LOWER(o.order_type) = 'inbound'
   AND oi.received_quantity = 0
   AND LOWER(o.status) IN ('received', 'completed', 'fulfilled', 'put_away');

CREATE INDEX IF NOT EXISTS idx_order_items_received
    ON order_items (order_id, received_quantity);
