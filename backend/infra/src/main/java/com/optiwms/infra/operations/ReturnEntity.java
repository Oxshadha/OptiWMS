package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "returns")
public class ReturnEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "return_number", unique = true, nullable = false)
    private String returnNumber;

    @Column(name = "original_order_id", columnDefinition = "UUID")
    private UUID originalOrderId;

    @Column(name = "customer_id", columnDefinition = "UUID")
    private UUID customerId;

    @Column(name = "warehouse_id", columnDefinition = "UUID")
    private UUID warehouseId;

    @Column(name = "return_date")
    private LocalDate returnDate;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "status")
    private String status;

    @Column(name = "resolution")
    private String resolution;

    @Column(name = "received_by", columnDefinition = "UUID")
    private UUID receivedBy;

    @Column(name = "inspected_by", columnDefinition = "UUID")
    private UUID inspectedBy;

    @Column(name = "return_flow", length = 20)
    private String returnFlow;

    @Column(name = "qc_outcome", length = 30)
    private String qcOutcome;

    @Column(name = "supplier_response_status", length = 30)
    private String supplierResponseStatus;

    @Column(name = "supplier_response_notes", columnDefinition = "TEXT")
    private String supplierResponseNotes;

    @Column(name = "false_return_request")
    private Boolean falseReturnRequest;

    @Column(name = "customer_care_flag")
    private Boolean customerCareFlag;

    @Column(name = "followup_order_id", columnDefinition = "UUID")
    private UUID followupOrderId;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "last_status_changed_at")
    private LocalDateTime lastStatusChangedAt;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
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
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
        if (this.status == null) {
            this.status = "pending";
        }
        if (this.falseReturnRequest == null) {
            this.falseReturnRequest = false;
        }
        if (this.customerCareFlag == null) {
            this.customerCareFlag = false;
        }
        if (this.returnFlow == null) {
            this.returnFlow = "unknown";
        }
        if (this.lastStatusChangedAt == null) {
            this.lastStatusChangedAt = LocalDateTime.now();
        }
    }
}
