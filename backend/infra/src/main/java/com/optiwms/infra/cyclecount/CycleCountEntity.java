package com.optiwms.infra.cyclecount;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "cycle_counts")
public class CycleCountEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "count_number", unique = true, nullable = false, length = 50)
    private String countNumber;

    @Column(name = "warehouse_id", columnDefinition = "UUID")
    private UUID warehouseId;

    @Column(name = "location_code", length = 50)
    private String locationCode;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "assigned_workers", columnDefinition = "UUID[]")
    private UUID[] assignedWorkers;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "counted_by", columnDefinition = "UUID")
    private UUID countedBy;

    @Column(name = "counted_at")
    private LocalDateTime countedAt;

    @Column(name = "variance", precision = 15, scale = 2)
    private BigDecimal variance;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // Re-count workflow fields (V15 migration)
    @Column(name = "recount_required")
    private Boolean recountRequired;

    @Column(name = "recount_count")
    private Integer recountCount;

    @Column(name = "previous_variance", precision = 15, scale = 2)
    private BigDecimal previousVariance;

    @Column(name = "variance_threshold", precision = 15, scale = 2)
    private BigDecimal varianceThreshold;

    @Column(name = "final_variance", precision = 15, scale = 2)
    private BigDecimal finalVariance;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "scheduled";
        }
        if (recountRequired == null) {
            recountRequired = false;
        }
        if (recountCount == null) {
            recountCount = 0;
        }
        if (varianceThreshold == null) {
            varianceThreshold = new BigDecimal("5.0"); // Default threshold: 5 units
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getCountNumber() { return countNumber; }
    public void setCountNumber(String countNumber) { this.countNumber = countNumber; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
    public LocalDate getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }
    public UUID[] getAssignedWorkers() { return assignedWorkers; }
    public void setAssignedWorkers(UUID[] assignedWorkers) { this.assignedWorkers = assignedWorkers; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UUID getCountedBy() { return countedBy; }
    public void setCountedBy(UUID countedBy) { this.countedBy = countedBy; }
    public LocalDateTime getCountedAt() { return countedAt; }
    public void setCountedAt(LocalDateTime countedAt) { this.countedAt = countedAt; }
    public BigDecimal getVariance() { return variance; }
    public void setVariance(BigDecimal variance) { this.variance = variance; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Boolean getRecountRequired() { return recountRequired; }
    public void setRecountRequired(Boolean recountRequired) { this.recountRequired = recountRequired; }
    public Integer getRecountCount() { return recountCount; }
    public void setRecountCount(Integer recountCount) { this.recountCount = recountCount; }
    public BigDecimal getPreviousVariance() { return previousVariance; }
    public void setPreviousVariance(BigDecimal previousVariance) { this.previousVariance = previousVariance; }
    public BigDecimal getVarianceThreshold() { return varianceThreshold; }
    public void setVarianceThreshold(BigDecimal varianceThreshold) { this.varianceThreshold = varianceThreshold; }
    public BigDecimal getFinalVariance() { return finalVariance; }
    public void setFinalVariance(BigDecimal finalVariance) { this.finalVariance = finalVariance; }
}

