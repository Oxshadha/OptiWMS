package com.optiwms.infra.master;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "materials")
public class MaterialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "material_code", unique = true, nullable = false, length = 50)
    private String materialCode;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "unit_type", length = 20)
    private String unitType;

    @Column(name = "storage_type", length = 20)
    private String storageType;

    // New fields from V4 migration
    @Column(name = "material_type", length = 20)
    private String materialType;

    @Column(name = "storage_location_type", length = 20)
    private String storageLocationType;

    @Column(name = "requires_pallet")
    private Boolean requiresPallet;

    // Physical dimensions (from V12 migration)
    @Column(name = "length_cm", precision = 10, scale = 2)
    private java.math.BigDecimal lengthCm;

    @Column(name = "width_cm", precision = 10, scale = 2)
    private java.math.BigDecimal widthCm;

    @Column(name = "height_cm", precision = 10, scale = 2)
    private java.math.BigDecimal heightCm;

    @Column(name = "weight_kg", precision = 10, scale = 2)
    private java.math.BigDecimal weightKg;

    @Column(name = "volume_cm3", precision = 15, scale = 2)
    private java.math.BigDecimal volumeCm3;

    @Column(name = "pallet_spaces", precision = 10, scale = 2)
    private java.math.BigDecimal palletSpaces;

    @Column(name = "stackable")
    private Boolean stackable;

    @Column(name = "max_stack_height")
    private Integer maxStackHeight;

    @Column(name = "temperature_controlled")
    private Boolean temperatureControlled;

    @Column(name = "hazardous")
    private Boolean hazardous;

    @Column(name = "fragile")
    private Boolean fragile;

    // Weight limits (from V15 migration - SOP enforcement)
    @Column(name = "max_pallet_weight_kg", precision = 10, scale = 2)
    private java.math.BigDecimal maxPalletWeightKg;

    @Column(name = "min_order_quantity", precision = 15, scale = 2)
    private java.math.BigDecimal minOrderQuantity;

    @Column(name = "safety_stock_level", precision = 15, scale = 2)
    private java.math.BigDecimal safetyStockLevel;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getMaterialCode() {
        return materialCode;
    }

    public void setMaterialCode(String materialCode) {
        this.materialCode = materialCode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getUnitType() {
        return unitType;
    }

    public void setUnitType(String unitType) {
        this.unitType = unitType;
    }

    public String getStorageType() {
        return storageType;
    }

    public void setStorageType(String storageType) {
        this.storageType = storageType;
    }

    public String getMaterialType() {
        return materialType;
    }

    public void setMaterialType(String materialType) {
        this.materialType = materialType;
    }

    public String getStorageLocationType() {
        return storageLocationType;
    }

    public void setStorageLocationType(String storageLocationType) {
        this.storageLocationType = storageLocationType;
    }

    public Boolean getRequiresPallet() {
        return requiresPallet;
    }

    public void setRequiresPallet(Boolean requiresPallet) {
        this.requiresPallet = requiresPallet;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public java.math.BigDecimal getLengthCm() {
        return lengthCm;
    }

    public void setLengthCm(java.math.BigDecimal lengthCm) {
        this.lengthCm = lengthCm;
    }

    public java.math.BigDecimal getWidthCm() {
        return widthCm;
    }

    public void setWidthCm(java.math.BigDecimal widthCm) {
        this.widthCm = widthCm;
    }

    public java.math.BigDecimal getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(java.math.BigDecimal heightCm) {
        this.heightCm = heightCm;
    }

    public java.math.BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(java.math.BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public java.math.BigDecimal getVolumeCm3() {
        return volumeCm3;
    }

    public void setVolumeCm3(java.math.BigDecimal volumeCm3) {
        this.volumeCm3 = volumeCm3;
    }

    public java.math.BigDecimal getPalletSpaces() {
        return palletSpaces;
    }

    public void setPalletSpaces(java.math.BigDecimal palletSpaces) {
        this.palletSpaces = palletSpaces;
    }

    public Boolean getStackable() {
        return stackable;
    }

    public void setStackable(Boolean stackable) {
        this.stackable = stackable;
    }

    public Integer getMaxStackHeight() {
        return maxStackHeight;
    }

    public void setMaxStackHeight(Integer maxStackHeight) {
        this.maxStackHeight = maxStackHeight;
    }

    public Boolean getTemperatureControlled() {
        return temperatureControlled;
    }

    public void setTemperatureControlled(Boolean temperatureControlled) {
        this.temperatureControlled = temperatureControlled;
    }

    public Boolean getHazardous() {
        return hazardous;
    }

    public void setHazardous(Boolean hazardous) {
        this.hazardous = hazardous;
    }

    public Boolean getFragile() {
        return fragile;
    }

    public void setFragile(Boolean fragile) {
        this.fragile = fragile;
    }

    public java.math.BigDecimal getMaxPalletWeightKg() {
        return maxPalletWeightKg;
    }

    public void setMaxPalletWeightKg(java.math.BigDecimal maxPalletWeightKg) {
        this.maxPalletWeightKg = maxPalletWeightKg;
    }

    public java.math.BigDecimal getMinOrderQuantity() {
        return minOrderQuantity;
    }

    public void setMinOrderQuantity(java.math.BigDecimal minOrderQuantity) {
        this.minOrderQuantity = minOrderQuantity;
    }

    public java.math.BigDecimal getSafetyStockLevel() {
        return safetyStockLevel;
    }

    public void setSafetyStockLevel(java.math.BigDecimal safetyStockLevel) {
        this.safetyStockLevel = safetyStockLevel;
    }
}
