package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_transfer_lines")
public class StockTransferLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "transfer_id", columnDefinition = "UUID", nullable = false)
    private UUID transferId;

    @Column(name = "line_number", nullable = false)
    private Integer lineNumber;

    @Column(name = "material_id", columnDefinition = "UUID", nullable = false)
    private UUID materialId;

    @Column(name = "source_warehouse_id", columnDefinition = "UUID")
    private UUID sourceWarehouseId;

    @Column(name = "source_location_code", length = 50)
    private String sourceLocationCode;

    @Column(name = "dest_warehouse_id", columnDefinition = "UUID")
    private UUID destWarehouseId;

    @Column(name = "dest_location_code", length = 50)
    private String destLocationCode;

    @Column(name = "requested_quantity", nullable = false)
    private Integer requestedQuantity;

    @Column(name = "moved_quantity", nullable = false)
    private Integer movedQuantity;

    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @Column(name = "assigned_worker_id", columnDefinition = "UUID")
    private UUID assignedWorkerId;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (movedQuantity == null) {
            movedQuantity = 0;
        }
        if (status == null) {
            status = "open";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
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
    public UUID getAssignedWorkerId() { return assignedWorkerId; }
    public void setAssignedWorkerId(UUID assignedWorkerId) { this.assignedWorkerId = assignedWorkerId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
