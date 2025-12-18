-- OptiWMS Database Schema
-- Version 1: Initial Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MASTER DATA TABLES
-- ============================================

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Sri Lanka',
    contact_person VARCHAR(200),
    phone VARCHAR(50),
    email VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_warehouses_code ON warehouses(code);
CREATE INDEX idx_warehouses_status ON warehouses(status);

-- Materials/Products
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    unit_type VARCHAR(20), -- Bags, Drum, Reel, Can, etc.
    storage_type VARCHAR(20) DEFAULT 'pallet', -- pallet, bulk, loose
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_materials_code ON materials(material_code);
CREATE INDEX idx_materials_description ON materials(description);

-- Locations (Hierarchical: Area-Row-Bay-Level-Bin)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    location_code VARCHAR(50) UNIQUE NOT NULL, -- A-01-01-4-A
    area VARCHAR(10) NOT NULL, -- A, B, C, D, R
    row_number VARCHAR(10) NOT NULL, -- 01, 02, etc.
    bay_number VARCHAR(10) NOT NULL, -- 01, 02, etc.
    level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 4), -- 1-4
    bin_position VARCHAR(10) NOT NULL, -- A, B, C
    location_type VARCHAR(50) DEFAULT 'storage', -- storage, picking, transit, quarantine
    capacity DECIMAL(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    qr_code TEXT, -- Base64 encoded QR code
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_location_code ON locations(location_code);
CREATE INDEX idx_warehouse_location ON locations(warehouse_id, area, row_number, bay_number);
CREATE INDEX idx_location_warehouse ON locations(warehouse_id);

-- ============================================
-- INVENTORY TABLES
-- ============================================

-- Inventory/Stock
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    location_code VARCHAR(50),
    quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    available_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    buffer_stock DECIMAL(15,2),
    max_stock DECIMAL(15,2),
    min_stock DECIMAL(15,2),
    reorder_point DECIMAL(15,2),
    stacking_quantity INTEGER,
    moq DECIMAL(15,2), -- Minimum Order Quantity
    lead_time_days INTEGER,
    last_counted_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, low_stock, out_of_stock, non_moving
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_quantity CHECK (quantity >= 0),
    CONSTRAINT chk_available CHECK (available_quantity >= 0),
    CONSTRAINT chk_reserved CHECK (reserved_quantity >= 0)
);

CREATE INDEX idx_inventory_material ON inventory(material_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_location ON inventory(location_code);
CREATE INDEX idx_inventory_status ON inventory(status);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50),
    movement_type VARCHAR(20) NOT NULL, -- receipt, putaway, picking, transfer_out, transfer_in, adjustment
    quantity DECIMAL(15,2) NOT NULL,
    reference_type VARCHAR(50), -- order, transfer, cycle_count, etc.
    reference_id UUID,
    user_id UUID, -- Will reference users table
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_movements_material ON stock_movements(material_id);
CREATE INDEX idx_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_movements_date ON stock_movements(created_at);

-- Non-Moving Items
CREATE TABLE IF NOT EXISTS non_moving_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    last_movement_date DATE,
    days_since_last_movement INTEGER,
    flagged_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(material_id, warehouse_id)
);

CREATE INDEX idx_non_moving_material ON non_moving_items(material_id);
CREATE INDEX idx_non_moving_warehouse ON non_moving_items(warehouse_id);

-- ============================================
-- USER MANAGEMENT
-- ============================================

-- Users & Workers
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50) UNIQUE, -- EMP-2045
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL, -- admin, supervisor, worker
    warehouse_id UUID REFERENCES warehouses(id),
    phone VARCHAR(50),
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'active',
    device_id VARCHAR(100),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_warehouse ON users(warehouse_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- ORDER MANAGEMENT
-- ============================================

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Sri Lanka',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_customers_name ON customers(name);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(200),
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    lead_time_days INTEGER,
    rating DECIMAL(3,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL, -- inbound, outbound
    customer_id UUID REFERENCES customers(id),
    supplier_id UUID REFERENCES suppliers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, received, picking, packed, shipped, delivered
    priority VARCHAR(20) DEFAULT 'normal', -- normal, express, urgent
    order_date DATE NOT NULL,
    expected_date DATE,
    total_amount DECIMAL(15,2),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_warehouse ON orders(warehouse_id);
CREATE INDEX idx_orders_date ON orders(order_date);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id),
    quantity DECIMAL(15,2) NOT NULL,
    unit_price DECIMAL(15,2),
    picked_quantity DECIMAL(15,2) DEFAULT 0,
    packed_quantity DECIMAL(15,2) DEFAULT 0,
    location_code VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_material ON order_items(material_id);

-- ============================================
-- WAREHOUSE OPERATIONS
-- ============================================

-- Stock Transfers
CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    transfer_type VARCHAR(20) NOT NULL, -- intra_warehouse, inter_warehouse
    material_id UUID REFERENCES materials(id),
    source_warehouse_id UUID REFERENCES warehouses(id),
    source_location_code VARCHAR(50),
    dest_warehouse_id UUID REFERENCES warehouses(id),
    dest_location_code VARCHAR(50),
    quantity DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- draft, in_transit, received, cancelled
    notes TEXT,
    dispatched_by UUID REFERENCES users(id),
    dispatched_at TIMESTAMP,
    received_by UUID REFERENCES users(id),
    received_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transfers_number ON stock_transfers(transfer_number);
CREATE INDEX idx_transfers_status ON stock_transfers(status);
CREATE INDEX idx_transfers_material ON stock_transfers(material_id);

-- Packing Records
CREATE TABLE IF NOT EXISTS packaging_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- box, mailer, crate
    length_cm DECIMAL(10,2),
    width_cm DECIMAL(10,2),
    height_cm DECIMAL(10,2),
    max_weight_kg DECIMAL(10,2),
    cost DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    order_number VARCHAR(50),
    packaging_type_id UUID REFERENCES packaging_types(id),
    box_type VARCHAR(50),
    box_dimensions JSONB, -- {length, width, height}
    dunnage_materials JSONB, -- ['bubble_wrap', 'air_pillows']
    has_fragile_items BOOLEAN DEFAULT FALSE,
    actual_weight_kg DECIMAL(10,3),
    dimensional_weight_kg DECIMAL(10,3),
    chargeable_weight_kg DECIMAL(10,3),
    tracking_number VARCHAR(100),
    shipping_label_url TEXT,
    packing_slip_url TEXT,
    packing_notes TEXT,
    packing_photos JSONB,
    packer_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, cancelled
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_packing_order ON packing_records(order_id);
CREATE INDEX idx_packing_status ON packing_records(status);
CREATE INDEX idx_packing_tracking ON packing_records(tracking_number);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_number VARCHAR(50) UNIQUE NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- receiving, putaway, picking, cycle_count, stock_transfer
    warehouse_id UUID REFERENCES warehouses(id),
    assigned_to UUID REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    location_code VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_number ON tasks(task_number);
CREATE INDEX idx_tasks_type ON tasks(task_type);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_warehouse ON tasks(warehouse_id);

-- Cycle Counts
CREATE TABLE IF NOT EXISTS cycle_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    count_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50),
    scheduled_date DATE,
    assigned_workers UUID[], -- Array of user IDs
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    counted_by UUID REFERENCES users(id),
    counted_at TIMESTAMP,
    variance DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cycle_counts_number ON cycle_counts(count_number);
CREATE INDEX idx_cycle_counts_status ON cycle_counts(status);
CREATE INDEX idx_cycle_counts_warehouse ON cycle_counts(warehouse_id);

-- ============================================
-- SHIPMENT & RETURNS
-- ============================================

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id),
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    destination TEXT,
    weight_kg DECIMAL(10,2),
    driver_name VARCHAR(200),
    driver_phone VARCHAR(50),
    vehicle_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'label_created',
    eta DATE,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shipments_number ON shipments(shipment_number);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_order ON shipments(order_id);

-- Returns
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_number VARCHAR(50) UNIQUE NOT NULL,
    original_order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    return_date DATE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    resolution VARCHAR(50),
    received_by UUID REFERENCES users(id),
    inspected_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_returns_number ON returns(return_number);
CREATE INDEX idx_returns_status ON returns(status);
CREATE INDEX idx_returns_order ON returns(original_order_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_transfers_updated_at BEFORE UPDATE ON stock_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packing_records_updated_at BEFORE UPDATE ON packing_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cycle_counts_updated_at BEFORE UPDATE ON cycle_counts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
