package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_transfers")
public class StockTransferEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "transfer_number", unique = true, nullable = false, length = 50)
    private String transferNumber;

    @Column(name = "transfer_type", nullable = false, length = 20)
    private String transferType; // intra_warehouse, inter_warehouse

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

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_by", columnDefinition = "UUID")
    private UUID createdBy;

    @Column(name = "released_by", columnDefinition = "UUID")
    private UUID releasedBy;

    @Column(name = "released_at")
    private LocalDateTime releasedAt;

    @Column(name = "dispatched_by", columnDefinition = "UUID")
    private UUID dispatchedBy;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "received_by", columnDefinition = "UUID")
    private UUID receivedBy;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "draft";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTransferNumber() { return transferNumber; }
    public void setTransferNumber(String transferNumber) { this.transferNumber = transferNumber; }
    public String getTransferType() { return transferType; }
    public void setTransferType(String transferType) { this.transferType = transferType; }
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
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public UUID getReleasedBy() { return releasedBy; }
    public void setReleasedBy(UUID releasedBy) { this.releasedBy = releasedBy; }
    public LocalDateTime getReleasedAt() { return releasedAt; }
    public void setReleasedAt(LocalDateTime releasedAt) { this.releasedAt = releasedAt; }
    public UUID getDispatchedBy() { return dispatchedBy; }
    public void setDispatchedBy(UUID dispatchedBy) { this.dispatchedBy = dispatchedBy; }
    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }
    public UUID getReceivedBy() { return receivedBy; }
    public void setReceivedBy(UUID receivedBy) { this.receivedBy = receivedBy; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
