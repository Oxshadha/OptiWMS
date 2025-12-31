package com.optiwms.domain.dock;

import com.optiwms.domain.common.BaseEntity;

import java.util.UUID;

public class DockDoor extends BaseEntity {
    private String doorNumber;
    private UUID warehouseId;
    private String location;
    private String status; // available, occupied, reserved, maintenance
    private UUID currentAppointmentId;

    // Getters and Setters
    public String getDoorNumber() {
        return doorNumber;
    }

    public void setDoorNumber(String doorNumber) {
        this.doorNumber = doorNumber;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getCurrentAppointmentId() {
        return currentAppointmentId;
    }

    public void setCurrentAppointmentId(UUID currentAppointmentId) {
        this.currentAppointmentId = currentAppointmentId;
    }
}

