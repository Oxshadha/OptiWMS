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
    private Boolean stackable;
    private Integer maxStackHeight;
    private Boolean temperatureControlled;
    private Boolean hazardous;
    private Boolean fragile;
    
    // Weight limits (SOP enforcement)
    private BigDecimal maxPalletWeightKg;
    private BigDecimal minOrderQuantity;
    private BigDecimal safetyStockLevel;

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

    public BigDecimal getSafetyStockLevel() {
        return safetyStockLevel;
    }

    public void setSafetyStockLevel(BigDecimal safetyStockLevel) {
        this.safetyStockLevel = safetyStockLevel;
    }
}

