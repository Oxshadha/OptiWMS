package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "grns")
public class GrnEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "grn_number", nullable = false, unique = true, length = 50)
    private String grnNumber;

    @Column(name = "po_id", columnDefinition = "UUID")
    private UUID poId;

    @Column(name = "supplier_id", columnDefinition = "UUID")
    private UUID supplierId;

    @Column(name = "warehouse_id", columnDefinition = "UUID")
    private UUID warehouseId;

    @Column(name = "received_date", nullable = false)
    private LocalDateTime receivedDate;

    @Column(name = "received_by", columnDefinition = "UUID")
    private UUID receivedBy;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (receivedDate == null) {
            receivedDate = LocalDateTime.now();
        }
        if (status == null) {
            status = "PENDING_QA";
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getGrnNumber() { return grnNumber; }
    public void setGrnNumber(String grnNumber) { this.grnNumber = grnNumber; }
    public UUID getPoId() { return poId; }
    public void setPoId(UUID poId) { this.poId = poId; }
    public UUID getSupplierId() { return supplierId; }
    public void setSupplierId(UUID supplierId) { this.supplierId = supplierId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public LocalDateTime getReceivedDate() { return receivedDate; }
    public void setReceivedDate(LocalDateTime receivedDate) { this.receivedDate = receivedDate; }
    public UUID getReceivedBy() { return receivedBy; }
    public void setReceivedBy(UUID receivedBy) { this.receivedBy = receivedBy; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
