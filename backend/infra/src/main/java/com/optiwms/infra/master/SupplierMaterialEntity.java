package com.optiwms.infra.master;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;
import java.math.BigDecimal;

@Entity
@Table(
        name = "supplier_materials",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_supplier_material",
                columnNames = {"supplier_id", "material_id"}
        )
)
public class SupplierMaterialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "supplier_id", columnDefinition = "UUID", nullable = false)
    private UUID supplierId;

    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "material_id", columnDefinition = "UUID", nullable = false)
    private UUID materialId;

    @Column(name = "minimum_order_quantity", precision = 15, scale = 2)
    private BigDecimal minimumOrderQuantity;

    @Column(name = "order_multiple", precision = 15, scale = 2)
    private BigDecimal orderMultiple;

    @Column(name = "units_per_handling_unit", precision = 15, scale = 2)
    private BigDecimal unitsPerHandlingUnit;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @Column(name = "preferred")
    private Boolean preferred;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(UUID supplierId) {
        this.supplierId = supplierId;
    }

    public UUID getMaterialId() {
        return materialId;
    }

    public void setMaterialId(UUID materialId) {
        this.materialId = materialId;
    }

    public BigDecimal getMinimumOrderQuantity() {
        return minimumOrderQuantity;
    }

    public void setMinimumOrderQuantity(BigDecimal minimumOrderQuantity) {
        this.minimumOrderQuantity = minimumOrderQuantity;
    }

    public BigDecimal getOrderMultiple() {
        return orderMultiple;
    }

    public void setOrderMultiple(BigDecimal orderMultiple) {
        this.orderMultiple = orderMultiple;
    }

    public BigDecimal getUnitsPerHandlingUnit() {
        return unitsPerHandlingUnit;
    }

    public void setUnitsPerHandlingUnit(BigDecimal unitsPerHandlingUnit) {
        this.unitsPerHandlingUnit = unitsPerHandlingUnit;
    }

    public Integer getLeadTimeDays() {
        return leadTimeDays;
    }

    public void setLeadTimeDays(Integer leadTimeDays) {
        this.leadTimeDays = leadTimeDays;
    }

    public Boolean getPreferred() {
        return preferred;
    }

    public void setPreferred(Boolean preferred) {
        this.preferred = preferred;
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
