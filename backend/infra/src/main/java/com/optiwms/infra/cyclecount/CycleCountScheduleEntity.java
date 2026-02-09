package com.optiwms.infra.cyclecount;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity for automated cycle count scheduling
 * Supports quarterly, monthly, weekly, or custom frequency
 */
@Entity
@Table(name = "cycle_count_schedules")
public class CycleCountScheduleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "warehouse_id", columnDefinition = "UUID", nullable = false)
    private UUID warehouseId;

    @Column(name = "frequency", length = 20, nullable = false)
    private String frequency; // quarterly, monthly, weekly, custom

    @Column(name = "interval_days")
    private Integer intervalDays; // For custom frequency

    @Column(name = "next_scheduled_date", nullable = false)
    private LocalDate nextScheduledDate;

    @Column(name = "location_pattern", length = 100)
    private String locationPattern; // NULL = all locations, 'A%' = zone A, etc.

    @Column(name = "auto_create")
    private Boolean autoCreate;

    @Column(name = "auto_assign_workers")
    private Boolean autoAssignWorkers;

    @Column(name = "active")
    private Boolean active;

    @Column(name = "created_by", columnDefinition = "UUID")
    private UUID createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (autoCreate == null) {
            autoCreate = true;
        }
        if (autoAssignWorkers == null) {
            autoAssignWorkers = false;
        }
        if (active == null) {
            active = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public Integer getIntervalDays() {
        return intervalDays;
    }

    public void setIntervalDays(Integer intervalDays) {
        this.intervalDays = intervalDays;
    }

    public LocalDate getNextScheduledDate() {
        return nextScheduledDate;
    }

    public void setNextScheduledDate(LocalDate nextScheduledDate) {
        this.nextScheduledDate = nextScheduledDate;
    }

    public String getLocationPattern() {
        return locationPattern;
    }

    public void setLocationPattern(String locationPattern) {
        this.locationPattern = locationPattern;
    }

    public Boolean getAutoCreate() {
        return autoCreate;
    }

    public void setAutoCreate(Boolean autoCreate) {
        this.autoCreate = autoCreate;
    }

    public Boolean getAutoAssignWorkers() {
        return autoAssignWorkers;
    }

    public void setAutoAssignWorkers(Boolean autoAssignWorkers) {
        this.autoAssignWorkers = autoAssignWorkers;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
