package com.optiwms.domain.dock;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public class DockAppointment extends BaseEntity {
    private String appointmentNumber;
    private UUID dockDoorId;
    private UUID warehouseId;
    private String appointmentType; // inbound, outbound
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;
    private LocalDateTime actualStart;
    private LocalDateTime actualEnd;
    private UUID inboundOrderId;
    private UUID outboundOrderId;
    private UUID supplierId;
    private String carrierName;
    private String trailerNumber;
    private String status; // scheduled, checked_in, in_progress, completed, cancelled
    private String notes;

    // Getters and Setters
    public String getAppointmentNumber() {
        return appointmentNumber;
    }

    public void setAppointmentNumber(String appointmentNumber) {
        this.appointmentNumber = appointmentNumber;
    }

    public UUID getDockDoorId() {
        return dockDoorId;
    }

    public void setDockDoorId(UUID dockDoorId) {
        this.dockDoorId = dockDoorId;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getAppointmentType() {
        return appointmentType;
    }

    public void setAppointmentType(String appointmentType) {
        this.appointmentType = appointmentType;
    }

    public LocalDateTime getScheduledStart() {
        return scheduledStart;
    }

    public void setScheduledStart(LocalDateTime scheduledStart) {
        this.scheduledStart = scheduledStart;
    }

    public LocalDateTime getScheduledEnd() {
        return scheduledEnd;
    }

    public void setScheduledEnd(LocalDateTime scheduledEnd) {
        this.scheduledEnd = scheduledEnd;
    }

    public LocalDateTime getActualStart() {
        return actualStart;
    }

    public void setActualStart(LocalDateTime actualStart) {
        this.actualStart = actualStart;
    }

    public LocalDateTime getActualEnd() {
        return actualEnd;
    }

    public void setActualEnd(LocalDateTime actualEnd) {
        this.actualEnd = actualEnd;
    }

    public UUID getInboundOrderId() {
        return inboundOrderId;
    }

    public void setInboundOrderId(UUID inboundOrderId) {
        this.inboundOrderId = inboundOrderId;
    }

    public UUID getOutboundOrderId() {
        return outboundOrderId;
    }

    public void setOutboundOrderId(UUID outboundOrderId) {
        this.outboundOrderId = outboundOrderId;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(UUID supplierId) {
        this.supplierId = supplierId;
    }

    public String getCarrierName() {
        return carrierName;
    }

    public void setCarrierName(String carrierName) {
        this.carrierName = carrierName;
    }

    public String getTrailerNumber() {
        return trailerNumber;
    }

    public void setTrailerNumber(String trailerNumber) {
        this.trailerNumber = trailerNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}

