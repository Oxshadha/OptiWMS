package com.optiwms.infra.slotting;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "slotting_plans")
public class SlottingPlanEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "warehouse_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;

    @Column(name = "plan_code", nullable = false, length = 64)
    private String planCode;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_to", nullable = false)
    private LocalDate validTo;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "algorithm", nullable = false, length = 64)
    private String algorithm;

    @Column(name = "relocation_budget_pct", nullable = false)
    private BigDecimal relocationBudgetPct;

    @Column(name = "relocation_moves_applied", nullable = false)
    private Integer relocationMovesApplied;

    @Column(name = "total_moves_proposed", nullable = false)
    private Integer totalMovesProposed;

    @Column(name = "total_distance_saved_meters", nullable = false)
    private BigDecimal totalDistanceSavedMeters;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(name = "approved_by", length = 128)
    private String approvedBy;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "source_stats_at")
    private OffsetDateTime sourceStatsAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (status == null) {
            status = "DRAFT";
        }
        if (version == null) {
            version = 1;
        }
        if (algorithm == null) {
            algorithm = "HEURISTIC_MILP_V1";
        }
        if (relocationBudgetPct == null) {
            relocationBudgetPct = new BigDecimal("30.00");
        }
        if (relocationMovesApplied == null) {
            relocationMovesApplied = 0;
        }
        if (totalMovesProposed == null) {
            totalMovesProposed = 0;
        }
        if (totalDistanceSavedMeters == null) {
            totalDistanceSavedMeters = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate validFrom) { this.validFrom = validFrom; }
    public LocalDate getValidTo() { return validTo; }
    public void setValidTo(LocalDate validTo) { this.validTo = validTo; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getAlgorithm() { return algorithm; }
    public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }
    public BigDecimal getRelocationBudgetPct() { return relocationBudgetPct; }
    public void setRelocationBudgetPct(BigDecimal relocationBudgetPct) { this.relocationBudgetPct = relocationBudgetPct; }
    public Integer getRelocationMovesApplied() { return relocationMovesApplied; }
    public void setRelocationMovesApplied(Integer relocationMovesApplied) { this.relocationMovesApplied = relocationMovesApplied; }
    public Integer getTotalMovesProposed() { return totalMovesProposed; }
    public void setTotalMovesProposed(Integer totalMovesProposed) { this.totalMovesProposed = totalMovesProposed; }
    public BigDecimal getTotalDistanceSavedMeters() { return totalDistanceSavedMeters; }
    public void setTotalDistanceSavedMeters(BigDecimal totalDistanceSavedMeters) { this.totalDistanceSavedMeters = totalDistanceSavedMeters; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public OffsetDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(OffsetDateTime approvedAt) { this.approvedAt = approvedAt; }
    public OffsetDateTime getSourceStatsAt() { return sourceStatsAt; }
    public void setSourceStatsAt(OffsetDateTime sourceStatsAt) { this.sourceStatsAt = sourceStatsAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
