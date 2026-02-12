-- Stock transfer workflow upgrade: multi-line transfers and execution events

ALTER TABLE stock_transfers
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS released_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    material_id UUID NOT NULL REFERENCES materials(id),
    source_warehouse_id UUID REFERENCES warehouses(id),
    source_location_code VARCHAR(50),
    dest_warehouse_id UUID REFERENCES warehouses(id),
    dest_location_code VARCHAR(50),
    requested_quantity INTEGER NOT NULL,
    moved_quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    assigned_worker_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_transfer_line_number UNIQUE (transfer_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_transfer_lines_transfer_id
    ON stock_transfer_lines(transfer_id);

CREATE INDEX IF NOT EXISTS idx_transfer_lines_status
    ON stock_transfer_lines(status);

CREATE INDEX IF NOT EXISTS idx_transfer_lines_assigned_worker
    ON stock_transfer_lines(assigned_worker_id);

CREATE TABLE IF NOT EXISTS stock_transfer_line_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_line_id UUID NOT NULL REFERENCES stock_transfer_lines(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    worker_id UUID REFERENCES users(id),
    quantity INTEGER,
    source_scan_location VARCHAR(50),
    dest_scan_location VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_line_events_line_id
    ON stock_transfer_line_events(transfer_line_id);

CREATE INDEX IF NOT EXISTS idx_transfer_line_events_created_at
    ON stock_transfer_line_events(created_at DESC);
