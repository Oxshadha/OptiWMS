CREATE TABLE supplier_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    material_id UUID REFERENCES materials(id),
    min_order_qty DOUBLE PRECISION DEFAULT 0,
    max_order_qty DOUBLE PRECISION,
    bulk_discount_threshold DOUBLE PRECISION,
    bulk_discount_percent DOUBLE PRECISION DEFAULT 0,
    unit_price DOUBLE PRECISION,
    currency VARCHAR(3) DEFAULT 'LKR',
    avg_shipment_delay_days INTEGER DEFAULT 0,
    lead_time_std_dev_days INTEGER DEFAULT 0,
    supplier_otif_percent DOUBLE PRECISION DEFAULT 95.0,
    ordering_cost_per_order DOUBLE PRECISION DEFAULT 1200.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
