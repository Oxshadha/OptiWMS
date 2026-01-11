-- Migration: Add worker tracking to orders and tasks
-- This enables tracking who received, picked, packed, and shipped each order
-- Critical for worker performance metrics

-- Add worker tracking columns to orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS picked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS packed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS shipped_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS picked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS packed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_received_by ON orders(received_by);
CREATE INDEX IF NOT EXISTS idx_orders_picked_by ON orders(picked_by);
CREATE INDEX IF NOT EXISTS idx_orders_packed_by ON orders(packed_by);
CREATE INDEX IF NOT EXISTS idx_orders_shipped_by ON orders(shipped_by);

-- Add worker tracking to tasks (if not already exists)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

-- Note: completed_at already exists in tasks table
-- Update it to be set when task is completed

-- Add indexes for task worker tracking
CREATE INDEX IF NOT EXISTS idx_tasks_completed_by ON tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at);

-- Verify packing_records has packer_id (should already exist)
-- Verify shipments has shipped_by and shipped_at (should already exist)

-- Add comment
COMMENT ON COLUMN orders.received_by IS 'Worker who received the inbound order';
COMMENT ON COLUMN orders.picked_by IS 'Worker who picked the outbound order';
COMMENT ON COLUMN orders.packed_by IS 'Worker who packed the order';
COMMENT ON COLUMN orders.shipped_by IS 'Worker who shipped the order';
COMMENT ON COLUMN tasks.completed_by IS 'Worker who completed the task';
