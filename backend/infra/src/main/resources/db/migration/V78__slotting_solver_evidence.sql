ALTER TABLE slotting_plans
    ADD COLUMN IF NOT EXISTS solver_status VARCHAR(32) NOT NULL DEFAULT 'NOT_RUN',
    ADD COLUMN IF NOT EXISTS objective_value NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS infeasible_reason TEXT,
    ADD COLUMN IF NOT EXISTS constraint_evidence TEXT;

COMMENT ON COLUMN slotting_plans.solver_status IS
    'MILP solver result such as OPTIMAL, FEASIBLE, INFEASIBLE, or FALLBACK.';
COMMENT ON COLUMN slotting_plans.constraint_evidence IS
    'Comma-separated optimizer constraint contract used for the plan.';
