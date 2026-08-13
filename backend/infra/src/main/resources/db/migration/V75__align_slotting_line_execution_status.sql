ALTER TABLE slotting_plan_lines
    DROP CONSTRAINT IF EXISTS chk_slotting_line_status;

ALTER TABLE slotting_plan_lines
    ADD CONSTRAINT chk_slotting_line_status CHECK (
        status IN (
            'PROPOSED',
            'OVERRIDDEN',
            'PENDING_MOVE',
            'APPLIED',
            'REJECTED',
            'KEPT_INCUMBENT'
        )
    );
