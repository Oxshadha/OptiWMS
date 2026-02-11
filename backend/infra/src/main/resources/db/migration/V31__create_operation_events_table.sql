CREATE TABLE IF NOT EXISTS operation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type VARCHAR(50) NOT NULL,
    worker_id UUID NOT NULL,
    task_id UUID NULL,
    order_id UUID NULL,
    order_item_id UUID NULL,
    warehouse_id UUID NULL,
    material_id UUID NULL,
    quantity INTEGER NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    metadata TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_events_worker_id ON operation_events(worker_id);
CREATE INDEX IF NOT EXISTS idx_operation_events_completed_at ON operation_events(completed_at);
CREATE INDEX IF NOT EXISTS idx_operation_events_operation_type ON operation_events(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_events_warehouse_id ON operation_events(warehouse_id);
