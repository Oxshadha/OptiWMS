-- V61: Forecast results table for historical forecast storage

CREATE TABLE IF NOT EXISTS forecast_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID NULL REFERENCES warehouses(id) ON DELETE SET NULL,
    forecast_period DATE NOT NULL,
    horizon INTEGER NOT NULL DEFAULT 1,
    model_name VARCHAR(64) NOT NULL,
    forecast_p10 NUMERIC(14,2),
    forecast_p50 NUMERIC(14,2) NOT NULL,
    forecast_p90 NUMERIC(14,2),
    actual_demand NUMERIC(14,2),
    wape NUMERIC(8,6),
    method VARCHAR(32),
    mlflow_run_id VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_forecast_horizon_positive CHECK (horizon >= 1),
    CONSTRAINT chk_forecast_p50_nonneg CHECK (forecast_p50 >= 0)
);

CREATE INDEX IF NOT EXISTS idx_forecast_results_material ON forecast_results(material_id);
CREATE INDEX IF NOT EXISTS idx_forecast_results_period ON forecast_results(forecast_period);
CREATE INDEX IF NOT EXISTS idx_forecast_results_model ON forecast_results(model_name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_forecast_results_unique
    ON forecast_results(material_id, forecast_period, horizon, model_name);

-- Demand history table for time-series storage
CREATE TABLE IF NOT EXISTS demand_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID NULL REFERENCES warehouses(id) ON DELETE SET NULL,
    period DATE NOT NULL,
    demand_units NUMERIC(14,2) NOT NULL,
    promotion_flag BOOLEAN DEFAULT FALSE,
    holiday_flag BOOLEAN DEFAULT FALSE,
    lead_time_days NUMERIC(8,2),
    on_hand_inventory NUMERIC(14,2),
    source VARCHAR(32) DEFAULT 'synthetic',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_demand_nonneg CHECK (demand_units >= 0)
);

CREATE INDEX IF NOT EXISTS idx_demand_history_material ON demand_history(material_id);
CREATE INDEX IF NOT EXISTS idx_demand_history_period ON demand_history(period);
CREATE UNIQUE INDEX IF NOT EXISTS ux_demand_history_unique
    ON demand_history(material_id, COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid), period);
