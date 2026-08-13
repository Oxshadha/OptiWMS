package com.optiwms.infra.forecastspace;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "inventory_policy_recommendation_runs")
public class InventoryPolicyRecommendationRunEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "warehouse_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;

    @Column(name = "horizon_months", nullable = false)
    private Integer horizonMonths;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "forecast_model_name", length = 128)
    private String forecastModelName;

    @Column(name = "forecast_run_id", length = 128)
    private String forecastRunId;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(name = "approved_by", length = 128)
    private String approvedBy;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "total_stock_delta", nullable = false)
    private BigDecimal totalStockDelta;

    @Column(name = "total_pallet_positions_delta", nullable = false)
    private BigDecimal totalPalletPositionsDelta;

    @Column(name = "estimated_holding_cost_delta", nullable = false)
    private BigDecimal estimatedHoldingCostDelta;

    @Column(name = "high_risk_count", nullable = false)
    private Integer highRiskCount;

    @Column(name = "data_insufficient_count", nullable = false)
    private Integer dataInsufficientCount;

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
        if (totalStockDelta == null) totalStockDelta = BigDecimal.ZERO;
        if (totalPalletPositionsDelta == null) totalPalletPositionsDelta = BigDecimal.ZERO;
        if (estimatedHoldingCostDelta == null) estimatedHoldingCostDelta = BigDecimal.ZERO;
        if (highRiskCount == null) highRiskCount = 0;
        if (dataInsufficientCount == null) dataInsufficientCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public Integer getHorizonMonths() { return horizonMonths; }
    public void setHorizonMonths(Integer horizonMonths) { this.horizonMonths = horizonMonths; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getForecastModelName() { return forecastModelName; }
    public void setForecastModelName(String forecastModelName) { this.forecastModelName = forecastModelName; }
    public String getForecastRunId() { return forecastRunId; }
    public void setForecastRunId(String forecastRunId) { this.forecastRunId = forecastRunId; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public OffsetDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(OffsetDateTime approvedAt) { this.approvedAt = approvedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public BigDecimal getTotalStockDelta() { return totalStockDelta; }
    public void setTotalStockDelta(BigDecimal totalStockDelta) { this.totalStockDelta = totalStockDelta; }
    public BigDecimal getTotalPalletPositionsDelta() { return totalPalletPositionsDelta; }
    public void setTotalPalletPositionsDelta(BigDecimal totalPalletPositionsDelta) { this.totalPalletPositionsDelta = totalPalletPositionsDelta; }
    public BigDecimal getEstimatedHoldingCostDelta() { return estimatedHoldingCostDelta; }
    public void setEstimatedHoldingCostDelta(BigDecimal estimatedHoldingCostDelta) { this.estimatedHoldingCostDelta = estimatedHoldingCostDelta; }
    public Integer getHighRiskCount() { return highRiskCount; }
    public void setHighRiskCount(Integer highRiskCount) { this.highRiskCount = highRiskCount; }
    public Integer getDataInsufficientCount() { return dataInsufficientCount; }
    public void setDataInsufficientCount(Integer dataInsufficientCount) { this.dataInsufficientCount = dataInsufficientCount; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
