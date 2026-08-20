package com.optiwms.domain.orders;

import java.math.BigDecimal;
import java.util.UUID;

public class OrderItem {
    private UUID id;
    private UUID orderId;
    private UUID materialId;
    private Integer quantity;
    private BigDecimal unitPrice;
    private Integer pickedQuantity;
    private Integer receivedQuantity;
    private Integer packedQuantity;
    private String locationCode;
    private java.math.BigDecimal weightKg;
    private java.math.BigDecimal heightCm;
    private java.math.BigDecimal lengthCm;
    private java.math.BigDecimal widthCm;
    private String batchNumber;
    private java.time.LocalDate manufactureDate;
    private java.time.LocalDate expiryDate;
    private String status;

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public void setOrderId(UUID orderId) {
        this.orderId = orderId;
    }

    public UUID getMaterialId() {
        return materialId;
    }

    public void setMaterialId(UUID materialId) {
        this.materialId = materialId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Integer getPickedQuantity() {
        return pickedQuantity;
    }

    public void setPickedQuantity(Integer pickedQuantity) {
        this.pickedQuantity = pickedQuantity;
    }

    public Integer getReceivedQuantity() {
        return receivedQuantity;
    }

    public void setReceivedQuantity(Integer receivedQuantity) {
        this.receivedQuantity = receivedQuantity;
    }

    public Integer getPackedQuantity() {
        return packedQuantity;
    }

    public void setPackedQuantity(Integer packedQuantity) {
        this.packedQuantity = packedQuantity;
    }

    public String getLocationCode() {
        return locationCode;
    }

    public void setLocationCode(String locationCode) {
        this.locationCode = locationCode;
    }

    public java.math.BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(java.math.BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public java.math.BigDecimal getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(java.math.BigDecimal heightCm) {
        this.heightCm = heightCm;
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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getBatchNumber() {
        return batchNumber;
    }

    public void setBatchNumber(String batchNumber) {
        this.batchNumber = batchNumber;
    }

    public java.time.LocalDate getManufactureDate() {
        return manufactureDate;
    }

    public void setManufactureDate(java.time.LocalDate manufactureDate) {
        this.manufactureDate = manufactureDate;
    }

    public java.time.LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(java.time.LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }
}
