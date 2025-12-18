package com.optiwms.domain.operations;

import com.optiwms.domain.common.BaseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class StockTransfer extends BaseEntity {
    private String transferNumber;
    private String transferType;
    private UUID materialId;
    private UUID sourceWarehouseId;
    private String sourceLocationCode;
    private UUID destWarehouseId;
    private String destLocationCode;
    private BigDecimal quantity;
    private String status;
    private String notes;
    private UUID dispatchedBy;
    private LocalDateTime dispatchedAt;
    private UUID receivedBy;
    private LocalDateTime receivedAt;

    // Getters and Setters
    public String getTransferNumber() { return transferNumber; }
    public void setTransferNumber(String transferNumber) { this.transferNumber = transferNumber; }
    public String getTransferType() { return transferType; }
    public void setTransferType(String transferType) { this.transferType = transferType; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public UUID getSourceWarehouseId() { return sourceWarehouseId; }
    public void setSourceWarehouseId(UUID sourceWarehouseId) { this.sourceWarehouseId = sourceWarehouseId; }
    public String getSourceLocationCode() { return sourceLocationCode; }
    public void setSourceLocationCode(String sourceLocationCode) { this.sourceLocationCode = sourceLocationCode; }
    public UUID getDestWarehouseId() { return destWarehouseId; }
    public void setDestWarehouseId(UUID destWarehouseId) { this.destWarehouseId = destWarehouseId; }
    public String getDestLocationCode() { return destLocationCode; }
    public void setDestLocationCode(String destLocationCode) { this.destLocationCode = destLocationCode; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getDispatchedBy() { return dispatchedBy; }
    public void setDispatchedBy(UUID dispatchedBy) { this.dispatchedBy = dispatchedBy; }
    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }
    public UUID getReceivedBy() { return receivedBy; }
    public void setReceivedBy(UUID receivedBy) { this.receivedBy = receivedBy; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
}

