package com.optiwms.domain.orders;

import java.math.BigDecimal;
import java.util.UUID;

public class OrderItem {
    private UUID id;
    private UUID orderId;
    private UUID materialId;
    private BigDecimal quantity;
    private BigDecimal unitPrice;
    private BigDecimal pickedQuantity;
    private BigDecimal packedQuantity;
    private String locationCode;
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

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public BigDecimal getPickedQuantity() {
        return pickedQuantity;
    }

    public void setPickedQuantity(BigDecimal pickedQuantity) {
        this.pickedQuantity = pickedQuantity;
    }

    public BigDecimal getPackedQuantity() {
        return packedQuantity;
    }

    public void setPackedQuantity(BigDecimal packedQuantity) {
        this.packedQuantity = packedQuantity;
    }

    public String getLocationCode() {
        return locationCode;
    }

    public void setLocationCode(String locationCode) {
        this.locationCode = locationCode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}

