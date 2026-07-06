package com.optiwms.infra.forecastspace;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "space_optimization_scenarios")
public class SpaceOptimizationScenarioEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "policy_line_id")
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID policyLineId;
    @Column(name = "space_line_id")
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID spaceLineId;
    @Column(name = "scenario_name", nullable = false, length = 64)
    private String scenarioName;
    @Column(name = "passed", nullable = false)
    private Boolean passed;
    @Column(name = "risk_score", nullable = false)
    private BigDecimal riskScore;
    @Column(name = "stockout_days_estimate", nullable = false)
    private BigDecimal stockoutDaysEstimate;
    @Column(name = "expiry_excess_units", nullable = false)
    private BigDecimal expiryExcessUnits;
    @Column(name = "space_shortfall_pallet_positions", nullable = false)
    private BigDecimal spaceShortfallPalletPositions;
    @Column(name = "explanation", columnDefinition = "TEXT")
    private String explanation;
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        if (passed == null) passed = true;
        if (riskScore == null) riskScore = BigDecimal.ZERO;
        if (stockoutDaysEstimate == null) stockoutDaysEstimate = BigDecimal.ZERO;
        if (expiryExcessUnits == null) expiryExcessUnits = BigDecimal.ZERO;
        if (spaceShortfallPalletPositions == null) spaceShortfallPalletPositions = BigDecimal.ZERO;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPolicyLineId() { return policyLineId; }
    public void setPolicyLineId(UUID policyLineId) { this.policyLineId = policyLineId; }
    public UUID getSpaceLineId() { return spaceLineId; }
    public void setSpaceLineId(UUID spaceLineId) { this.spaceLineId = spaceLineId; }
    public String getScenarioName() { return scenarioName; }
    public void setScenarioName(String scenarioName) { this.scenarioName = scenarioName; }
    public Boolean getPassed() { return passed; }
    public void setPassed(Boolean passed) { this.passed = passed; }
    public BigDecimal getRiskScore() { return riskScore; }
    public void setRiskScore(BigDecimal riskScore) { this.riskScore = riskScore; }
    public BigDecimal getStockoutDaysEstimate() { return stockoutDaysEstimate; }
    public void setStockoutDaysEstimate(BigDecimal stockoutDaysEstimate) { this.stockoutDaysEstimate = stockoutDaysEstimate; }
    public BigDecimal getExpiryExcessUnits() { return expiryExcessUnits; }
    public void setExpiryExcessUnits(BigDecimal expiryExcessUnits) { this.expiryExcessUnits = expiryExcessUnits; }
    public BigDecimal getSpaceShortfallPalletPositions() { return spaceShortfallPalletPositions; }
    public void setSpaceShortfallPalletPositions(BigDecimal spaceShortfallPalletPositions) { this.spaceShortfallPalletPositions = spaceShortfallPalletPositions; }
    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
