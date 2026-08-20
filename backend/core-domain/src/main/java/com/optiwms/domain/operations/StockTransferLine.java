package com.optiwms.domain.operations;

import com.optiwms.domain.common.BaseEntity;

import java.util.UUID;

public class StockTransferLine extends BaseEntity {
    private UUID transferId;
    private Integer lineNumber;
    private UUID materialId;
    private UUID sourceWarehouseId;
    private String sourceLocationCode;
    private UUID destWarehouseId;
    private String destLocationCode;
    private Integer requestedQuantity;
    private Integer movedQuantity;
    private String status;
    private UUID assignedWorkerId;
    /**
     * The stock_transfer task this line is executed through. Carried on the line so a client can
     * scope a routing session to the real task; routing validates the id against the tasks table,
     * and sending the line id instead was rejected as "Task not found".
     */
    private UUID taskId;
    private UUID planningCycleId;
    private UUID slottingPlanLineId;
    private String notes;

    public UUID getTransferId() { return transferId; }
    public void setTransferId(UUID transferId) { this.transferId = transferId; }
    public Integer getLineNumber() { return lineNumber; }
    public void setLineNumber(Integer lineNumber) { this.lineNumber = lineNumber; }
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
    public Integer getRequestedQuantity() { return requestedQuantity; }
    public void setRequestedQuantity(Integer requestedQuantity) { this.requestedQuantity = requestedQuantity; }
    public Integer getMovedQuantity() { return movedQuantity; }
    public void setMovedQuantity(Integer movedQuantity) { this.movedQuantity = movedQuantity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }
    public UUID getAssignedWorkerId() { return assignedWorkerId; }
    public void setAssignedWorkerId(UUID assignedWorkerId) { this.assignedWorkerId = assignedWorkerId; }
    public UUID getPlanningCycleId() { return planningCycleId; }
    public void setPlanningCycleId(UUID planningCycleId) { this.planningCycleId = planningCycleId; }
    public UUID getSlottingPlanLineId() { return slottingPlanLineId; }
    public void setSlottingPlanLineId(UUID slottingPlanLineId) { this.slottingPlanLineId = slottingPlanLineId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
