ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS delivery_partner_id UUID;

CREATE INDEX IF NOT EXISTS idx_shipments_delivery_partner_id
    ON shipments(delivery_partner_id);

UPDATE shipments s
SET delivery_partner_id = dp.id
FROM delivery_partners dp
WHERE s.delivery_partner_id IS NULL
  AND s.carrier IS NOT NULL
  AND (
    LOWER(TRIM(s.carrier)) = LOWER(TRIM(dp.company_name))
    OR LOWER(TRIM(s.carrier)) = LOWER(TRIM(dp.partner_code))
  );
