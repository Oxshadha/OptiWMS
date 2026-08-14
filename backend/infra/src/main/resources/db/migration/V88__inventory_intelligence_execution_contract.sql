-- Connect planning recommendations to their physical execution.

CREATE TABLE IF NOT EXISTS planning_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'CALCULATING',
    cadence VARCHAR(32) NOT NULL DEFAULT 'DAILY_POLICY',
    created_by VARCHAR(128),
    scheduled_for TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_planning_cycle_lifecycle CHECK (lifecycle_status IN (
        'CALCULATING','READY_FOR_REVIEW','APPROVED','SCHEDULED','IN_EXECUTION','COMPLETED',
        'FAILED','EXPIRED','DEFERRED','REJECTED','CANCELLED'
    ))
);

ALTER TABLE inventory_policy_recommendation_runs
    ADD COLUMN IF NOT EXISTS planning_cycle_id UUID REFERENCES planning_cycles(id) ON DELETE SET NULL;
ALTER TABLE inventory_policy_recommendation_lines
    ADD COLUMN IF NOT EXISTS target_pallet_positions NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE space_optimization_runs
    ADD COLUMN IF NOT EXISTS planning_cycle_id UUID REFERENCES planning_cycles(id) ON DELETE SET NULL;
ALTER TABLE slotting_plans
    ADD COLUMN IF NOT EXISTS planning_cycle_id UUID REFERENCES planning_cycles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_distance_saved_meters NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE slotting_plans DROP CONSTRAINT IF EXISTS chk_slotting_plan_status;
ALTER TABLE slotting_plans ADD CONSTRAINT chk_slotting_plan_status CHECK (
    status IN ('DRAFT','OPTIMIZING','PENDING_APPROVAL','APPROVED','SCHEDULED','ACTIVE','SUPERSEDED','CANCELLED')
);

ALTER TABLE slotting_plan_lines DROP CONSTRAINT IF EXISTS chk_slotting_line_status;
ALTER TABLE slotting_plan_lines ADD CONSTRAINT chk_slotting_line_status CHECK (
    status IN ('PROPOSED','OVERRIDDEN','PENDING_MOVE','IN_PROGRESS','APPLIED','EXCEPTION','REJECTED','KEPT_INCUMBENT')
);
ALTER TABLE stock_transfers
    ADD COLUMN IF NOT EXISTS planning_cycle_id UUID REFERENCES planning_cycles(id) ON DELETE SET NULL;
ALTER TABLE stock_transfer_lines
    ADD COLUMN IF NOT EXISTS planning_cycle_id UUID REFERENCES planning_cycles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS slotting_plan_line_id UUID REFERENCES slotting_plan_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_planning_cycles_warehouse_status ON planning_cycles(warehouse_id, lifecycle_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_runs_planning_cycle ON inventory_policy_recommendation_runs(planning_cycle_id);
CREATE INDEX IF NOT EXISTS idx_space_runs_planning_cycle ON space_optimization_runs(planning_cycle_id);
CREATE INDEX IF NOT EXISTS idx_slotting_plans_planning_cycle ON slotting_plans(planning_cycle_id);
CREATE INDEX IF NOT EXISTS idx_transfer_lines_slotting_line ON stock_transfer_lines(slotting_plan_line_id);

UPDATE inventory_policy_recommendation_lines
SET target_pallet_positions = GREATEST(0, COALESCE(current_pallet_requirement, 0) + COALESCE(pallet_positions_delta, 0))
WHERE target_pallet_positions = 0;
