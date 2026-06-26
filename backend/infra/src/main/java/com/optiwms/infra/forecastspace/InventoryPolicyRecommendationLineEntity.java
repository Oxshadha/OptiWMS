package com.optiwms.infra.forecastspace;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "inventory_policy_recommendation_lines")
public class InventoryPolicyRecommendationLineEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "run_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID runId;

    @Column(name = "material_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID materialId;

    @Column(name = "material_code", nullable = false, length = 50)
    private String materialCode;

    @Column(name = "material_type", length = 32)
    private String materialType;

    @Column(name = "current_stock", nullable = false)
    private BigDecimal currentStock;
    @Column(name = "current_available_stock", nullable = false)
    private BigDecimal currentAvailableStock;
    @Column(name = "current_min_stock")
    private BigDecimal currentMinStock;
    @Column(name = "current_max_stock")
    private BigDecimal currentMaxStock;
    @Column(name = "current_reorder_point")
    private BigDecimal currentReorderPoint;
    @Column(name = "forecast_p10")
    private BigDecimal forecastP10;
    @Column(name = "forecast_p50")
    private BigDecimal forecastP50;
    @Column(name = "forecast_p90")
    private BigDecimal forecastP90;
    @Column(name = "lead_time_days")
    private Integer leadTimeDays;
    @Column(name = "lead_time_std_days")
    private BigDecimal leadTimeStdDays;
    @Column(name = "moq")
    private BigDecimal moq;
    @Column(name = "order_multiple")
    private BigDecimal orderMultiple;
    @Column(name = "unit_cost")
    private BigDecimal unitCost;
    @Column(name = "expiry_limited_max_stock")
    private BigDecimal expiryLimitedMaxStock;
    @Column(name = "proposed_min_stock")
    private BigDecimal proposedMinStock;
    @Column(name = "proposed_max_stock")
    private BigDecimal proposedMaxStock;
    @Column(name = "proposed_reorder_point")
    private BigDecimal proposedReorderPoint;
    @Column(name = "proposed_target_stock")
    private BigDecimal proposedTargetStock;
    @Column(name = "proposed_order_qty")
    private BigDecimal proposedOrderQty;
    @Column(name = "stock_delta", nullable = false)
    private BigDecimal stockDelta;
    @Column(name = "pallet_positions_delta", nullable = false)
    private BigDecimal palletPositionsDelta;
    @Column(name = "holding_cost_delta", nullable = false)
    private BigDecimal holdingCostDelta;
    @Column(name = "stockout_risk_score", nullable = false)
    private BigDecimal stockoutRiskScore;
    @Column(name = "expiry_risk_score", nullable = false)
    private BigDecimal expiryRiskScore;
    @Column(name = "confidence_score", nullable = false)
    private BigDecimal confidenceScore;
    @Column(name = "recommendation_status", nullable = false, length = 32)
    private String recommendationStatus;
    @Column(name = "rationale", columnDefinition = "TEXT")
    private String rationale;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "constraint_snapshot", columnDefinition = "jsonb")
    private String constraintSnapshot;
    @Column(name = "manager_override", nullable = false)
    private Boolean managerOverride;
    @Column(name = "override_reason", columnDefinition = "TEXT")
    private String overrideReason;
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (currentStock == null) currentStock = BigDecimal.ZERO;
        if (currentAvailableStock == null) currentAvailableStock = BigDecimal.ZERO;
        if (stockDelta == null) stockDelta = BigDecimal.ZERO;
        if (palletPositionsDelta == null) palletPositionsDelta = BigDecimal.ZERO;
        if (holdingCostDelta == null) holdingCostDelta = BigDecimal.ZERO;
        if (stockoutRiskScore == null) stockoutRiskScore = BigDecimal.ZERO;
        if (expiryRiskScore == null) expiryRiskScore = BigDecimal.ZERO;
        if (confidenceScore == null) confidenceScore = BigDecimal.ZERO;
        if (recommendationStatus == null) recommendationStatus = "DATA_INSUFFICIENT";
        if (managerOverride == null) managerOverride = false;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getRunId() { return runId; }
    public void setRunId(UUID runId) { this.runId = runId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
    public String getMaterialType() { return materialType; }
    public void setMaterialType(String materialType) { this.materialType = materialType; }
    public BigDecimal getCurrentStock() { return currentStock; }
    public void setCurrentStock(BigDecimal currentStock) { this.currentStock = currentStock; }
    public BigDecimal getCurrentAvailableStock() { return currentAvailableStock; }
    public void setCurrentAvailableStock(BigDecimal currentAvailableStock) { this.currentAvailableStock = currentAvailableStock; }
    public BigDecimal getCurrentMinStock() { return currentMinStock; }
    public void setCurrentMinStock(BigDecimal currentMinStock) { this.currentMinStock = currentMinStock; }
    public BigDecimal getCurrentMaxStock() { return currentMaxStock; }
    public void setCurrentMaxStock(BigDecimal currentMaxStock) { this.currentMaxStock = currentMaxStock; }
    public BigDecimal getCurrentReorderPoint() { return currentReorderPoint; }
    public void setCurrentReorderPoint(BigDecimal currentReorderPoint) { this.currentReorderPoint = currentReorderPoint; }
    public BigDecimal getForecastP10() { return forecastP10; }
    public void setForecastP10(BigDecimal forecastP10) { this.forecastP10 = forecastP10; }
    public BigDecimal getForecastP50() { return forecastP50; }
    public void setForecastP50(BigDecimal forecastP50) { this.forecastP50 = forecastP50; }
    public BigDecimal getForecastP90() { return forecastP90; }
    public void setForecastP90(BigDecimal forecastP90) { this.forecastP90 = forecastP90; }
    public Integer getLeadTimeDays() { return leadTimeDays; }
    public void setLeadTimeDays(Integer leadTimeDays) { this.leadTimeDays = leadTimeDays; }
    public BigDecimal getLeadTimeStdDays() { return leadTimeStdDays; }
    public void setLeadTimeStdDays(BigDecimal leadTimeStdDays) { this.leadTimeStdDays = leadTimeStdDays; }
    public BigDecimal getMoq() { return moq; }
    public void setMoq(BigDecimal moq) { this.moq = moq; }
    public BigDecimal getOrderMultiple() { return orderMultiple; }
    public void setOrderMultiple(BigDecimal orderMultiple) { this.orderMultiple = orderMultiple; }
    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }
    public BigDecimal getExpiryLimitedMaxStock() { return expiryLimitedMaxStock; }
    public void setExpiryLimitedMaxStock(BigDecimal expiryLimitedMaxStock) { this.expiryLimitedMaxStock = expiryLimitedMaxStock; }
    public BigDecimal getProposedMinStock() { return proposedMinStock; }
    public void setProposedMinStock(BigDecimal proposedMinStock) { this.proposedMinStock = proposedMinStock; }
    public BigDecimal getProposedMaxStock() { return proposedMaxStock; }
    public void setProposedMaxStock(BigDecimal proposedMaxStock) { this.proposedMaxStock = proposedMaxStock; }
    public BigDecimal getProposedReorderPoint() { return proposedReorderPoint; }
    public void setProposedReorderPoint(BigDecimal proposedReorderPoint) { this.proposedReorderPoint = proposedReorderPoint; }
    public BigDecimal getProposedTargetStock() { return proposedTargetStock; }
    public void setProposedTargetStock(BigDecimal proposedTargetStock) { this.proposedTargetStock = proposedTargetStock; }
    public BigDecimal getProposedOrderQty() { return proposedOrderQty; }
    public void setProposedOrderQty(BigDecimal proposedOrderQty) { this.proposedOrderQty = proposedOrderQty; }
    public BigDecimal getStockDelta() { return stockDelta; }
    public void setStockDelta(BigDecimal stockDelta) { this.stockDelta = stockDelta; }
    public BigDecimal getPalletPositionsDelta() { return palletPositionsDelta; }
    public void setPalletPositionsDelta(BigDecimal palletPositionsDelta) { this.palletPositionsDelta = palletPositionsDelta; }
    public BigDecimal getHoldingCostDelta() { return holdingCostDelta; }
    public void setHoldingCostDelta(BigDecimal holdingCostDelta) { this.holdingCostDelta = holdingCostDelta; }
    public BigDecimal getStockoutRiskScore() { return stockoutRiskScore; }
    public void setStockoutRiskScore(BigDecimal stockoutRiskScore) { this.stockoutRiskScore = stockoutRiskScore; }
    public BigDecimal getExpiryRiskScore() { return expiryRiskScore; }
    public void setExpiryRiskScore(BigDecimal expiryRiskScore) { this.expiryRiskScore = expiryRiskScore; }
    public BigDecimal getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(BigDecimal confidenceScore) { this.confidenceScore = confidenceScore; }
    public String getRecommendationStatus() { return recommendationStatus; }
    public void setRecommendationStatus(String recommendationStatus) { this.recommendationStatus = recommendationStatus; }
    public String getRationale() { return rationale; }
    public void setRationale(String rationale) { this.rationale = rationale; }
    public String getConstraintSnapshot() { return constraintSnapshot; }
    public void setConstraintSnapshot(String constraintSnapshot) { this.constraintSnapshot = constraintSnapshot; }
    public Boolean getManagerOverride() { return managerOverride; }
    public void setManagerOverride(Boolean managerOverride) { this.managerOverride = managerOverride; }
    public String getOverrideReason() { return overrideReason; }
    public void setOverrideReason(String overrideReason) { this.overrideReason = overrideReason; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
