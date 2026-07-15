-- Canonical generated operational baseline, statistical evidence and async job contract.

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS temperature_zone VARCHAR(32) NOT NULL DEFAULT 'AMBIENT';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS hazard_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE operation_events ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(128);
ALTER TABLE operation_events ADD COLUMN IF NOT EXISTS source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE materials DROP CONSTRAINT IF EXISTS chk_fms_class;
ALTER TABLE materials ADD CONSTRAINT chk_fms_class
    CHECK (fms_class IS NULL OR fms_class IN ('F', 'M', 'S', 'N'));
COMMENT ON COLUMN materials.abc_class IS 'Annual issued base-unit volume class calculated separately within RM/PM subtype.';
COMMENT ON COLUMN materials.fms_class IS 'Annual issue-event frequency class within subtype; N means non-moving.';

ALTER TABLE material_issue_stats_rollup DROP CONSTRAINT IF EXISTS chk_rollup_fms;
ALTER TABLE material_issue_stats_rollup ADD CONSTRAINT chk_rollup_fms
    CHECK (fms_class IS NULL OR fms_class IN ('F', 'M', 'S', 'N'));
ALTER TABLE material_issue_stats_rollup DROP CONSTRAINT IF EXISTS chk_rollup_amalgamated;
ALTER TABLE material_issue_stats_rollup ADD CONSTRAINT chk_rollup_amalgamated CHECK (
    amalgamated_class IS NULL
    OR amalgamated_class IN ('AF','AM','AS','AN','BF','BM','BS','BN','CF','CM','CS','CN')
);

CREATE TABLE IF NOT EXISTS material_classification_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    dataset_version VARCHAR(128) NOT NULL,
    observation_start DATE NOT NULL,
    observation_end DATE NOT NULL,
    method VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    source_event_count BIGINT NOT NULL DEFAULT 0,
    source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (warehouse_id, dataset_version, observation_end)
);

CREATE TABLE IF NOT EXISTS material_classification_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES material_classification_runs(id) ON DELETE CASCADE,
    material_type VARCHAR(32) NOT NULL,
    category VARCHAR(64) NOT NULL,
    abc_a_cumulative_max NUMERIC(8,6) NOT NULL,
    abc_b_cumulative_max NUMERIC(8,6) NOT NULL,
    fms_slow_upper NUMERIC(18,6) NOT NULL,
    fms_fast_lower NUMERIC(18,6) NOT NULL,
    source_rows INTEGER NOT NULL,
    method VARCHAR(128) NOT NULL,
    UNIQUE (run_id, material_type, category)
);

CREATE TABLE IF NOT EXISTS material_classification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES material_classification_runs(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    issue_volume_12m NUMERIC(20,3) NOT NULL DEFAULT 0,
    issue_count_12m INTEGER NOT NULL DEFAULT 0,
    cumulative_usage_share NUMERIC(12,8),
    abc_class VARCHAR(1) NOT NULL,
    fms_class VARCHAR(1) NOT NULL,
    amalgamated_class VARCHAR(2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, material_id)
);

CREATE TABLE IF NOT EXISTS forecast_backtest_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset VARCHAR(128) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    split VARCHAR(32) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    origin_month DATE NOT NULL,
    horizon INTEGER NOT NULL DEFAULT 1,
    y_true NUMERIC(20,6) NOT NULL,
    forecast_p05 NUMERIC(20,6),
    forecast_p50 NUMERIC(20,6) NOT NULL,
    forecast_p95 NUMERIC(20,6),
    residual NUMERIC(20,6) NOT NULL,
    absolute_error NUMERIC(20,6) NOT NULL,
    interval_covered BOOLEAN,
    source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dataset, model_name, split, warehouse_id, material_id, origin_month, horizon)
);

CREATE TABLE IF NOT EXISTS forecast_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset VARCHAR(128) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    algorithm VARCHAR(128) NOT NULL,
    version VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    promotion_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    promotion_gate JSONB NOT NULL DEFAULT '{}'::jsonb,
    promoted_by VARCHAR(128),
    promoted_at TIMESTAMPTZ,
    source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dataset, model_name, version)
);

CREATE TABLE IF NOT EXISTS forecast_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    dataset VARCHAR(128) NOT NULL,
    requested_model VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    stage VARCHAR(64) NOT NULL DEFAULT 'queued',
    progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    message TEXT,
    requested_by VARCHAR(128),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id)
);

CREATE TABLE IF NOT EXISTS inventory_policy_simulation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_run_id UUID REFERENCES inventory_policy_recommendation_runs(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    service_level_target NUMERIC(8,6) NOT NULL,
    simulated_fill_rate NUMERIC(8,6),
    current_expected_cost NUMERIC(20,4),
    proposed_expected_cost NUMERIC(20,4),
    expected_cost_delta NUMERIC(20,4),
    stockout_days_current INTEGER,
    stockout_days_proposed INTEGER,
    capacity_feasible BOOLEAN NOT NULL DEFAULT FALSE,
    simulation_method VARCHAR(128) NOT NULL,
    source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (policy_run_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_warehouse_type_date_page
    ON orders (warehouse_id, order_type, order_date DESC, id);
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_status_date_page
    ON orders (warehouse_id, status, order_date DESC, id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_material_page
    ON order_items (order_id, material_id, id);
CREATE INDEX IF NOT EXISTS idx_tasks_warehouse_status_created_page
    ON tasks (warehouse_id, status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse_created_page
    ON stock_movements (warehouse_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_events_warehouse_completed_page
    ON operation_events (warehouse_id, completed_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_material_location
    ON inventory (warehouse_id, material_id, location_code);
CREATE INDEX IF NOT EXISTS idx_forecast_results_warehouse_period_model_page
    ON forecast_results (warehouse_id, forecast_period, model_name, material_id)
    WHERE decision_eligible = TRUE;
CREATE INDEX IF NOT EXISTS idx_forecast_backtest_lookup
    ON forecast_backtest_rows (warehouse_id, dataset, model_name, split, origin_month, material_id);
CREATE INDEX IF NOT EXISTS idx_classification_history_lookup
    ON material_classification_history (warehouse_id, run_id, amalgamated_class, material_id);
CREATE INDEX IF NOT EXISTS idx_forecast_jobs_status_created
    ON forecast_jobs (status, created_at DESC);

COMMENT ON TABLE forecast_backtest_rows IS 'Historical evaluation rows only; forward forecasts remain in forecast_results.';
COMMENT ON TABLE material_classification_thresholds IS 'Persisted subtype-specific ABC/FMS thresholds derived from the supervisor-report method.';
COMMENT ON TABLE forecast_jobs IS 'Asynchronous forecast run state returned to the Forecasts UI.';
