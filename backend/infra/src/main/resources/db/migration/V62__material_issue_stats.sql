-- Pre-aggregated issue statistics for fast ABC-FMS classification (avoids scanning operation_events per plan).

CREATE TABLE IF NOT EXISTS material_issue_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    period_month DATE NOT NULL,
    issue_volume BIGINT NOT NULL DEFAULT 0,
    issue_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_material_issue_stats_month UNIQUE (material_id, warehouse_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_material_issue_stats_warehouse
    ON material_issue_stats (warehouse_id, period_month);

CREATE INDEX IF NOT EXISTS idx_material_issue_stats_material
    ON material_issue_stats (material_id, warehouse_id);

-- Rolling 12-month rollup used by slotting plan generation (milliseconds read path).
CREATE TABLE IF NOT EXISTS material_issue_stats_rollup (
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    issue_volume_12m BIGINT NOT NULL DEFAULT 0,
    issue_count_12m INTEGER NOT NULL DEFAULT 0,
    abc_class VARCHAR(1),
    fms_class VARCHAR(1),
    amalgamated_class VARCHAR(2),
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (material_id, warehouse_id),
    CONSTRAINT chk_rollup_abc CHECK (abc_class IS NULL OR abc_class IN ('A', 'B', 'C')),
    CONSTRAINT chk_rollup_fms CHECK (fms_class IS NULL OR fms_class IN ('F', 'M', 'S')),
    CONSTRAINT chk_rollup_amalgamated CHECK (
        amalgamated_class IS NULL
        OR amalgamated_class IN ('AF','AM','AS','BF','BM','BS','CF','CM','CS')
    )
);

CREATE INDEX IF NOT EXISTS idx_material_issue_stats_rollup_wh
    ON material_issue_stats_rollup (warehouse_id);

COMMENT ON TABLE material_issue_stats IS 'Monthly issue volume/count per material; refreshed from operation_events.';
COMMENT ON TABLE material_issue_stats_rollup IS '12-month ABC-FMS snapshot per material for slotting plan generation.';
