-- Putaway tasks used to be numbered PUT-<order item uuid>-<pallet>, which reads as an
-- opaque 42-character string in the task list and tells a worker nothing. Rewrite the
-- already-issued ones into the same shape the application now generates:
--   PUT-<order number>-<last 6 hex of the order item id>-<pallet sequence>
-- Only rows still carrying the uuid form are touched, and only when the new number is
-- free, so the unique constraint on task_number cannot be violated.
UPDATE tasks t
SET task_number = candidate.new_number,
    updated_at = now()
FROM (
    SELECT
        t2.id AS task_id,
        left(
            'PUT-' || o.order_number || '-'
                || upper(right(replace(oi.id::text, '-', ''), 6)) || '-'
                || COALESCE(t2.handling_unit_seq, 1),
            50
        ) AS new_number
    FROM tasks t2
    JOIN order_items oi ON oi.id = t2.reference_id
    JOIN orders o ON o.id = oi.order_id
    WHERE t2.task_type = 'putaway'
      AND t2.reference_type = 'order_item'
      AND o.order_number IS NOT NULL
      AND t2.task_number ~ '^PUT-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+$'
) AS candidate
WHERE t.id = candidate.task_id
  AND NOT EXISTS (
      SELECT 1 FROM tasks existing
      WHERE existing.task_number = candidate.new_number
        AND existing.id <> candidate.task_id
  );
