package com.optiwms.infra.forecastspace;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "space_optimization_lines")
public class SpaceOptimizationLineEntity {
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
    @Column(name = "source_policy_line_id")
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID sourcePolicyLineId;
    @Column(name = "material_code", nullable = false, length = 50)
    private String materialCode;
    @Column(name = "material_type", length = 32)
    private String materialType;
    @Column(name = "current_primary_location_code", length = 128)
    private String currentPrimaryLocationCode;
    @Column(name = "recommended_primary_location_code", length = 128)
    private String recommendedPrimaryLocationCode;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recommended_reserve_locations", columnDefinition = "jsonb")
    private String recommendedReserveLocations;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "released_location_codes", columnDefinition = "jsonb")
    private String releasedLocationCodes;
    @Column(name = "required_active_pick_pallet_positions", nullable = false)
    private Integer requiredActivePickPalletPositions;
    @Column(name = "required_reserve_pallet_positions", nullable = false)
    private Integer requiredReservePalletPositions;
    @Column(name = "compatible", nullable = false)
    private Boolean compatible;
    @Column(name = "distance_saved_meters", nullable = false)
    private BigDecimal distanceSavedMeters;
    @Column(name = "space_saved_pallet_positions", nullable = false)
    private BigDecimal spaceSavedPalletPositions;
    @Column(name = "space_needed_pallet_positions", nullable = false)
    private BigDecimal spaceNeededPalletPositions;
    @Column(name = "move_cost_score", nullable = false)
    private BigDecimal moveCostScore;
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
        if (requiredActivePickPalletPositions == null) requiredActivePickPalletPositions = 1;
        if (requiredReservePalletPositions == null) requiredReservePalletPositions = 0;
        if (compatible == null) compatible = true;
        if (distanceSavedMeters == null) distanceSavedMeters = BigDecimal.ZERO;
        if (spaceSavedPalletPositions == null) spaceSavedPalletPositions = BigDecimal.ZERO;
        if (spaceNeededPalletPositions == null) spaceNeededPalletPositions = BigDecimal.ZERO;
        if (moveCostScore == null) moveCostScore = BigDecimal.ZERO;
        if (recommendationStatus == null) recommendationStatus = "DATA_INSUFFICIENT";
        if (managerOverride == null) managerOverride = false;
    }

    @PreUpdate
    protected void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getRunId() { return runId; }
    public void setRunId(UUID runId) { this.runId = runId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public UUID getSourcePolicyLineId() { return sourcePolicyLineId; }
    public void setSourcePolicyLineId(UUID sourcePolicyLineId) { this.sourcePolicyLineId = sourcePolicyLineId; }
    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
    public String getMaterialType() { return materialType; }
    public void setMaterialType(String materialType) { this.materialType = materialType; }
    public String getCurrentPrimaryLocationCode() { return currentPrimaryLocationCode; }
    public void setCurrentPrimaryLocationCode(String currentPrimaryLocationCode) { this.currentPrimaryLocationCode = currentPrimaryLocationCode; }
    public String getRecommendedPrimaryLocationCode() { return recommendedPrimaryLocationCode; }
    public void setRecommendedPrimaryLocationCode(String recommendedPrimaryLocationCode) { this.recommendedPrimaryLocationCode = recommendedPrimaryLocationCode; }
    public String getRecommendedReserveLocations() { return recommendedReserveLocations; }
    public void setRecommendedReserveLocations(String recommendedReserveLocations) { this.recommendedReserveLocations = recommendedReserveLocations; }
    public String getReleasedLocationCodes() { return releasedLocationCodes; }
    public void setReleasedLocationCodes(String releasedLocationCodes) { this.releasedLocationCodes = releasedLocationCodes; }
    public Integer getRequiredActivePickPalletPositions() { return requiredActivePickPalletPositions; }
    public void setRequiredActivePickPalletPositions(Integer requiredActivePickPalletPositions) { this.requiredActivePickPalletPositions = requiredActivePickPalletPositions; }
    public Integer getRequiredReservePalletPositions() { return requiredReservePalletPositions; }
    public void setRequiredReservePalletPositions(Integer requiredReservePalletPositions) { this.requiredReservePalletPositions = requiredReservePalletPositions; }
    public Boolean getCompatible() { return compatible; }
    public void setCompatible(Boolean compatible) { this.compatible = compatible; }
    public BigDecimal getDistanceSavedMeters() { return distanceSavedMeters; }
    public void setDistanceSavedMeters(BigDecimal distanceSavedMeters) { this.distanceSavedMeters = distanceSavedMeters; }
    public BigDecimal getSpaceSavedPalletPositions() { return spaceSavedPalletPositions; }
    public void setSpaceSavedPalletPositions(BigDecimal spaceSavedPalletPositions) { this.spaceSavedPalletPositions = spaceSavedPalletPositions; }
    public BigDecimal getSpaceNeededPalletPositions() { return spaceNeededPalletPositions; }
    public void setSpaceNeededPalletPositions(BigDecimal spaceNeededPalletPositions) { this.spaceNeededPalletPositions = spaceNeededPalletPositions; }
    public BigDecimal getMoveCostScore() { return moveCostScore; }
    public void setMoveCostScore(BigDecimal moveCostScore) { this.moveCostScore = moveCostScore; }
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
