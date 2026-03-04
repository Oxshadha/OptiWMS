ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS delivery_partner_id UUID;

CREATE INDEX IF NOT EXISTS idx_shipments_delivery_partner_id
    ON shipments(delivery_partner_id);
