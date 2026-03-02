-- Add backend audience targeting fields to notifications
-- Supports role-based and warehouse-scoped broadcast delivery

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS audience_roles VARCHAR(255),
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_warehouse_id ON notifications(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience_roles ON notifications(audience_roles);

