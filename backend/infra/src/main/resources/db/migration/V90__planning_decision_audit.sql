-- Durable manager decisions for forecast policy and slotting recommendations.

CREATE TABLE IF NOT EXISTS planning_decision_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    planning_cycle_id UUID REFERENCES planning_cycles(id) ON DELETE SET NULL,
    recommendation_id UUID NOT NULL,
    recommendation_type VARCHAR(48) NOT NULL,
    action VARCHAR(24) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    reason TEXT,
    deferred_until TIMESTAMPTZ,
    previous_status VARCHAR(32),
    new_status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_planning_decision_action CHECK (
        action IN ('APPROVED','DEFERRED','REJECTED','SCHEDULED')
    )
);

CREATE INDEX IF NOT EXISTS idx_planning_decisions_warehouse_created
    ON planning_decision_events(warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planning_decisions_recommendation
    ON planning_decision_events(recommendation_id, recommendation_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planning_decisions_cycle
    ON planning_decision_events(planning_cycle_id, created_at DESC);

COMMENT ON TABLE planning_decision_events IS
    'Append-only audit of manager approval, defer, reject and scheduling decisions.';
