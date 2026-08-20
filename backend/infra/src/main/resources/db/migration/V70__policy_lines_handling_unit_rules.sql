ALTER TABLE inventory_policy_recommendation_lines
    ADD COLUMN IF NOT EXISTS units_per_handling_unit NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS current_buffer_stock NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS current_order_qty NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS current_pallet_requirement NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS approval_snapshot JSONB;

ALTER TABLE space_optimization_runs
    ADD COLUMN IF NOT EXISTS optimizer_metadata JSONB,
    ADD COLUMN IF NOT EXISTS relocation_cap_pct NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS relocation_cap_skus INTEGER,
    ADD COLUMN IF NOT EXISTS objective_value NUMERIC(15,4);

ALTER TABLE inventory_policy_recommendation_runs
    DROP CONSTRAINT IF EXISTS chk_policy_run_status;

ALTER TABLE inventory_policy_recommendation_runs
    ADD CONSTRAINT chk_policy_run_status CHECK (
        status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','APPLIED','SUPERSEDED','ROLLED_BACK')
    );
