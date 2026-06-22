package com.optiwms.infra.slotting;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "material_issue_stats")
public class MaterialIssueStatsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "material_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID materialId;

    @Column(name = "warehouse_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;

    @Column(name = "period_month", nullable = false)
    private java.time.LocalDate periodMonth;

    @Column(name = "issue_volume", nullable = false)
    private Long issueVolume;

    @Column(name = "issue_count", nullable = false)
    private Integer issueCount;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (issueVolume == null) {
            issueVolume = 0L;
        }
        if (issueCount == null) {
            issueCount = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public java.time.LocalDate getPeriodMonth() { return periodMonth; }
    public void setPeriodMonth(java.time.LocalDate periodMonth) { this.periodMonth = periodMonth; }
    public Long getIssueVolume() { return issueVolume; }
    public void setIssueVolume(Long issueVolume) { this.issueVolume = issueVolume; }
    public Integer getIssueCount() { return issueCount; }
    public void setIssueCount(Integer issueCount) { this.issueCount = issueCount; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
