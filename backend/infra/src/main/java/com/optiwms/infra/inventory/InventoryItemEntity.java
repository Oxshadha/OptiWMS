package com.optiwms.infra.inventory;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "inventory")
public class InventoryItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "material_id", columnDefinition = "UUID")
    private UUID materialId;

    @Column(name = "warehouse_id", columnDefinition = "UUID")
    private UUID warehouseId;

    @Column(name = "location_code", length = 50)
    private String locationCode;

    @Column(name = "quantity", precision = 15, scale = 2, nullable = false)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(name = "available_quantity", precision = 15, scale = 2, nullable = false)
    private BigDecimal availableQuantity = BigDecimal.ZERO;

    @Column(name = "reserved_quantity", precision = 15, scale = 2, nullable = false)
    private BigDecimal reservedQuantity = BigDecimal.ZERO;

    @Column(name = "buffer_stock", precision = 15, scale = 2)
    private BigDecimal bufferStock;

    @Column(name = "max_stock", precision = 15, scale = 2)
    private BigDecimal maxStock;

    @Column(name = "min_stock", precision = 15, scale = 2)
    private BigDecimal minStock;

    @Column(name = "reorder_point", precision = 15, scale = 2)
    private BigDecimal reorderPoint;

    @Column(name = "stacking_quantity")
    private Integer stackingQuantity;

    @Column(name = "moq", precision = 15, scale = 2)
    private BigDecimal moq;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @Column(name = "last_counted_at")
    private LocalDateTime lastCountedAt;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "active";
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

    public UUID getMaterialId() {
        return materialId;
    }

    public void setMaterialId(UUID materialId) {
        this.materialId = materialId;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getLocationCode() {
        return locationCode;
    }

    public void setLocationCode(String locationCode) {
        this.locationCode = locationCode;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getAvailableQuantity() {
        return availableQuantity;
    }

    public void setAvailableQuantity(BigDecimal availableQuantity) {
        this.availableQuantity = availableQuantity;
    }

    public BigDecimal getReservedQuantity() {
        return reservedQuantity;
    }

    public void setReservedQuantity(BigDecimal reservedQuantity) {
        this.reservedQuantity = reservedQuantity;
    }

    public BigDecimal getBufferStock() {
        return bufferStock;
    }

    public void setBufferStock(BigDecimal bufferStock) {
        this.bufferStock = bufferStock;
    }

    public BigDecimal getMaxStock() {
        return maxStock;
    }

    public void setMaxStock(BigDecimal maxStock) {
        this.maxStock = maxStock;
    }

    public BigDecimal getMinStock() {
        return minStock;
    }

    public void setMinStock(BigDecimal minStock) {
        this.minStock = minStock;
    }

    public BigDecimal getReorderPoint() {
        return reorderPoint;
    }

    public void setReorderPoint(BigDecimal reorderPoint) {
        this.reorderPoint = reorderPoint;
    }

    public Integer getStackingQuantity() {
        return stackingQuantity;
    }

    public void setStackingQuantity(Integer stackingQuantity) {
        this.stackingQuantity = stackingQuantity;
    }

    public BigDecimal getMoq() {
        return moq;
    }

    public void setMoq(BigDecimal moq) {
        this.moq = moq;
    }

    public Integer getLeadTimeDays() {
        return leadTimeDays;
    }

    public void setLeadTimeDays(Integer leadTimeDays) {
        this.leadTimeDays = leadTimeDays;
    }

    public LocalDateTime getLastCountedAt() {
        return lastCountedAt;
    }

    public void setLastCountedAt(LocalDateTime lastCountedAt) {
        this.lastCountedAt = lastCountedAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

