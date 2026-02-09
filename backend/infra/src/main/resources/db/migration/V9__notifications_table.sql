-- OptiWMS Database Schema
-- Version 9: Notifications Table
-- Creates table for system notifications

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL means broadcast to all users
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- order, inventory, cycle_count, task, anomaly, shipment, return, system
    read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500), -- URL to navigate when notification is clicked
    metadata JSONB, -- Additional data for the notification
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- ============================================
-- TRIGGERS FOR UPDATED_AT (if needed in future)
-- ============================================

