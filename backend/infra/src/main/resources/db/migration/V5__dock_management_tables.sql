-- OptiWMS Database Schema
-- Version 5: Dock Management Tables
-- Creates tables for dock door management, appointments, and yard trailer tracking

-- ============================================
-- DOCK MANAGEMENT TABLES
-- ============================================

-- Dock Doors
CREATE TABLE IF NOT EXISTS dock_doors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    door_number VARCHAR(50) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'available', -- available, occupied, reserved, maintenance
    current_appointment_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(warehouse_id, door_number)
);

CREATE INDEX IF NOT EXISTS idx_dock_doors_warehouse ON dock_doors(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_dock_doors_status ON dock_doors(status);
CREATE INDEX IF NOT EXISTS idx_dock_doors_door_number ON dock_doors(door_number);

-- Dock Appointments
CREATE TABLE IF NOT EXISTS dock_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_number VARCHAR(50) UNIQUE NOT NULL,
    dock_door_id UUID REFERENCES dock_doors(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    appointment_type VARCHAR(20) NOT NULL, -- inbound, outbound
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    inbound_order_id UUID REFERENCES orders(id),
    outbound_order_id UUID REFERENCES orders(id),
    supplier_id UUID REFERENCES suppliers(id),
    carrier_name VARCHAR(200),
    trailer_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, checked_in, in_progress, completed, cancelled
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dock_appointments_warehouse ON dock_appointments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_dock_appointments_status ON dock_appointments(status);
CREATE INDEX IF NOT EXISTS idx_dock_appointments_door ON dock_appointments(dock_door_id);
CREATE INDEX IF NOT EXISTS idx_dock_appointments_scheduled_start ON dock_appointments(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_dock_appointments_type ON dock_appointments(appointment_type);

-- Yard Trailers
CREATE TABLE IF NOT EXISTS yard_trailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trailer_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    carrier_name VARCHAR(200),
    inbound_order_id UUID REFERENCES orders(id),
    supplier_id UUID REFERENCES suppliers(id),
    arrived_at TIMESTAMP,
    wait_time_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, assigned, unloading, completed
    assigned_dock_door_id UUID REFERENCES dock_doors(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yard_trailers_warehouse ON yard_trailers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_yard_trailers_status ON yard_trailers(status);
CREATE INDEX IF NOT EXISTS idx_yard_trailers_trailer_number ON yard_trailers(trailer_number);
CREATE INDEX IF NOT EXISTS idx_yard_trailers_dock_door ON yard_trailers(assigned_dock_door_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_dock_doors_updated_at BEFORE UPDATE ON dock_doors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dock_appointments_updated_at BEFORE UPDATE ON dock_appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_yard_trailers_updated_at BEFORE UPDATE ON yard_trailers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE dock_doors IS 'Dock door management for warehouse receiving and shipping operations';
COMMENT ON TABLE dock_appointments IS 'Scheduled appointments for dock door usage (inbound/outbound)';
COMMENT ON TABLE yard_trailers IS 'Yard trailer tracking for trailers waiting to be unloaded/loaded';

