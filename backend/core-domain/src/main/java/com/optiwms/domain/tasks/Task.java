package com.optiwms.domain.tasks;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public class Task extends BaseEntity {
    private String taskNumber;
    private String taskType;
    private UUID warehouseId;
    private UUID assignedTo;
    private String priority;
    private String status;
    private LocalDateTime dueDate;
    private LocalDateTime completedAt;
    private UUID completedBy;
    private LocalDateTime startedAt;
    private String locationCode;
    private String referenceType;
    private UUID referenceId;
    /** Pallet (handling unit) sequence within the referenced line, 1-based. */
    private Integer handlingUnitSeq;
    private String notes;

    // Getters and Setters
    public String getTaskNumber() { return taskNumber; }
    public void setTaskNumber(String taskNumber) { this.taskNumber = taskNumber; }
    public String getTaskType() { return taskType; }
    public void setTaskType(String taskType) { this.taskType = taskType; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public UUID getAssignedTo() { return assignedTo; }
    public void setAssignedTo(UUID assignedTo) { this.assignedTo = assignedTo; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getDueDate() { return dueDate; }
    public void setDueDate(LocalDateTime dueDate) { this.dueDate = dueDate; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public UUID getCompletedBy() { return completedBy; }
    public void setCompletedBy(UUID completedBy) { this.completedBy = completedBy; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }
    public UUID getReferenceId() { return referenceId; }
    public void setReferenceId(UUID referenceId) { this.referenceId = referenceId; }

    public Integer getHandlingUnitSeq() { return handlingUnitSeq; }
    public void setHandlingUnitSeq(Integer handlingUnitSeq) { this.handlingUnitSeq = handlingUnitSeq; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
