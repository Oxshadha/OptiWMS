-- Holds the destinations planned for an inbound line so the space is actually reserved.
--
-- The admin's "Check capacity" step planned every line against identical warehouse state and
-- persisted nothing, so two lines of one PO -- and every concurrent order -- were told the same
-- bin was free. By the time the goods arrived and a worker walked to the rack, the promise made
-- at order creation had never been binding on anything.
--
-- A row here is a claim on pallet slots in one bin for one order line. Bin occupancy is read as
-- physical stock plus open putaway tasks plus these claims, so nothing else is offered the space.
CREATE TABLE IF NOT EXISTS inbound_putaway_allocation (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    order_item_id   uuid NOT NULL REFERENCES order_items (id) ON DELETE CASCADE,
    warehouse_id    uuid NOT NULL,
    material_id     uuid NOT NULL,
    location_code   varchar(50) NOT NULL,
    quantity        integer NOT NULL CHECK (quantity > 0),
    pallets         integer NOT NULL CHECK (pallets > 0),
    -- planned:   claimed at order creation, no task exists yet
    -- tasked:    putaway tasks now carry the claim; the task is the reservation from here on
    -- fulfilled: stock is physically in the bin and counted as inventory
    -- released:  order cancelled, line removed, or the plan was superseded
    status          varchar(20) NOT NULL DEFAULT 'planned',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inbound_putaway_allocation_status_check
        CHECK (status IN ('planned', 'tasked', 'fulfilled', 'released'))
);

-- Occupancy is read per bin filtered to live claims; this is the hot path for every capacity check.
CREATE INDEX IF NOT EXISTS idx_inbound_putaway_allocation_live
    ON inbound_putaway_allocation (warehouse_id, location_code)
    WHERE status = 'planned';

-- Release and reconciliation both work a line or an order at a time.
CREATE INDEX IF NOT EXISTS idx_inbound_putaway_allocation_item
    ON inbound_putaway_allocation (order_item_id);

CREATE INDEX IF NOT EXISTS idx_inbound_putaway_allocation_order
    ON inbound_putaway_allocation (order_id);
