package com.optiwms.domain.returns;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDate;
import java.util.UUID;

public class Return extends BaseEntity {
    private String returnNumber;
    private UUID originalOrderId;
    private UUID customerId;
    private UUID warehouseId;
    private LocalDate returnDate;
    private String reason;
    private String status;
    private String resolution;
    private UUID receivedBy;
    private UUID inspectedBy;

    // Getters and Setters
    public String getReturnNumber() { return returnNumber; }
    public void setReturnNumber(String returnNumber) { this.returnNumber = returnNumber; }
    public UUID getOriginalOrderId() { return originalOrderId; }
    public void setOriginalOrderId(UUID originalOrderId) { this.originalOrderId = originalOrderId; }
    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public LocalDate getReturnDate() { return returnDate; }
    public void setReturnDate(LocalDate returnDate) { this.returnDate = returnDate; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }
    public UUID getReceivedBy() { return receivedBy; }
    public void setReceivedBy(UUID receivedBy) { this.receivedBy = receivedBy; }
    public UUID getInspectedBy() { return inspectedBy; }
    public void setInspectedBy(UUID inspectedBy) { this.inspectedBy = inspectedBy; }
}

