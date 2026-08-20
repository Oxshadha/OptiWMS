-- Quarterly slotting plans: versioned material-to-location assignments with pick-face + reserve.

CREATE TABLE IF NOT EXISTS slotting_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL,
    plan_code VARCHAR(64) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    version INTEGER NOT NULL DEFAULT 1,
    algorithm VARCHAR(64) NOT NULL DEFAULT 'HEURISTIC_MILP_V1',
    relocation_budget_pct NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
    relocation_moves_applied INTEGER NOT NULL DEFAULT 0,
    total_moves_proposed INTEGER NOT NULL DEFAULT 0,
    total_distance_saved_meters NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_by VARCHAR(128),
    approved_by VARCHAR(128),
    approved_at TIMESTAMPTZ,
    source_stats_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_slotting_plans_code UNIQUE (warehouse_id, plan_code),
    CONSTRAINT chk_slotting_plan_status CHECK (
        status IN ('DRAFT', 'OPTIMIZING', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUPERSEDED')
    )
);

CREATE INDEX IF NOT EXISTS idx_slotting_plans_warehouse_status
    ON slotting_plans (warehouse_id, status);

CREATE TABLE IF NOT EXISTS slotting_plan_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES slotting_plans(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    material_code VARCHAR(50) NOT NULL,
    material_type VARCHAR(32),
    current_primary_location_code VARCHAR(128),
    recommended_primary_location_code VARCHAR(128),
    recommended_primary_location_id UUID,
    final_primary_location_code VARCHAR(128),
    manager_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    locked BOOLEAN NOT NULL DEFAULT false,
    active_pick_pallet_positions INTEGER NOT NULL DEFAULT 1,
    required_reserve_pallet_positions INTEGER NOT NULL DEFAULT 0,
    max_stock_pallet_positions INTEGER NOT NULL DEFAULT 1,
    rop NUMERIC(15, 2),
    max_stock NUMERIC(15, 2),
    distance_saved_meters NUMERIC(12, 2),
    zone_upgrade VARCHAR(64),
    move_reason TEXT,
    gain_score NUMERIC(10, 4),
    relocation_applied BOOLEAN NOT NULL DEFAULT false,
    objective_cost NUMERIC(12, 4),
    relocation_flag BOOLEAN NOT NULL DEFAULT false,
    constraint_snapshot JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_slotting_plan_line_material UNIQUE (plan_id, material_id),
    CONSTRAINT chk_slotting_line_status CHECK (
        status IN ('PROPOSED', 'OVERRIDDEN', 'APPLIED', 'REJECTED', 'KEPT_INCUMBENT')
    )
);

CREATE INDEX IF NOT EXISTS idx_slotting_plan_lines_plan
    ON slotting_plan_lines (plan_id);

CREATE INDEX IF NOT EXISTS idx_slotting_plan_lines_material_code
    ON slotting_plan_lines (material_code);

CREATE TABLE IF NOT EXISTS slotting_plan_reserve_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_line_id UUID NOT NULL REFERENCES slotting_plan_lines(id) ON DELETE CASCADE,
    recommended_reserve_location_code VARCHAR(128) NOT NULL,
    final_reserve_location_code VARCHAR(128),
    reserve_pallet_positions INTEGER NOT NULL DEFAULT 1,
    reserve_zone_hint VARCHAR(64),
    sequence_no INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slotting_plan_reserve_lines_line
    ON slotting_plan_reserve_lines (plan_line_id);
