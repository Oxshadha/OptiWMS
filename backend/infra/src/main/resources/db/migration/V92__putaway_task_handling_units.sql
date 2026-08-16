-- V92: One putaway task per handling unit (pallet) instead of one per order line.
--
-- A 243-unit inbound line at ~10 units/pallet is 25 physical pallet moves. The system
-- already computed that split in PutawayCapacityPlanningService, then collapsed it to a
-- single task pointing at a single bin. Tasks now carry the pallet sequence, so the
-- idempotency invariant from V84 has to widen to match.

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS handling_unit_seq INTEGER;

-- Existing putaway tasks are the single task that used to represent the whole line.
-- Seeding them as pallet 1 keeps in-flight work addressable and idempotent.
UPDATE tasks
SET handling_unit_seq = 1
WHERE task_type = 'putaway'
  AND handling_unit_seq IS NULL;

ALTER TABLE tasks
    ALTER COLUMN handling_unit_seq SET DEFAULT 1;

-- Replace the V84 invariant: uniqueness is now per (order item, pallet), not per order item.
DROP INDEX IF EXISTS uq_tasks_putaway_order_item;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_putaway_order_item_hu
    ON tasks (task_type, reference_type, reference_id, handling_unit_seq)
    WHERE task_type = 'putaway'
      AND reference_type = 'order_item'
      AND reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_putaway_reference
    ON tasks (reference_type, reference_id)
    WHERE task_type = 'putaway';
