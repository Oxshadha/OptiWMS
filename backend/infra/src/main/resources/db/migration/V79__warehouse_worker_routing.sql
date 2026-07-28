CREATE TABLE warehouse_route_graphs (
    id UUID PRIMARY KEY,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    dataset_version VARCHAR(128) NOT NULL,
    layout_version VARCHAR(128) NOT NULL,
    graph_hash VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    node_count INTEGER NOT NULL DEFAULT 0,
    edge_count INTEGER NOT NULL DEFAULT 0,
    rack_footprint_count INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ,
    CONSTRAINT chk_route_graph_status
        CHECK (status IN ('ACTIVE', 'RETIRED', 'INVALID'))
);

CREATE UNIQUE INDEX ux_route_graph_active_warehouse
    ON warehouse_route_graphs(warehouse_id)
    WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX ux_route_graph_hash
    ON warehouse_route_graphs(warehouse_id, graph_hash);

CREATE TABLE warehouse_route_nodes (
    graph_id UUID NOT NULL REFERENCES warehouse_route_graphs(id) ON DELETE CASCADE,
    node_id VARCHAR(160) NOT NULL,
    node_type VARCHAR(32) NOT NULL,
    label VARCHAR(255),
    coordinate_x NUMERIC(12,3) NOT NULL,
    coordinate_y NUMERIC(12,3) NOT NULL,
    walkable BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (graph_id, node_id),
    CONSTRAINT chk_route_node_type
        CHECK (node_type IN (
            'AISLE', 'CROSS_AISLE', 'RACK_FACE', 'STATION',
            'PARKING', 'DOOR', 'WAIT'
        ))
);

CREATE INDEX ix_route_nodes_graph_coordinate
    ON warehouse_route_nodes(graph_id, coordinate_x, coordinate_y);

CREATE TABLE warehouse_route_edges (
    graph_id UUID NOT NULL REFERENCES warehouse_route_graphs(id) ON DELETE CASCADE,
    edge_id VARCHAR(220) NOT NULL,
    from_node_id VARCHAR(160) NOT NULL,
    to_node_id VARCHAR(160) NOT NULL,
    resource_key VARCHAR(220) NOT NULL,
    edge_type VARCHAR(32) NOT NULL,
    distance_m NUMERIC(12,3) NOT NULL,
    base_travel_seconds NUMERIC(12,3) NOT NULL,
    width_m NUMERIC(8,3),
    capacity INTEGER NOT NULL DEFAULT 1,
    one_way BOOLEAN NOT NULL DEFAULT FALSE,
    turn_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (graph_id, edge_id),
    FOREIGN KEY (graph_id, from_node_id)
        REFERENCES warehouse_route_nodes(graph_id, node_id) ON DELETE CASCADE,
    FOREIGN KEY (graph_id, to_node_id)
        REFERENCES warehouse_route_nodes(graph_id, node_id) ON DELETE CASCADE,
    CONSTRAINT chk_route_edge_distance CHECK (distance_m > 0),
    CONSTRAINT chk_route_edge_time CHECK (base_travel_seconds > 0),
    CONSTRAINT chk_route_edge_capacity CHECK (capacity > 0)
);

CREATE INDEX ix_route_edges_from
    ON warehouse_route_edges(graph_id, from_node_id);
CREATE INDEX ix_route_edges_resource
    ON warehouse_route_edges(graph_id, resource_key);

CREATE TABLE warehouse_location_route_access (
    graph_id UUID NOT NULL REFERENCES warehouse_route_graphs(id) ON DELETE CASCADE,
    location_code VARCHAR(255) NOT NULL,
    access_node_id VARCHAR(160) NOT NULL,
    access_side VARCHAR(16) NOT NULL,
    approach_distance_m NUMERIC(12,3) NOT NULL DEFAULT 0,
    preferred BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (graph_id, location_code, access_node_id),
    FOREIGN KEY (graph_id, access_node_id)
        REFERENCES warehouse_route_nodes(graph_id, node_id) ON DELETE CASCADE,
    CONSTRAINT chk_route_access_side
        CHECK (access_side IN ('WEST', 'EAST', 'NORTH', 'SOUTH', 'STATION'))
);

CREATE INDEX ix_location_route_access_code
    ON warehouse_location_route_access(graph_id, location_code);

CREATE TABLE worker_route_sessions (
    id UUID PRIMARY KEY,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    graph_id UUID NOT NULL REFERENCES warehouse_route_graphs(id),
    task_id UUID REFERENCES tasks(id),
    order_id UUID REFERENCES orders(id),
    worker_id UUID NOT NULL REFERENCES users(id),
    operation_type VARCHAR(24) NOT NULL,
    vehicle_type VARCHAR(24) NOT NULL DEFAULT 'FORKLIFT',
    status VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
    route_version INTEGER NOT NULL DEFAULT 1,
    start_node_id VARCHAR(160) NOT NULL,
    current_node_id VARCHAR(160) NOT NULL,
    end_node_id VARCHAR(160),
    total_distance_m NUMERIC(14,3) NOT NULL DEFAULT 0,
    estimated_travel_seconds NUMERIC(14,3) NOT NULL DEFAULT 0,
    total_wait_seconds NUMERIC(14,3) NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_worker_route_operation
        CHECK (operation_type IN ('PUTAWAY', 'PICKING', 'TRANSFER', 'REPLENISHMENT')),
    CONSTRAINT chk_worker_route_vehicle
        CHECK (vehicle_type IN ('WORKER', 'PALLET_JACK', 'REACH_TRUCK', 'FORKLIFT')),
    CONSTRAINT chk_worker_route_status
        CHECK (status IN ('PLANNED', 'ACTIVE', 'WAITING', 'COMPLETED', 'CANCELLED', 'EXPIRED'))
);

CREATE INDEX ix_worker_route_active
    ON worker_route_sessions(warehouse_id, status, lease_expires_at);
CREATE INDEX ix_worker_route_worker
    ON worker_route_sessions(worker_id, status, updated_at DESC);
CREATE INDEX ix_worker_route_task
    ON worker_route_sessions(task_id);

CREATE TABLE worker_route_stops (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES worker_route_sessions(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    location_code VARCHAR(255) NOT NULL,
    access_node_id VARCHAR(160) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, sequence_no),
    CONSTRAINT chk_worker_route_stop_status
        CHECK (status IN ('PENDING', 'CURRENT', 'COMPLETED', 'SKIPPED'))
);

CREATE INDEX ix_worker_route_stop_status
    ON worker_route_stops(session_id, status, sequence_no);

CREATE TABLE worker_route_reservations (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES worker_route_sessions(id) ON DELETE CASCADE,
    route_version INTEGER NOT NULL,
    sequence_no INTEGER NOT NULL,
    resource_type VARCHAR(16) NOT NULL,
    resource_key VARCHAR(220) NOT NULL,
    from_node_id VARCHAR(160),
    to_node_id VARCHAR(160),
    reserved_from TIMESTAMPTZ NOT NULL,
    reserved_until TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'RESERVED',
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_worker_route_reservation_type
        CHECK (resource_type IN ('NODE', 'EDGE')),
    CONSTRAINT chk_worker_route_reservation_status
        CHECK (status IN ('RESERVED', 'RELEASED', 'EXPIRED')),
    CONSTRAINT chk_worker_route_reservation_time
        CHECK (reserved_until > reserved_from)
);

CREATE INDEX ix_worker_route_reservation_conflict
    ON worker_route_reservations(resource_key, reserved_from, reserved_until)
    WHERE status = 'RESERVED';
CREATE INDEX ix_worker_route_reservation_session
    ON worker_route_reservations(session_id, route_version, sequence_no);

CREATE TABLE worker_route_events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES worker_route_sessions(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    worker_id UUID REFERENCES users(id),
    event_type VARCHAR(40) NOT NULL,
    node_id VARCHAR(160),
    location_code VARCHAR(255),
    route_version INTEGER,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_worker_route_events_warehouse
    ON worker_route_events(warehouse_id, id);
CREATE INDEX ix_worker_route_events_session
    ON worker_route_events(session_id, id);

COMMENT ON TABLE warehouse_route_graphs IS
    'Versioned, deterministic aisle graphs derived only from the active warehouse dataset.';
COMMENT ON TABLE warehouse_location_route_access IS
    'Maps every bin/location to one or more physical rack-face or station access nodes.';
COMMENT ON TABLE worker_route_reservations IS
    'Server-authoritative node and edge time windows used to prevent simultaneous forklift conflicts.';
COMMENT ON TABLE worker_route_events IS
    'Append-only worker route lifecycle and progress stream consumed by PWA and admin views.';
