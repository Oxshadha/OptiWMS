package com.optiwms.infra.slotting;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "slotting_plan_lines")
public class SlottingPlanLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "plan_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID planId;

    @Column(name = "material_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID materialId;

    @Column(name = "material_code", nullable = false, length = 50)
    private String materialCode;

    @Column(name = "material_type", length = 32)
    private String materialType;

    @Column(name = "current_primary_location_code", length = 128)
    private String currentPrimaryLocationCode;

    @Column(name = "recommended_primary_location_code", length = 128)
    private String recommendedPrimaryLocationCode;

    @Column(name = "recommended_primary_location_id")
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID recommendedPrimaryLocationId;

    @Column(name = "final_primary_location_code", length = 128)
    private String finalPrimaryLocationCode;

    @Column(name = "manager_override", nullable = false)
    private Boolean managerOverride;

    @Column(name = "override_reason", columnDefinition = "TEXT")
    private String overrideReason;

    @Column(name = "locked", nullable = false)
    private Boolean locked;

    @Column(name = "active_pick_pallet_positions", nullable = false)
    private Integer activePickPalletPositions;

    @Column(name = "required_reserve_pallet_positions", nullable = false)
    private Integer requiredReservePalletPositions;

    @Column(name = "max_stock_pallet_positions", nullable = false)
    private Integer maxStockPalletPositions;

    @Column(name = "rop")
    private BigDecimal rop;

    @Column(name = "max_stock")
    private BigDecimal maxStock;

    @Column(name = "distance_saved_meters")
    private BigDecimal distanceSavedMeters;

    @Column(name = "zone_upgrade", length = 64)
    private String zoneUpgrade;

    @Column(name = "move_reason", columnDefinition = "TEXT")
    private String moveReason;

    @Column(name = "gain_score")
    private BigDecimal gainScore;

    @Column(name = "relocation_applied", nullable = false)
    private Boolean relocationApplied;

    @Column(name = "objective_cost")
    private BigDecimal objectiveCost;

    @Column(name = "relocation_flag", nullable = false)
    private Boolean relocationFlag;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "constraint_snapshot", columnDefinition = "jsonb")
    private String constraintSnapshot;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        applyDefaults();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    private void applyDefaults() {
        if (managerOverride == null) managerOverride = false;
        if (locked == null) locked = false;
        if (activePickPalletPositions == null) activePickPalletPositions = 1;
        if (requiredReservePalletPositions == null) requiredReservePalletPositions = 0;
        if (maxStockPalletPositions == null) maxStockPalletPositions = 1;
        if (relocationApplied == null) relocationApplied = false;
        if (relocationFlag == null) relocationFlag = false;
        if (status == null) status = "PROPOSED";
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPlanId() { return planId; }
    public void setPlanId(UUID planId) { this.planId = planId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
    public String getMaterialType() { return materialType; }
    public void setMaterialType(String materialType) { this.materialType = materialType; }
    public String getCurrentPrimaryLocationCode() { return currentPrimaryLocationCode; }
    public void setCurrentPrimaryLocationCode(String currentPrimaryLocationCode) { this.currentPrimaryLocationCode = currentPrimaryLocationCode; }
    public String getRecommendedPrimaryLocationCode() { return recommendedPrimaryLocationCode; }
    public void setRecommendedPrimaryLocationCode(String recommendedPrimaryLocationCode) { this.recommendedPrimaryLocationCode = recommendedPrimaryLocationCode; }
    public UUID getRecommendedPrimaryLocationId() { return recommendedPrimaryLocationId; }
    public void setRecommendedPrimaryLocationId(UUID recommendedPrimaryLocationId) { this.recommendedPrimaryLocationId = recommendedPrimaryLocationId; }
    public String getFinalPrimaryLocationCode() { return finalPrimaryLocationCode; }
    public void setFinalPrimaryLocationCode(String finalPrimaryLocationCode) { this.finalPrimaryLocationCode = finalPrimaryLocationCode; }
    public Boolean getManagerOverride() { return managerOverride; }
    public void setManagerOverride(Boolean managerOverride) { this.managerOverride = managerOverride; }
    public String getOverrideReason() { return overrideReason; }
    public void setOverrideReason(String overrideReason) { this.overrideReason = overrideReason; }
    public Boolean getLocked() { return locked; }
    public void setLocked(Boolean locked) { this.locked = locked; }
    public Integer getActivePickPalletPositions() { return activePickPalletPositions; }
    public void setActivePickPalletPositions(Integer activePickPalletPositions) { this.activePickPalletPositions = activePickPalletPositions; }
    public Integer getRequiredReservePalletPositions() { return requiredReservePalletPositions; }
    public void setRequiredReservePalletPositions(Integer requiredReservePalletPositions) { this.requiredReservePalletPositions = requiredReservePalletPositions; }
    public Integer getMaxStockPalletPositions() { return maxStockPalletPositions; }
    public void setMaxStockPalletPositions(Integer maxStockPalletPositions) { this.maxStockPalletPositions = maxStockPalletPositions; }
    public BigDecimal getRop() { return rop; }
    public void setRop(BigDecimal rop) { this.rop = rop; }
    public BigDecimal getMaxStock() { return maxStock; }
    public void setMaxStock(BigDecimal maxStock) { this.maxStock = maxStock; }
    public BigDecimal getDistanceSavedMeters() { return distanceSavedMeters; }
    public void setDistanceSavedMeters(BigDecimal distanceSavedMeters) { this.distanceSavedMeters = distanceSavedMeters; }
    public String getZoneUpgrade() { return zoneUpgrade; }
    public void setZoneUpgrade(String zoneUpgrade) { this.zoneUpgrade = zoneUpgrade; }
    public String getMoveReason() { return moveReason; }
    public void setMoveReason(String moveReason) { this.moveReason = moveReason; }
    public BigDecimal getGainScore() { return gainScore; }
    public void setGainScore(BigDecimal gainScore) { this.gainScore = gainScore; }
    public Boolean getRelocationApplied() { return relocationApplied; }
    public void setRelocationApplied(Boolean relocationApplied) { this.relocationApplied = relocationApplied; }
    public BigDecimal getObjectiveCost() { return objectiveCost; }
    public void setObjectiveCost(BigDecimal objectiveCost) { this.objectiveCost = objectiveCost; }
    public Boolean getRelocationFlag() { return relocationFlag; }
    public void setRelocationFlag(Boolean relocationFlag) { this.relocationFlag = relocationFlag; }
    public String getConstraintSnapshot() { return constraintSnapshot; }
    public void setConstraintSnapshot(String constraintSnapshot) { this.constraintSnapshot = constraintSnapshot; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
