package com.optiwms.domain.quality;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public class QualityCheck extends BaseEntity {
    private String checkNumber;
    private UUID orderId;
    private UUID materialId;
    private UUID warehouseId;
    private String checkType;
    private String status;
    private String result;
    private String notes;
    private UUID checkedBy;
    private LocalDateTime checkedAt;

    // Getters and Setters
    public String getCheckNumber() { return checkNumber; }
    public void setCheckNumber(String checkNumber) { this.checkNumber = checkNumber; }
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public String getCheckType() { return checkType; }
    public void setCheckType(String checkType) { this.checkType = checkType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getCheckedBy() { return checkedBy; }
    public void setCheckedBy(UUID checkedBy) { this.checkedBy = checkedBy; }
    public LocalDateTime getCheckedAt() { return checkedAt; }
    public void setCheckedAt(LocalDateTime checkedAt) { this.checkedAt = checkedAt; }
}

