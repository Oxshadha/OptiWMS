package com.optiwms.infra.intelligence;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "planning_decision_events")
public class PlanningDecisionEventEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(columnDefinition = "UUID", updatable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "warehouse_id", nullable = false, columnDefinition = "UUID")
    private UUID warehouseId;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "planning_cycle_id", columnDefinition = "UUID")
    private UUID planningCycleId;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "recommendation_id", nullable = false, columnDefinition = "UUID")
    private UUID recommendationId;

    @Column(name = "recommendation_type", nullable = false, length = 48)
    private String recommendationType;

    @Column(nullable = false, length = 24)
    private String action;

    @Column(nullable = false, length = 128)
    private String actor;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "deferred_until")
    private OffsetDateTime deferredUntil;

    @Column(name = "previous_status", length = 32)
    private String previousStatus;

    @Column(name = "new_status", nullable = false, length = 32)
    private String newStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void create() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public UUID getPlanningCycleId() { return planningCycleId; }
    public void setPlanningCycleId(UUID planningCycleId) { this.planningCycleId = planningCycleId; }
    public UUID getRecommendationId() { return recommendationId; }
    public void setRecommendationId(UUID recommendationId) { this.recommendationId = recommendationId; }
    public String getRecommendationType() { return recommendationType; }
    public void setRecommendationType(String recommendationType) { this.recommendationType = recommendationType; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public OffsetDateTime getDeferredUntil() { return deferredUntil; }
    public void setDeferredUntil(OffsetDateTime deferredUntil) { this.deferredUntil = deferredUntil; }
    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String previousStatus) { this.previousStatus = previousStatus; }
    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
