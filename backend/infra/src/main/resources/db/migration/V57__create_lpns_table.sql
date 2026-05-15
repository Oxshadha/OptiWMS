-- Create LPN (License Plate Number) table for tracking packaged items
-- LPNs are used to group inventory items for efficient warehouse operations

CREATE TABLE IF NOT EXISTS lpns (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    lpn_code VARCHAR(20) UNIQUE NOT NULL,
    material_id UUID,
    warehouse_id UUID,
    location_code VARCHAR(50),
    quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    notes TEXT,
    
    CONSTRAINT fk_lpns_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL,
    CONSTRAINT fk_lpns_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
    CONSTRAINT fk_lpns_location FOREIGN KEY (location_code) REFERENCES locations(location_code) ON DELETE SET NULL,
    CONSTRAINT fk_lpns_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create index on lpn_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_lpns_code ON lpns(lpn_code);

-- Create index on warehouse for filtering by warehouse
CREATE INDEX IF NOT EXISTS idx_lpns_warehouse ON lpns(warehouse_id);

-- Create index on status for filtering by status
CREATE INDEX IF NOT EXISTS idx_lpns_status ON lpns(status);
