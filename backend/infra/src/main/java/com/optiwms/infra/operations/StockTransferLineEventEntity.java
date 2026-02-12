package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_transfer_line_events")
public class StockTransferLineEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "transfer_line_id", columnDefinition = "UUID", nullable = false)
    private UUID transferLineId;

    @Column(name = "event_type", length = 40, nullable = false)
    private String eventType;

    @Column(name = "worker_id", columnDefinition = "UUID")
    private UUID workerId;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "source_scan_location", length = 50)
    private String sourceScanLocation;

    @Column(name = "dest_scan_location", length = 50)
    private String destScanLocation;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTransferLineId() { return transferLineId; }
    public void setTransferLineId(UUID transferLineId) { this.transferLineId = transferLineId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public UUID getWorkerId() { return workerId; }
    public void setWorkerId(UUID workerId) { this.workerId = workerId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getSourceScanLocation() { return sourceScanLocation; }
    public void setSourceScanLocation(String sourceScanLocation) { this.sourceScanLocation = sourceScanLocation; }
    public String getDestScanLocation() { return destScanLocation; }
    public void setDestScanLocation(String destScanLocation) { this.destScanLocation = destScanLocation; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
