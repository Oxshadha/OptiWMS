-- Quality approval must not wait while fallback slotting inspects inventory,
-- capacity, or an optional AI service. This durable queue is committed with the
-- approval and processed afterwards by the core application scheduler.
CREATE TABLE IF NOT EXISTS putaway_planning_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMP,
    last_error TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_putaway_planning_job_order UNIQUE (order_id),
    CONSTRAINT chk_putaway_planning_job_status CHECK (
        status IN ('PENDING', 'PROCESSING', 'RETRY', 'COMPLETED', 'DESTINATION_PENDING')
    )
);

CREATE INDEX IF NOT EXISTS idx_putaway_planning_jobs_claim
    ON putaway_planning_jobs (status, next_attempt_at, created_at);

-- The application check avoids normal duplicates; this database invariant also
-- protects against scheduler retries, process crashes, and concurrent instances.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_putaway_order_item
    ON tasks (task_type, reference_type, reference_id)
    WHERE task_type = 'putaway'
      AND reference_type = 'order_item'
      AND reference_id IS NOT NULL;
