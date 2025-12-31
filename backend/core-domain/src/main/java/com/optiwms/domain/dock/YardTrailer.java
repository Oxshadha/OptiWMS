package com.optiwms.domain.dock;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public class YardTrailer extends BaseEntity {
    private String trailerNumber;
    private UUID warehouseId;
    private String carrierName;
    private UUID inboundOrderId;
    private UUID supplierId;
    private LocalDateTime arrivedAt;
    private Integer waitTimeMinutes;
    private String status; // waiting, assigned, unloading, completed
    private UUID assignedDockDoorId;

    // Getters and Setters
    public String getTrailerNumber() {
        return trailerNumber;
    }

    public void setTrailerNumber(String trailerNumber) {
        this.trailerNumber = trailerNumber;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getCarrierName() {
        return carrierName;
    }

    public void setCarrierName(String carrierName) {
        this.carrierName = carrierName;
    }

    public UUID getInboundOrderId() {
        return inboundOrderId;
    }

    public void setInboundOrderId(UUID inboundOrderId) {
        this.inboundOrderId = inboundOrderId;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(UUID supplierId) {
        this.supplierId = supplierId;
    }

    public LocalDateTime getArrivedAt() {
        return arrivedAt;
    }

    public void setArrivedAt(LocalDateTime arrivedAt) {
        this.arrivedAt = arrivedAt;
    }

    public Integer getWaitTimeMinutes() {
        return waitTimeMinutes;
    }

    public void setWaitTimeMinutes(Integer waitTimeMinutes) {
        this.waitTimeMinutes = waitTimeMinutes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getAssignedDockDoorId() {
        return assignedDockDoorId;
    }

    public void setAssignedDockDoorId(UUID assignedDockDoorId) {
        this.assignedDockDoorId = assignedDockDoorId;
    }
}

