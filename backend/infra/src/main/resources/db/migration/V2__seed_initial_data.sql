-- OptiWMS Database Schema
-- Version 2: Seed Initial Data

-- Insert default warehouses
INSERT INTO warehouses (id, code, name, city, country, status) VALUES
    (uuid_generate_v4(), 'WH-001', 'Colombo Main Warehouse', 'Colombo', 'Sri Lanka', 'active'),
    (uuid_generate_v4(), 'WH-002', 'Kandy Distribution Center', 'Kandy', 'Sri Lanka', 'active'),
    (uuid_generate_v4(), 'WH-003', 'Galle Warehouse', 'Galle', 'Sri Lanka', 'active')
ON CONFLICT (code) DO NOTHING;

-- Insert default packaging types
INSERT INTO packaging_types (id, type_name, category, length_cm, width_cm, height_cm, max_weight_kg, cost, is_active) VALUES
    (uuid_generate_v4(), 'Small Box', 'box', 20, 15, 10, 5, 50, true),
    (uuid_generate_v4(), 'Medium Box', 'box', 30, 25, 20, 15, 100, true),
    (uuid_generate_v4(), 'Large Box', 'box', 40, 35, 30, 30, 150, true),
    (uuid_generate_v4(), 'Poly Mailer', 'mailer', 25, 20, 2, 2, 30, true),
    (uuid_generate_v4(), 'Crate', 'crate', 50, 40, 40, 50, 300, true)
ON CONFLICT DO NOTHING;

-- Insert default admin user
INSERT INTO users (id, username, email, password_hash, employee_id, first_name, last_name, role, status) VALUES
    (uuid_generate_v4(), 'admin', 'admin@optiwms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'EMP-0001', 'Admin', 'User', 'admin', 'active')
ON CONFLICT (username) DO NOTHING;

-- Note: Password is 'admin123' (BCrypt hashed)
-- Note: Materials and inventory will be imported from CSV in Phase 2

