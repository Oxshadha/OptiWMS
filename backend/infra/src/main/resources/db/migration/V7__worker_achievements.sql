-- OptiWMS Database Schema
-- Version 7: Worker Achievements Table
-- Creates table for gamification and worker achievement tracking

-- ============================================
-- WORKER ACHIEVEMENTS TABLE
-- ============================================

-- Worker Achievements (Gamification)
CREATE TABLE IF NOT EXISTS worker_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL, -- speed_demon, perfect_week, century_club, early_bird, night_owl, etc.
    earned_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB -- Additional achievement data (e.g., task count, accuracy, time taken)
);

CREATE INDEX IF NOT EXISTS idx_worker_achievements_worker ON worker_achievements(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_achievements_type ON worker_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_worker_achievements_earned_at ON worker_achievements(earned_at);
CREATE INDEX IF NOT EXISTS idx_worker_achievements_worker_type ON worker_achievements(worker_id, achievement_type);

-- Unique constraint: one achievement per worker per type per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_achievements_unique ON worker_achievements(worker_id, achievement_type, DATE(earned_at));

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE worker_achievements IS 'Gamification system for tracking worker achievements and milestones';
COMMENT ON COLUMN worker_achievements.achievement_type IS 'Type of achievement: speed_demon, perfect_week, century_club, early_bird, night_owl, etc.';
COMMENT ON COLUMN worker_achievements.metadata IS 'JSONB field for storing achievement-specific data like task counts, accuracy scores, time metrics';

