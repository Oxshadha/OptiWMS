-- This marker is created only when Docker initializes a new OptiWMS volume.
-- The developer bootstrap checks it before replacing seeded/catalog data.
CREATE TABLE IF NOT EXISTS optiwms_environment_marker (
    purpose VARCHAR(64) PRIMARY KEY,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO optiwms_environment_marker(purpose)
VALUES ('PROJECT_OPERATIONAL')
ON CONFLICT (purpose) DO NOTHING;
