package com.optiwms.infra.planning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "bom_components")
public class BomComponentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "bom_header_id", columnDefinition = "UUID", nullable = false)
    private UUID bomHeaderId;

    @Column(name = "component_material_id", columnDefinition = "UUID", nullable = false)
    private UUID componentMaterialId;

    @Column(name = "component_type", nullable = false, length = 32)
    private String componentType;

    @Column(name = "qty_per_parent", precision = 18, scale = 6, nullable = false)
    private BigDecimal qtyPerParent;

    @Column(name = "scrap_rate", precision = 8, scale = 4, nullable = false)
    private BigDecimal scrapRate = BigDecimal.ZERO;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @Column(name = "uom", length = 32)
    private String uom;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getBomHeaderId() {
        return bomHeaderId;
    }

    public void setBomHeaderId(UUID bomHeaderId) {
        this.bomHeaderId = bomHeaderId;
    }

    public UUID getComponentMaterialId() {
        return componentMaterialId;
    }

    public void setComponentMaterialId(UUID componentMaterialId) {
        this.componentMaterialId = componentMaterialId;
    }

    public String getComponentType() {
        return componentType;
    }

    public void setComponentType(String componentType) {
        this.componentType = componentType;
    }

    public BigDecimal getQtyPerParent() {
        return qtyPerParent;
    }

    public void setQtyPerParent(BigDecimal qtyPerParent) {
        this.qtyPerParent = qtyPerParent;
    }

    public BigDecimal getScrapRate() {
        return scrapRate;
    }

    public void setScrapRate(BigDecimal scrapRate) {
        this.scrapRate = scrapRate;
    }

    public Integer getLeadTimeDays() {
        return leadTimeDays;
    }

    public void setLeadTimeDays(Integer leadTimeDays) {
        this.leadTimeDays = leadTimeDays;
    }

    public String getUom() {
        return uom;
    }

    public void setUom(String uom) {
        this.uom = uom;
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
