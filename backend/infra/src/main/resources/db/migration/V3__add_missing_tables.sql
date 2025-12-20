-- Migration V3: Add missing tables for quality checks, anomalies, and delivery partners

-- Delivery Partners
CREATE TABLE IF NOT EXISTS delivery_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(200),
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    service_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_delivery_partners_code ON delivery_partners(code);
CREATE INDEX idx_delivery_partners_name ON delivery_partners(name);

-- Quality Checks
CREATE TABLE IF NOT EXISTS quality_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    check_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    check_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    result VARCHAR(50),
    notes TEXT,
    checked_by UUID REFERENCES users(id),
    checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_checks_number ON quality_checks(check_number);
CREATE INDEX idx_quality_checks_order ON quality_checks(order_id);
CREATE INDEX idx_quality_checks_status ON quality_checks(status);

-- Anomalies
CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anomaly_number VARCHAR(50) UNIQUE NOT NULL,
    anomaly_type VARCHAR(50),
    warehouse_id UUID REFERENCES warehouses(id),
    material_id UUID REFERENCES materials(id),
    location_code VARCHAR(50),
    severity VARCHAR(20),
    status VARCHAR(50) DEFAULT 'open',
    description TEXT,
    resolution TEXT,
    detected_by UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_anomalies_number ON anomalies(anomaly_number);
CREATE INDEX idx_anomalies_status ON anomalies(status);
CREATE INDEX idx_anomalies_warehouse ON anomalies(warehouse_id);
CREATE INDEX idx_anomalies_type ON anomalies(anomaly_type);

-- Add triggers for updated_at
CREATE TRIGGER update_delivery_partners_updated_at BEFORE UPDATE ON delivery_partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

