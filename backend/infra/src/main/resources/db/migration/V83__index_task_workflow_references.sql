-- Worker packing, picking and putaway handoffs resolve tasks by operation and
-- source order. Without this index, a mobile completion scans the complete task
-- history and can time out before its audit record is committed.
CREATE INDEX IF NOT EXISTS idx_tasks_type_reference_status
    ON tasks (task_type, reference_type, reference_id, status);
