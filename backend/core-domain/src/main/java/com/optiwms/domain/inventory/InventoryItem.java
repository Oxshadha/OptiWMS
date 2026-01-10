package com.optiwms.domain.inventory;

import com.optiwms.domain.common.BaseEntity;

import java.math.BigDecimal;

public class InventoryItem extends BaseEntity {
    private java.util.UUID materialId;
    private java.util.UUID warehouseId;
    private String locationCode;
    private Integer quantity;
    private Integer availableQuantity;
    private Integer reservedQuantity;
    private BigDecimal bufferStock;
    private BigDecimal maxStock;
    private BigDecimal minStock;
    private BigDecimal reorderPoint;
    private Integer stackingQuantity;
    private BigDecimal moq;
    private Integer leadTimeDays;
    private String status;
    private String materialType; // raw_material, packaging_material, product
    
    // Additional planning fields
    private Integer bufferDays;
    private BigDecimal leadTimeMonths;
    private BigDecimal ropInDays;
    private BigDecimal varianceDemand;
    private BigDecimal varianceLeadTimeDemand;
    private BigDecimal difference;
    private Integer orderDeliveryDays;
    private BigDecimal orderQuantity;
    private BigDecimal palletRequirement;

    // Getters and Setters
    public java.util.UUID getMaterialId() {
        return materialId;
    }

    public void setMaterialId(java.util.UUID materialId) {
        this.materialId = materialId;
    }

    public java.util.UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(java.util.UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getLocationCode() {
        return locationCode;
    }

    public void setLocationCode(String locationCode) {
        this.locationCode = locationCode;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Integer getAvailableQuantity() {
        return availableQuantity;
    }

    public void setAvailableQuantity(Integer availableQuantity) {
        this.availableQuantity = availableQuantity;
    }

    public Integer getReservedQuantity() {
        return reservedQuantity;
    }

    public void setReservedQuantity(Integer reservedQuantity) {
        this.reservedQuantity = reservedQuantity;
    }

    public BigDecimal getBufferStock() {
        return bufferStock;
    }

    public void setBufferStock(BigDecimal bufferStock) {
        this.bufferStock = bufferStock;
    }

    public BigDecimal getMaxStock() {
        return maxStock;
    }

    public void setMaxStock(BigDecimal maxStock) {
        this.maxStock = maxStock;
    }

    public BigDecimal getMinStock() {
        return minStock;
    }

    public void setMinStock(BigDecimal minStock) {
        this.minStock = minStock;
    }

    public BigDecimal getReorderPoint() {
        return reorderPoint;
    }

    public void setReorderPoint(BigDecimal reorderPoint) {
        this.reorderPoint = reorderPoint;
    }

    public Integer getStackingQuantity() {
        return stackingQuantity;
    }

    public void setStackingQuantity(Integer stackingQuantity) {
        this.stackingQuantity = stackingQuantity;
    }

    public BigDecimal getMoq() {
        return moq;
    }

    public void setMoq(BigDecimal moq) {
        this.moq = moq;
    }

    public Integer getLeadTimeDays() {
        return leadTimeDays;
    }

    public void setLeadTimeDays(Integer leadTimeDays) {
        this.leadTimeDays = leadTimeDays;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMaterialType() {
        return materialType;
    }

    public void setMaterialType(String materialType) {
        this.materialType = materialType;
    }

    public Integer getBufferDays() { return bufferDays; }
    public void setBufferDays(Integer bufferDays) { this.bufferDays = bufferDays; }

    public BigDecimal getLeadTimeMonths() { return leadTimeMonths; }
    public void setLeadTimeMonths(BigDecimal leadTimeMonths) { this.leadTimeMonths = leadTimeMonths; }

    public BigDecimal getRopInDays() { return ropInDays; }
    public void setRopInDays(BigDecimal ropInDays) { this.ropInDays = ropInDays; }

    public BigDecimal getVarianceDemand() { return varianceDemand; }
    public void setVarianceDemand(BigDecimal varianceDemand) { this.varianceDemand = varianceDemand; }

    public BigDecimal getVarianceLeadTimeDemand() { return varianceLeadTimeDemand; }
    public void setVarianceLeadTimeDemand(BigDecimal varianceLeadTimeDemand) { this.varianceLeadTimeDemand = varianceLeadTimeDemand; }

    public BigDecimal getDifference() { return difference; }
    public void setDifference(BigDecimal difference) { this.difference = difference; }

    public Integer getOrderDeliveryDays() { return orderDeliveryDays; }
    public void setOrderDeliveryDays(Integer orderDeliveryDays) { this.orderDeliveryDays = orderDeliveryDays; }

    public BigDecimal getOrderQuantity() { return orderQuantity; }
    public void setOrderQuantity(BigDecimal orderQuantity) { this.orderQuantity = orderQuantity; }

    public BigDecimal getPalletRequirement() { return palletRequirement; }
    public void setPalletRequirement(BigDecimal palletRequirement) { this.palletRequirement = palletRequirement; }
}

