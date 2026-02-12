package com.optiwms.domain.quality;

import com.optiwms.domain.common.BaseEntity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class QualityCheck extends BaseEntity {
    private UUID grnId;
    private UUID materialId;
    private BigDecimal qtyReceived;
    private BigDecimal qtyPassed;
    private BigDecimal qtyRejected;
    private String rejectionReason;
    private UUID checkedBy;
    private OffsetDateTime checkDate;

    // Getters and Setters
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
}

