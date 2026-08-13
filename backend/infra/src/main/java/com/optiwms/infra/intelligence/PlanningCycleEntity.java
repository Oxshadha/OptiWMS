package com.optiwms.infra.intelligence;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "planning_cycles")
public class PlanningCycleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Column(name = "lifecycle_status", nullable = false, length = 32)
    private String lifecycleStatus;

    @Column(name = "cadence", nullable = false, length = 32)
    private String cadence;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(name = "scheduled_for")
    private OffsetDateTime scheduledFor;
    @Column(name = "started_at")
    private OffsetDateTime startedAt;
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void create() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (lifecycleStatus == null) lifecycleStatus = "CALCULATING";
        if (cadence == null) cadence = "DAILY_POLICY";
    }

    @PreUpdate
    void update() { updatedAt = OffsetDateTime.now(); }

    public UUID getId() { return id; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public String getLifecycleStatus() { return lifecycleStatus; }
    public void setLifecycleStatus(String lifecycleStatus) { this.lifecycleStatus = lifecycleStatus; }
    public String getCadence() { return cadence; }
    public void setCadence(String cadence) { this.cadence = cadence; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public OffsetDateTime getScheduledFor() { return scheduledFor; }
    public void setScheduledFor(OffsetDateTime scheduledFor) { this.scheduledFor = scheduledFor; }
    public OffsetDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(OffsetDateTime startedAt) { this.startedAt = startedAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
