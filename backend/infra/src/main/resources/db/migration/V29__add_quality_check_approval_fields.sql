-- V29: Add quality check approval workflow fields

ALTER TABLE quality_check_logs
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

UPDATE quality_check_logs
SET approval_status = CASE
    WHEN qty_rejected = 0 AND (rejection_reason IS NULL OR btrim(rejection_reason) = '') THEN 'APPROVED'
    WHEN qty_rejected > 0 AND rejection_reason IS NOT NULL AND btrim(rejection_reason) <> '' THEN 'REJECTED'
    ELSE 'PENDING'
END
WHERE approval_status IS NULL OR btrim(approval_status) = '';

ALTER TABLE quality_check_logs
    ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE quality_check_logs
    ADD CONSTRAINT chk_quality_check_approval_status
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_qc_approval_status ON quality_check_logs(approval_status);
