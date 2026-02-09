package com.optiwms.infra.dock;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "yard_trailers")
public class YardTrailerEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "trailer_number", unique = true, nullable = false, length = 50)
    private String trailerNumber;

    @Column(name = "warehouse_id", columnDefinition = "UUID", nullable = false)
    private UUID warehouseId;

    @Column(name = "carrier_name", length = 200)
    private String carrierName;

    @Column(name = "inbound_order_id", columnDefinition = "UUID")
    private UUID inboundOrderId;

    @Column(name = "supplier_id", columnDefinition = "UUID")
    private UUID supplierId;

    @Column(name = "arrived_at")
    private LocalDateTime arrivedAt;

    @Column(name = "wait_time_minutes")
    private Integer waitTimeMinutes;

    @Column(name = "status", length = 20)
    private String status; // waiting, assigned, unloading, completed

    @Column(name = "assigned_dock_door_id", columnDefinition = "UUID")
    private UUID assignedDockDoorId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "waiting";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}

