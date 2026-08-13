package com.optiwms.domain.operations;

import com.optiwms.domain.common.BaseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class StockTransfer extends BaseEntity {
    private String transferNumber;
    private String transferType;
    private UUID planningCycleId;
    private UUID materialId;
    private UUID sourceWarehouseId;
    private String sourceLocationCode;
    private UUID destWarehouseId;
    private String destLocationCode;
    private Integer quantity;
    private String status;
    private String notes;
    private UUID createdBy;
    private UUID releasedBy;
    private LocalDateTime releasedAt;
    private UUID dispatchedBy;
    private LocalDateTime dispatchedAt;
    private UUID receivedBy;
    private LocalDateTime receivedAt;
    private List<StockTransferLine> lines = new ArrayList<>();

    // Getters and Setters
    public String getTransferNumber() { return transferNumber; }
    public void setTransferNumber(String transferNumber) { this.transferNumber = transferNumber; }
    public String getTransferType() { return transferType; }
    public void setTransferType(String transferType) { this.transferType = transferType; }
    public UUID getPlanningCycleId() { return planningCycleId; }
    public void setPlanningCycleId(UUID planningCycleId) { this.planningCycleId = planningCycleId; }
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
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public UUID getReleasedBy() { return releasedBy; }
    public void setReleasedBy(UUID releasedBy) { this.releasedBy = releasedBy; }
    public LocalDateTime getReleasedAt() { return releasedAt; }
    public void setReleasedAt(LocalDateTime releasedAt) { this.releasedAt = releasedAt; }
    public UUID getDispatchedBy() { return dispatchedBy; }
    public void setDispatchedBy(UUID dispatchedBy) { this.dispatchedBy = dispatchedBy; }
    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }
    public UUID getReceivedBy() { return receivedBy; }
    public void setReceivedBy(UUID receivedBy) { this.receivedBy = receivedBy; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
    public List<StockTransferLine> getLines() { return lines; }
    public void setLines(List<StockTransferLine> lines) { this.lines = lines; }
}
