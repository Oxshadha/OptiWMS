package com.optiwms.domain.operations;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class ReturnRecord extends BaseEntity {
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
    private String returnFlow;
    private String qcOutcome;
    private String supplierResponseStatus;
    private String supplierResponseNotes;
    private Boolean falseReturnRequest;
    private Boolean customerCareFlag;
    private UUID followupOrderId;
    private LocalDateTime closedAt;
    private LocalDateTime lastStatusChangedAt;

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
    public String getReturnFlow() { return returnFlow; }
    public void setReturnFlow(String returnFlow) { this.returnFlow = returnFlow; }
    public String getQcOutcome() { return qcOutcome; }
    public void setQcOutcome(String qcOutcome) { this.qcOutcome = qcOutcome; }
    public String getSupplierResponseStatus() { return supplierResponseStatus; }
    public void setSupplierResponseStatus(String supplierResponseStatus) { this.supplierResponseStatus = supplierResponseStatus; }
    public String getSupplierResponseNotes() { return supplierResponseNotes; }
    public void setSupplierResponseNotes(String supplierResponseNotes) { this.supplierResponseNotes = supplierResponseNotes; }
    public Boolean getFalseReturnRequest() { return falseReturnRequest; }
    public void setFalseReturnRequest(Boolean falseReturnRequest) { this.falseReturnRequest = falseReturnRequest; }
    public Boolean getCustomerCareFlag() { return customerCareFlag; }
    public void setCustomerCareFlag(Boolean customerCareFlag) { this.customerCareFlag = customerCareFlag; }
    public UUID getFollowupOrderId() { return followupOrderId; }
    public void setFollowupOrderId(UUID followupOrderId) { this.followupOrderId = followupOrderId; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public LocalDateTime getLastStatusChangedAt() { return lastStatusChangedAt; }
    public void setLastStatusChangedAt(LocalDateTime lastStatusChangedAt) { this.lastStatusChangedAt = lastStatusChangedAt; }
}
