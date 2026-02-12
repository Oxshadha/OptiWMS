ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS delivery_confirmed_by UUID,
    ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP;

