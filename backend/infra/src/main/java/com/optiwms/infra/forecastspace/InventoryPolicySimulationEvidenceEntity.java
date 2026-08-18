package com.optiwms.infra.forecastspace;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "inventory_policy_simulation_evidence")
public class InventoryPolicySimulationEvidenceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "policy_run_id", nullable = false)
    private UUID policyRunId;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "material_id", nullable = false)
    private UUID materialId;

    @Column(name = "service_level_target", nullable = false)
    private BigDecimal serviceLevelTarget;
    @Column(name = "simulated_fill_rate")
    private BigDecimal simulatedFillRate;
    @Column(name = "current_expected_cost")
    private BigDecimal currentExpectedCost;
    @Column(name = "proposed_expected_cost")
    private BigDecimal proposedExpectedCost;
    @Column(name = "expected_cost_delta")
    private BigDecimal expectedCostDelta;
    @Column(name = "stockout_days_current")
    private Integer stockoutDaysCurrent;
    @Column(name = "stockout_days_proposed")
    private Integer stockoutDaysProposed;
    @Column(name = "capacity_feasible", nullable = false)
    private Boolean capacityFeasible;
    @Column(name = "simulation_method", nullable = false, length = 128)
    private String simulationMethod;

    // Percentiles of the simulated lead-time demand, so the fill-rate figure can be
    // interrogated rather than taken on trust.
    @Column(name = "demand_p5")
    private BigDecimal demandP5;
    @Column(name = "demand_p25")
    private BigDecimal demandP25;
    @Column(name = "demand_p50")
    private BigDecimal demandP50;
    @Column(name = "demand_p75")
    private BigDecimal demandP75;
    @Column(name = "demand_p95")
    private BigDecimal demandP95;

    /** One-factor-at-a-time sensitivity of fill rate to each input, seed held fixed. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sensitivity_json", columnDefinition = "jsonb")
    private String sensitivityJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_lineage", nullable = false, columnDefinition = "jsonb")
    private String sourceLineage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (capacityFeasible == null) capacityFeasible = false;
        if (sourceLineage == null) sourceLineage = "{}";
        createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getPolicyRunId() { return policyRunId; }
    public void setPolicyRunId(UUID policyRunId) { this.policyRunId = policyRunId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public BigDecimal getServiceLevelTarget() { return serviceLevelTarget; }
    public void setServiceLevelTarget(BigDecimal serviceLevelTarget) { this.serviceLevelTarget = serviceLevelTarget; }
    public BigDecimal getSimulatedFillRate() { return simulatedFillRate; }
    public void setSimulatedFillRate(BigDecimal simulatedFillRate) { this.simulatedFillRate = simulatedFillRate; }
    public BigDecimal getCurrentExpectedCost() { return currentExpectedCost; }
    public void setCurrentExpectedCost(BigDecimal currentExpectedCost) { this.currentExpectedCost = currentExpectedCost; }
    public BigDecimal getProposedExpectedCost() { return proposedExpectedCost; }
    public void setProposedExpectedCost(BigDecimal proposedExpectedCost) { this.proposedExpectedCost = proposedExpectedCost; }
    public BigDecimal getExpectedCostDelta() { return expectedCostDelta; }
    public void setExpectedCostDelta(BigDecimal expectedCostDelta) { this.expectedCostDelta = expectedCostDelta; }
    public Integer getStockoutDaysCurrent() { return stockoutDaysCurrent; }
    public void setStockoutDaysCurrent(Integer stockoutDaysCurrent) { this.stockoutDaysCurrent = stockoutDaysCurrent; }
    public Integer getStockoutDaysProposed() { return stockoutDaysProposed; }
    public void setStockoutDaysProposed(Integer stockoutDaysProposed) { this.stockoutDaysProposed = stockoutDaysProposed; }
    public Boolean getCapacityFeasible() { return capacityFeasible; }
    public void setCapacityFeasible(Boolean capacityFeasible) { this.capacityFeasible = capacityFeasible; }
    public String getSimulationMethod() { return simulationMethod; }
    public void setSimulationMethod(String simulationMethod) { this.simulationMethod = simulationMethod; }
    public String getSourceLineage() { return sourceLineage; }
    public void setSourceLineage(String sourceLineage) { this.sourceLineage = sourceLineage; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public BigDecimal getDemandP5() { return demandP5; }
    public void setDemandP5(BigDecimal demandP5) { this.demandP5 = demandP5; }
    public BigDecimal getDemandP25() { return demandP25; }
    public void setDemandP25(BigDecimal demandP25) { this.demandP25 = demandP25; }
    public BigDecimal getDemandP50() { return demandP50; }
    public void setDemandP50(BigDecimal demandP50) { this.demandP50 = demandP50; }
    public BigDecimal getDemandP75() { return demandP75; }
    public void setDemandP75(BigDecimal demandP75) { this.demandP75 = demandP75; }
    public BigDecimal getDemandP95() { return demandP95; }
    public void setDemandP95(BigDecimal demandP95) { this.demandP95 = demandP95; }
    public String getSensitivityJson() { return sensitivityJson; }
    public void setSensitivityJson(String sensitivityJson) { this.sensitivityJson = sensitivityJson; }
}
