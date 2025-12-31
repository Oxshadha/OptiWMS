-- V13: Add User Preferences
-- Adds blind_receiving_mode preference to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS blind_receiving_mode BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN users.blind_receiving_mode IS 'User preference for blind receiving mode (hide expected quantities)';

