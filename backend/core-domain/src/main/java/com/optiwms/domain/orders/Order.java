package com.optiwms.domain.orders;

import com.optiwms.domain.common.BaseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class Order extends BaseEntity {
    private String orderNumber;
    private String orderType; // inbound, outbound
    private java.util.UUID customerId;
    private java.util.UUID supplierId;
    private java.util.UUID warehouseId;
    private String status;
    private String priority;
    private LocalDate orderDate;
    private LocalDate expectedDate;
    private BigDecimal totalAmount;
    private String notes;
    private java.util.UUID receivedBy;
    private java.util.UUID pickedBy;
    private java.util.UUID packedBy;
    private java.util.UUID shippedBy;
    private LocalDateTime receivedAt;
    private LocalDateTime pickedAt;
    private LocalDateTime packedAt;
    private LocalDateTime shippedAt;

    // Getters and Setters
    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public String getOrderType() {
        return orderType;
    }

    public void setOrderType(String orderType) {
        this.orderType = orderType;
    }

    public java.util.UUID getCustomerId() {
        return customerId;
    }

    public void setCustomerId(java.util.UUID customerId) {
        this.customerId = customerId;
    }

    public java.util.UUID getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(java.util.UUID supplierId) {
        this.supplierId = supplierId;
    }

    public java.util.UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(java.util.UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public LocalDate getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(LocalDate orderDate) {
        this.orderDate = orderDate;
    }

    public LocalDate getExpectedDate() {
        return expectedDate;
    }

    public void setExpectedDate(LocalDate expectedDate) {
        this.expectedDate = expectedDate;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public java.util.UUID getReceivedBy() { return receivedBy; }
    public void setReceivedBy(java.util.UUID receivedBy) { this.receivedBy = receivedBy; }
    public java.util.UUID getPickedBy() { return pickedBy; }
    public void setPickedBy(java.util.UUID pickedBy) { this.pickedBy = pickedBy; }
    public java.util.UUID getPackedBy() { return packedBy; }
    public void setPackedBy(java.util.UUID packedBy) { this.packedBy = packedBy; }
    public java.util.UUID getShippedBy() { return shippedBy; }
    public void setShippedBy(java.util.UUID shippedBy) { this.shippedBy = shippedBy; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
    public LocalDateTime getPickedAt() { return pickedAt; }
    public void setPickedAt(LocalDateTime pickedAt) { this.pickedAt = pickedAt; }
    public LocalDateTime getPackedAt() { return packedAt; }
    public void setPackedAt(LocalDateTime packedAt) { this.packedAt = packedAt; }
    public LocalDateTime getShippedAt() { return shippedAt; }
    public void setShippedAt(LocalDateTime shippedAt) { this.shippedAt = shippedAt; }
}

