ALTER TABLE returns
    ADD COLUMN IF NOT EXISTS return_flow VARCHAR(20) DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS qc_outcome VARCHAR(30),
    ADD COLUMN IF NOT EXISTS supplier_response_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS supplier_response_notes TEXT,
    ADD COLUMN IF NOT EXISTS false_return_request BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS customer_care_flag BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS followup_order_id UUID,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_status_changed_at TIMESTAMP;

UPDATE returns r
SET return_flow = COALESCE(o.order_type, 'unknown')
FROM orders o
WHERE r.original_order_id = o.id
  AND (r.return_flow IS NULL OR r.return_flow = 'unknown');

UPDATE returns
SET last_status_changed_at = COALESCE(last_status_changed_at, created_at::timestamp);

CREATE TABLE IF NOT EXISTS return_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID,
    notes TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_status_history_return_id
    ON return_status_history(return_id);

CREATE INDEX IF NOT EXISTS idx_return_status_history_changed_at
    ON return_status_history(changed_at DESC);

