-- OptiWMS Database Schema
-- Version 6: Reports Tables
-- Creates tables for report management and scheduled reports

-- ============================================
-- REPORTS TABLES
-- ============================================

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- inbound, outbound, inventory, sales, analytics, customer
    description TEXT,
    report_config JSONB, -- Custom report configuration
    generated_at TIMESTAMP,
    file_size_bytes BIGINT,
    file_path VARCHAR(500),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Scheduled Reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    scheduled_time TIME NOT NULL,
    email_recipients TEXT[] NOT NULL, -- Array of email addresses
    is_active BOOLEAN DEFAULT TRUE,
    last_generated_at TIMESTAMP,
    next_generation_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_generation ON scheduled_reports(next_generation_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_frequency ON scheduled_reports(frequency);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE reports IS 'Generated reports with metadata and file storage information';
COMMENT ON TABLE scheduled_reports IS 'Scheduled report generation with email delivery configuration';
COMMENT ON COLUMN reports.report_config IS 'JSONB configuration for custom report parameters and filters';

