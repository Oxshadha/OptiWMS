package com.optiwms.domain.master;

import com.optiwms.domain.common.BaseEntity;
import java.math.BigDecimal;

public class Material extends BaseEntity {
    private String materialCode;
    private String description;
    private String unitType;
    private String storageType;
    private String materialType;

    // Physical dimensions
    private BigDecimal lengthCm;
    private BigDecimal widthCm;
    private BigDecimal heightCm;
    private BigDecimal weightKg;
    private BigDecimal volumeCm3;
    private BigDecimal palletSpaces;
    private Integer unitsPerPallet;
    private Boolean stackable;
    private Integer maxStackHeight;
    private Boolean temperatureControlled;
    private Boolean hazardous;
    private Boolean fragile;

    // Weight limits (SOP enforcement)
    private BigDecimal maxPalletWeightKg;
    private BigDecimal minOrderQuantity;
    private String handlingUnitType;
    private BigDecimal unitsPerHandlingUnit;
    private BigDecimal orderMultiple;
    private BigDecimal safetyStockLevel;

    // ABC/FMS Classification for storage zone assignment
    private String abcClass; // A, B, C (volume-based)
    private String fmsClass; // F, M, S (frequency-based)
    private String preferredZone; // A, B, C, D (derived from amalgamated analysis)

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

    public BigDecimal getLengthCm() {
        return lengthCm;
    }

    public void setLengthCm(BigDecimal lengthCm) {
        this.lengthCm = lengthCm;
    }

    public BigDecimal getWidthCm() {
        return widthCm;
    }

    public void setWidthCm(BigDecimal widthCm) {
        this.widthCm = widthCm;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(BigDecimal heightCm) {
        this.heightCm = heightCm;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public BigDecimal getVolumeCm3() {
        return volumeCm3;
    }

    public void setVolumeCm3(BigDecimal volumeCm3) {
        this.volumeCm3 = volumeCm3;
    }

    public BigDecimal getPalletSpaces() {
        return palletSpaces;
    }

    public void setPalletSpaces(BigDecimal palletSpaces) {
        this.palletSpaces = palletSpaces;
    }

    public Integer getUnitsPerPallet() {
        return unitsPerPallet;
    }

    public void setUnitsPerPallet(Integer unitsPerPallet) {
        this.unitsPerPallet = unitsPerPallet;
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

    public BigDecimal getMaxPalletWeightKg() {
        return maxPalletWeightKg;
    }

    public void setMaxPalletWeightKg(BigDecimal maxPalletWeightKg) {
        this.maxPalletWeightKg = maxPalletWeightKg;
    }

    public BigDecimal getMinOrderQuantity() {
        return minOrderQuantity;
    }

    public void setMinOrderQuantity(BigDecimal minOrderQuantity) {
        this.minOrderQuantity = minOrderQuantity;
    }

    public String getHandlingUnitType() {
        return handlingUnitType;
    }

    public void setHandlingUnitType(String handlingUnitType) {
        this.handlingUnitType = handlingUnitType;
    }

    public BigDecimal getUnitsPerHandlingUnit() {
        return unitsPerHandlingUnit;
    }

    public void setUnitsPerHandlingUnit(BigDecimal unitsPerHandlingUnit) {
        this.unitsPerHandlingUnit = unitsPerHandlingUnit;
    }

    public BigDecimal getOrderMultiple() {
        return orderMultiple;
    }

    public void setOrderMultiple(BigDecimal orderMultiple) {
        this.orderMultiple = orderMultiple;
    }

    public BigDecimal getSafetyStockLevel() {
        return safetyStockLevel;
    }

    public void setSafetyStockLevel(BigDecimal safetyStockLevel) {
        this.safetyStockLevel = safetyStockLevel;
    }

    // ABC/FMS Classification getters and setters
    public String getAbcClass() {
        return abcClass;
    }

    public void setAbcClass(String abcClass) {
        this.abcClass = abcClass;
    }

    public String getFmsClass() {
        return fmsClass;
    }

    public void setFmsClass(String fmsClass) {
        this.fmsClass = fmsClass;
    }

    public String getPreferredZone() {
        return preferredZone;
    }

    public void setPreferredZone(String preferredZone) {
        this.preferredZone = preferredZone;
    }
}
