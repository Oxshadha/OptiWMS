package com.optiwms.infra.forecastspace;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "space_optimization_runs")
public class SpaceOptimizationRunEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "warehouse_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;

    @Column(name = "policy_run_id")
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID policyRunId;

    @Column(name = "horizon_months", nullable = false)
    private Integer horizonMonths;
    @Column(name = "status", nullable = false, length = 32)
    private String status;
    @Column(name = "algorithm", nullable = false, length = 64)
    private String algorithm;
    @Column(name = "created_by", length = 128)
    private String createdBy;
    @Column(name = "approved_by", length = 128)
    private String approvedBy;
    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    @Column(name = "total_space_saved_pallet_positions", nullable = false)
    private BigDecimal totalSpaceSavedPalletPositions;
    @Column(name = "total_space_needed_pallet_positions", nullable = false)
    private BigDecimal totalSpaceNeededPalletPositions;
    @Column(name = "total_distance_saved_meters", nullable = false)
    private BigDecimal totalDistanceSavedMeters;
    @Column(name = "infeasible_count", nullable = false)
    private Integer infeasibleCount;
    @Column(name = "high_risk_count", nullable = false)
    private Integer highRiskCount;
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (horizonMonths == null) horizonMonths = 3;
        if (status == null) status = "DRAFT";
        if (algorithm == null) algorithm = "FORECAST_SPACE_HEURISTIC_V1";
        if (totalSpaceSavedPalletPositions == null) totalSpaceSavedPalletPositions = BigDecimal.ZERO;
        if (totalSpaceNeededPalletPositions == null) totalSpaceNeededPalletPositions = BigDecimal.ZERO;
        if (totalDistanceSavedMeters == null) totalDistanceSavedMeters = BigDecimal.ZERO;
        if (infeasibleCount == null) infeasibleCount = 0;
        if (highRiskCount == null) highRiskCount = 0;
    }

    @PreUpdate
    protected void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public UUID getPolicyRunId() { return policyRunId; }
    public void setPolicyRunId(UUID policyRunId) { this.policyRunId = policyRunId; }
    public Integer getHorizonMonths() { return horizonMonths; }
    public void setHorizonMonths(Integer horizonMonths) { this.horizonMonths = horizonMonths; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAlgorithm() { return algorithm; }
    public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public OffsetDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(OffsetDateTime approvedAt) { this.approvedAt = approvedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public BigDecimal getTotalSpaceSavedPalletPositions() { return totalSpaceSavedPalletPositions; }
    public void setTotalSpaceSavedPalletPositions(BigDecimal totalSpaceSavedPalletPositions) { this.totalSpaceSavedPalletPositions = totalSpaceSavedPalletPositions; }
    public BigDecimal getTotalSpaceNeededPalletPositions() { return totalSpaceNeededPalletPositions; }
    public void setTotalSpaceNeededPalletPositions(BigDecimal totalSpaceNeededPalletPositions) { this.totalSpaceNeededPalletPositions = totalSpaceNeededPalletPositions; }
    public BigDecimal getTotalDistanceSavedMeters() { return totalDistanceSavedMeters; }
    public void setTotalDistanceSavedMeters(BigDecimal totalDistanceSavedMeters) { this.totalDistanceSavedMeters = totalDistanceSavedMeters; }
    public Integer getInfeasibleCount() { return infeasibleCount; }
    public void setInfeasibleCount(Integer infeasibleCount) { this.infeasibleCount = infeasibleCount; }
    public Integer getHighRiskCount() { return highRiskCount; }
    public void setHighRiskCount(Integer highRiskCount) { this.highRiskCount = highRiskCount; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
