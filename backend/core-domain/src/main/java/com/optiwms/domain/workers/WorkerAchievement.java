package com.optiwms.domain.workers;

import com.optiwms.domain.common.BaseEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public class WorkerAchievement extends BaseEntity {
    private UUID workerId;
    private String achievementType; // speed_demon, perfect_week, century_club, early_bird, night_owl, etc.
    private OffsetDateTime earnedAt;
    private String metadata; // JSON string

    // Getters and Setters
    public UUID getWorkerId() { return workerId; }
    public void setWorkerId(UUID workerId) { this.workerId = workerId; }
    public String getAchievementType() { return achievementType; }
    public void setAchievementType(String achievementType) { this.achievementType = achievementType; }
    public OffsetDateTime getEarnedAt() { return earnedAt; }
    public void setEarnedAt(OffsetDateTime earnedAt) { this.earnedAt = earnedAt; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
}
