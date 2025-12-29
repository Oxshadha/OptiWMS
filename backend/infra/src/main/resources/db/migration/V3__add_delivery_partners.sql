-- Delivery Partners
CREATE TABLE IF NOT EXISTS delivery_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    service_areas JSONB, -- Array of service area strings
    rating DECIMAL(3,2), -- 0.00 to 5.00
    cost_per_delivery DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
    total_shipments INTEGER DEFAULT 0,
    on_time_delivery_rate DECIMAL(5,2), -- Percentage
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_delivery_partners_code ON delivery_partners(partner_code);
CREATE INDEX idx_delivery_partners_status ON delivery_partners(status);
CREATE INDEX idx_delivery_partners_company ON delivery_partners(company_name);

