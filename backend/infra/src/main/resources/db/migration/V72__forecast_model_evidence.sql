-- Reproducible model-evaluation evidence for canonical operational forecasts.
-- One row represents an aggregate, leakage-safe evaluation split/horizon.
CREATE TABLE IF NOT EXISTS forecast_model_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset VARCHAR(128) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    split VARCHAR(32) NOT NULL,
    horizon INTEGER NOT NULL DEFAULT 0,
    evaluation_rows INTEGER NOT NULL,
    material_count INTEGER NOT NULL,
    wape NUMERIC(12,8),
    mae NUMERIC(18,6),
    rmse NUMERIC(18,6),
    bias NUMERIC(12,8),
    under_forecast_rate NUMERIC(12,8),
    interval_nominal_coverage NUMERIC(12,8),
    interval_empirical_coverage NUMERIC(12,8),
    data_quality_tier VARCHAR(64) NOT NULL,
    synthetic_ratio NUMERIC(6,5) NOT NULL DEFAULT 0,
    decision_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(dataset, model_name, warehouse_id, split, horizon)
);

CREATE INDEX IF NOT EXISTS idx_forecast_model_evidence_lookup
    ON forecast_model_evidence (decision_eligible, dataset, model_name, split, warehouse_id);
