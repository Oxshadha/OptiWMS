-- V67: Slotting plan execution tracking for stock-transfer workflow

ALTER TABLE slotting_plans
    ADD COLUMN IF NOT EXISTS execution_status VARCHAR(32) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS execution_transfer_id UUID NULL REFERENCES stock_transfers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS transfers_created INTEGER NOT NULL DEFAULT 0;

UPDATE slotting_plans SET execution_status = 'NONE' WHERE execution_status IS NULL;
