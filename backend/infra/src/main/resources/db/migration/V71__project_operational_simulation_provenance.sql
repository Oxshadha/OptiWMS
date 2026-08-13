-- Provenance and decision gates for the project-operational simulation dataset.
-- Generated rows may drive simulation workflows but must remain distinguishable
-- from externally validated operational history.

ALTER TABLE materials ADD COLUMN IF NOT EXISTS data_quality_tier VARCHAR(64);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS synthetic_ratio NUMERIC(6,5);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS decision_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS source_lineage JSONB;

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS data_quality_tier VARCHAR(64);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS source_lineage JSONB;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS data_quality_tier VARCHAR(64);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_lineage JSONB;

ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS data_quality_tier VARCHAR(64);
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS synthetic_ratio NUMERIC(6,5);
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS decision_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS source_lineage JSONB;

ALTER TABLE demand_history ADD COLUMN IF NOT EXISTS data_quality_tier VARCHAR(64);
ALTER TABLE demand_history ADD COLUMN IF NOT EXISTS synthetic_ratio NUMERIC(6,5);
ALTER TABLE demand_history ADD COLUMN IF NOT EXISTS decision_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE demand_history ADD COLUMN IF NOT EXISTS source_lineage JSONB;

ALTER TABLE forecast_results ADD COLUMN IF NOT EXISTS training_source VARCHAR(128);
ALTER TABLE forecast_results ADD COLUMN IF NOT EXISTS data_quality_tier VARCHAR(64);
ALTER TABLE forecast_results ADD COLUMN IF NOT EXISTS synthetic_ratio NUMERIC(6,5);
ALTER TABLE forecast_results ADD COLUMN IF NOT EXISTS decision_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE forecast_results ADD COLUMN IF NOT EXISTS source_lineage JSONB;

CREATE INDEX IF NOT EXISTS idx_forecast_results_decision_eligible
    ON forecast_results (decision_eligible, model_name, forecast_period);
CREATE INDEX IF NOT EXISTS idx_demand_history_quality_tier
    ON demand_history (data_quality_tier, period);
CREATE INDEX IF NOT EXISTS idx_materials_quality_tier
    ON materials (data_quality_tier, material_type);

CREATE TABLE IF NOT EXISTS project_dataset_load_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version VARCHAR(128) NOT NULL,
    dataset_hash VARCHAR(64) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    status VARCHAR(24) NOT NULL,
    row_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_dataset_load_audit_version
    ON project_dataset_load_audit (dataset_version, started_at DESC);

