-- Forecast-space optimization recommendations.
-- These tables persist decision-support output before approved changes touch inventory or slotting plans.

CREATE TABLE IF NOT EXISTS inventory_policy_recommendation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    horizon_months INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    forecast_model_name VARCHAR(128),
    forecast_run_id VARCHAR(128),
    created_by VARCHAR(128),
    approved_by VARCHAR(128),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    total_stock_delta NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_pallet_positions_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
    estimated_holding_cost_delta NUMERIC(15,2) NOT NULL DEFAULT 0,
    high_risk_count INTEGER NOT NULL DEFAULT 0,
    data_insufficient_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_policy_run_horizon CHECK (horizon_months IN (1,3,6,12)),
    CONSTRAINT chk_policy_run_status CHECK (
        status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','APPLIED','SUPERSEDED')
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_runs_warehouse_status
    ON inventory_policy_recommendation_runs (warehouse_id, status);

CREATE TABLE IF NOT EXISTS inventory_policy_recommendation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES inventory_policy_recommendation_runs(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    material_code VARCHAR(50) NOT NULL,
    material_type VARCHAR(32),
    current_stock NUMERIC(15,2) NOT NULL DEFAULT 0,
    current_available_stock NUMERIC(15,2) NOT NULL DEFAULT 0,
    current_min_stock NUMERIC(15,2),
    current_max_stock NUMERIC(15,2),
    current_reorder_point NUMERIC(15,2),
    forecast_p10 NUMERIC(15,2),
    forecast_p50 NUMERIC(15,2),
    forecast_p90 NUMERIC(15,2),
    lead_time_days INTEGER,
    lead_time_std_days NUMERIC(8,2),
    moq NUMERIC(15,2),
    order_multiple NUMERIC(15,2),
    unit_cost NUMERIC(15,2),
    expiry_limited_max_stock NUMERIC(15,2),
    proposed_min_stock NUMERIC(15,2),
    proposed_max_stock NUMERIC(15,2),
    proposed_reorder_point NUMERIC(15,2),
    proposed_target_stock NUMERIC(15,2),
    proposed_order_qty NUMERIC(15,2),
    stock_delta NUMERIC(15,2) NOT NULL DEFAULT 0,
    pallet_positions_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
    holding_cost_delta NUMERIC(15,2) NOT NULL DEFAULT 0,
    stockout_risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    expiry_risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    confidence_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    recommendation_status VARCHAR(32) NOT NULL DEFAULT 'DATA_INSUFFICIENT',
    rationale TEXT,
    constraint_snapshot JSONB,
    manager_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_policy_line_material UNIQUE (run_id, material_id),
    CONSTRAINT chk_policy_line_status CHECK (
        recommendation_status IN ('SAFE_TO_APPLY','APPLY_WITH_APPROVAL','HIGH_RISK_REVIEW','INFEASIBLE','DATA_INSUFFICIENT','REJECTED','APPROVED')
    ),
    CONSTRAINT chk_policy_scores CHECK (
        stockout_risk_score BETWEEN 0 AND 100
        AND expiry_risk_score BETWEEN 0 AND 100
        AND confidence_score BETWEEN 0 AND 100
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_lines_run
    ON inventory_policy_recommendation_lines (run_id);
CREATE INDEX IF NOT EXISTS idx_policy_lines_material
    ON inventory_policy_recommendation_lines (material_id);
CREATE INDEX IF NOT EXISTS idx_policy_lines_status
    ON inventory_policy_recommendation_lines (recommendation_status);

CREATE TABLE IF NOT EXISTS space_optimization_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    policy_run_id UUID REFERENCES inventory_policy_recommendation_runs(id) ON DELETE SET NULL,
    horizon_months INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    algorithm VARCHAR(64) NOT NULL DEFAULT 'FORECAST_SPACE_HEURISTIC_V1',
    created_by VARCHAR(128),
    approved_by VARCHAR(128),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    total_space_saved_pallet_positions NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_space_needed_pallet_positions NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_distance_saved_meters NUMERIC(12,2) NOT NULL DEFAULT 0,
    infeasible_count INTEGER NOT NULL DEFAULT 0,
    high_risk_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_space_run_horizon CHECK (horizon_months IN (1,3,6,12)),
    CONSTRAINT chk_space_run_status CHECK (
        status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','APPLIED','SUPERSEDED')
    )
);

CREATE INDEX IF NOT EXISTS idx_space_runs_warehouse_status
    ON space_optimization_runs (warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_space_runs_policy
    ON space_optimization_runs (policy_run_id);

CREATE TABLE IF NOT EXISTS space_optimization_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES space_optimization_runs(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    source_policy_line_id UUID REFERENCES inventory_policy_recommendation_lines(id) ON DELETE SET NULL,
    material_code VARCHAR(50) NOT NULL,
    material_type VARCHAR(32),
    current_primary_location_code VARCHAR(128),
    recommended_primary_location_code VARCHAR(128),
    recommended_reserve_locations JSONB,
    released_location_codes JSONB,
    required_active_pick_pallet_positions INTEGER NOT NULL DEFAULT 1,
    required_reserve_pallet_positions INTEGER NOT NULL DEFAULT 0,
    compatible BOOLEAN NOT NULL DEFAULT true,
    distance_saved_meters NUMERIC(12,2) NOT NULL DEFAULT 0,
    space_saved_pallet_positions NUMERIC(12,2) NOT NULL DEFAULT 0,
    space_needed_pallet_positions NUMERIC(12,2) NOT NULL DEFAULT 0,
    move_cost_score NUMERIC(8,2) NOT NULL DEFAULT 0,
    recommendation_status VARCHAR(32) NOT NULL DEFAULT 'DATA_INSUFFICIENT',
    rationale TEXT,
    constraint_snapshot JSONB,
    manager_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_space_line_material UNIQUE (run_id, material_id),
    CONSTRAINT chk_space_line_status CHECK (
        recommendation_status IN ('SAFE_TO_APPLY','APPLY_WITH_APPROVAL','HIGH_RISK_REVIEW','INFEASIBLE','DATA_INSUFFICIENT','REJECTED','APPROVED')
    )
);

CREATE INDEX IF NOT EXISTS idx_space_lines_run
    ON space_optimization_lines (run_id);
CREATE INDEX IF NOT EXISTS idx_space_lines_material
    ON space_optimization_lines (material_id);
CREATE INDEX IF NOT EXISTS idx_space_lines_status
    ON space_optimization_lines (recommendation_status);

CREATE TABLE IF NOT EXISTS space_optimization_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_line_id UUID REFERENCES inventory_policy_recommendation_lines(id) ON DELETE CASCADE,
    space_line_id UUID REFERENCES space_optimization_lines(id) ON DELETE CASCADE,
    scenario_name VARCHAR(64) NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT true,
    risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    stockout_days_estimate NUMERIC(8,2) NOT NULL DEFAULT 0,
    expiry_excess_units NUMERIC(15,2) NOT NULL DEFAULT 0,
    space_shortfall_pallet_positions NUMERIC(12,2) NOT NULL DEFAULT 0,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_scenario_score CHECK (risk_score BETWEEN 0 AND 100),
    CONSTRAINT chk_scenario_target CHECK (policy_line_id IS NOT NULL OR space_line_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_space_scenarios_policy_line
    ON space_optimization_scenarios (policy_line_id);
CREATE INDEX IF NOT EXISTS idx_space_scenarios_space_line
    ON space_optimization_scenarios (space_line_id);
