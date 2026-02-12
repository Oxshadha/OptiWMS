-- Enhance cycle count workflow with approval gate, anomaly markers, and audit logs

ALTER TABLE cycle_counts
    ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id),
    ADD COLUMN IF NOT EXISTS expected_quantity DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS counted_quantity DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS variance_percentage DECIMAL(10,4),
    ADD COLUMN IF NOT EXISTS anomaly_level VARCHAR(20),
    ADD COLUMN IF NOT EXISTS anomaly_detected BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS approval_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_cycle_counts_material_id
    ON cycle_counts(material_id);

CREATE INDEX IF NOT EXISTS idx_cycle_counts_approval_required
    ON cycle_counts(approval_required);

CREATE TABLE IF NOT EXISTS cycle_count_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
    action VARCHAR(60) NOT NULL,
    performed_by UUID REFERENCES users(id),
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    expected_quantity DECIMAL(15,2),
    counted_quantity DECIMAL(15,2),
    variance DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycle_count_audit_logs_cycle_count_id
    ON cycle_count_audit_logs(cycle_count_id);

CREATE INDEX IF NOT EXISTS idx_cycle_count_audit_logs_created_at
    ON cycle_count_audit_logs(created_at DESC);
