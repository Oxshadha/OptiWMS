package com.optiwms.infra.quality;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "quality_check_logs")
public class QualityCheckEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "grn_id", columnDefinition = "UUID")
    private UUID grnId;

    @Column(name = "material_id", columnDefinition = "UUID")
    private UUID materialId;

    @Column(name = "qty_received", precision = 15, scale = 2, nullable = false)
    private BigDecimal qtyReceived;

    @Column(name = "qty_passed", precision = 15, scale = 2, nullable = false)
    private BigDecimal qtyPassed;

    @Column(name = "qty_rejected", precision = 15, scale = 2, nullable = false)
    private BigDecimal qtyRejected;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "checked_by", columnDefinition = "UUID")
    private UUID checkedBy;

    @Column(name = "check_date")
    private OffsetDateTime checkDate;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getGrnId() { return grnId; }
    public void setGrnId(UUID grnId) { this.grnId = grnId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public BigDecimal getQtyReceived() { return qtyReceived; }
    public void setQtyReceived(BigDecimal qtyReceived) { this.qtyReceived = qtyReceived; }
    public BigDecimal getQtyPassed() { return qtyPassed; }
    public void setQtyPassed(BigDecimal qtyPassed) { this.qtyPassed = qtyPassed; }
    public BigDecimal getQtyRejected() { return qtyRejected; }
    public void setQtyRejected(BigDecimal qtyRejected) { this.qtyRejected = qtyRejected; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public UUID getCheckedBy() { return checkedBy; }
    public void setCheckedBy(UUID checkedBy) { this.checkedBy = checkedBy; }
    public OffsetDateTime getCheckDate() { return checkDate; }
    public void setCheckDate(OffsetDateTime checkDate) { this.checkDate = checkDate; }

    @PrePersist
    protected void onCreate() {
        if (this.checkDate == null) {
            this.checkDate = OffsetDateTime.now();
        }
    }
}

