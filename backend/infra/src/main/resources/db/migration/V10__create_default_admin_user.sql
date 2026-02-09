-- Create default admin user for initial system access
-- Note: This migration creates the user structure
-- The actual password hash will be set by DefaultUserSeeder on application startup
-- This ensures the password is properly hashed with BCrypt

-- The DefaultUserSeeder will create the admin user if no users exist
-- Default credentials:
--   Email: admin@optiwms.com
--   Username: admin
--   Password: admin123
-- This migration is kept for reference but the actual user creation happens via DefaultUserSeeder

