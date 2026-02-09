package com.optiwms.infra.master;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "location_levels")
public class LocationLevelEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "location_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID locationId;

    @Column(name = "level_number", nullable = false)
    private Integer levelNumber;

    @Column(name = "weight_capacity_kg", nullable = false, precision = 10, scale = 2)
    private BigDecimal weightCapacityKg;

    @Column(name = "pallet_capacity", nullable = false)
    private Integer palletCapacity;

    @Column(name = "height_cm", precision = 10, scale = 2)
    private BigDecimal heightCm;

    @Column(name = "accessibility_rating")
    private Integer accessibilityRating;

    @Column(name = "current_weight_kg", precision = 10, scale = 2)
    private BigDecimal currentWeightKg;

    @Column(name = "current_pallet_count")
    private Integer currentPalletCount;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = OffsetDateTime.now();
        if (this.currentWeightKg == null) {
            this.currentWeightKg = BigDecimal.ZERO;
        }
        if (this.currentPalletCount == null) {
            this.currentPalletCount = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getLocationId() { return locationId; }
    public void setLocationId(UUID locationId) { this.locationId = locationId; }
    public Integer getLevelNumber() { return levelNumber; }
    public void setLevelNumber(Integer levelNumber) { this.levelNumber = levelNumber; }
    public BigDecimal getWeightCapacityKg() { return weightCapacityKg; }
    public void setWeightCapacityKg(BigDecimal weightCapacityKg) { this.weightCapacityKg = weightCapacityKg; }
    public Integer getPalletCapacity() { return palletCapacity; }
    public void setPalletCapacity(Integer palletCapacity) { this.palletCapacity = palletCapacity; }
    public BigDecimal getHeightCm() { return heightCm; }
    public void setHeightCm(BigDecimal heightCm) { this.heightCm = heightCm; }
    public Integer getAccessibilityRating() { return accessibilityRating; }
    public void setAccessibilityRating(Integer accessibilityRating) { this.accessibilityRating = accessibilityRating; }
    public BigDecimal getCurrentWeightKg() { return currentWeightKg; }
    public void setCurrentWeightKg(BigDecimal currentWeightKg) { this.currentWeightKg = currentWeightKg; }
    public Integer getCurrentPalletCount() { return currentPalletCount; }
    public void setCurrentPalletCount(Integer currentPalletCount) { this.currentPalletCount = currentPalletCount; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}

