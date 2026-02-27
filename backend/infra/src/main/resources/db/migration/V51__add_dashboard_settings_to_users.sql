-- V51: Persist dashboard settings per user for admin settings page

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS dashboard_settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.dashboard_settings IS 'Per-user dashboard settings JSON for UI preferences';
