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

    @Column(name = "quantity", nullable = false)
    private Integer quantity = 0;

    @Column(name = "available_quantity", nullable = false)
    private Integer availableQuantity = 0;

    @Column(name = "reserved_quantity", nullable = false)
    private Integer reservedQuantity = 0;

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

    // New fields from V4 migration
    @Column(name = "batch_number", length = 100)
    private String batchNumber;

    @Column(name = "expiry_date")
    private java.time.LocalDate expiryDate;

    @Column(name = "last_movement_date")
    private java.time.LocalDate lastMovementDate;

    @Column(name = "days_since_last_movement")
    private Integer daysSinceLastMovement;

    @Column(name = "material_type", length = 20)
    private String materialType;

    // Additional planning fields from CSV (V20 migration)
    @Column(name = "buffer_days")
    private Integer bufferDays;

    @Column(name = "lead_time_months", precision = 5, scale = 2)
    private BigDecimal leadTimeMonths;

    @Column(name = "rop_in_days", precision = 10, scale = 2)
    private BigDecimal ropInDays;

    @Column(name = "variance_demand", precision = 15, scale = 2)
    private BigDecimal varianceDemand;

    @Column(name = "variance_lead_time_demand", precision = 15, scale = 2)
    private BigDecimal varianceLeadTimeDemand;

    @Column(name = "difference", precision = 15, scale = 2)
    private BigDecimal difference;

    @Column(name = "order_delivery_days")
    private Integer orderDeliveryDays;

    @Column(name = "order_quantity", precision = 15, scale = 2)
    private BigDecimal orderQuantity;

    @Column(name = "pallet_requirement", precision = 10, scale = 2)
    private BigDecimal palletRequirement;

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

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Integer getAvailableQuantity() {
        return availableQuantity;
    }

    public void setAvailableQuantity(Integer availableQuantity) {
        this.availableQuantity = availableQuantity;
    }

    public Integer getReservedQuantity() {
        return reservedQuantity;
    }

    public void setReservedQuantity(Integer reservedQuantity) {
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

    public String getBatchNumber() {
        return batchNumber;
    }

    public void setBatchNumber(String batchNumber) {
        this.batchNumber = batchNumber;
    }

    public java.time.LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(java.time.LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }

    public java.time.LocalDate getLastMovementDate() {
        return lastMovementDate;
    }

    public void setLastMovementDate(java.time.LocalDate lastMovementDate) {
        this.lastMovementDate = lastMovementDate;
    }

    public Integer getDaysSinceLastMovement() {
        return daysSinceLastMovement;
    }

    public void setDaysSinceLastMovement(Integer daysSinceLastMovement) {
        this.daysSinceLastMovement = daysSinceLastMovement;
    }

    public String getMaterialType() {
        return materialType;
    }

    public void setMaterialType(String materialType) {
        this.materialType = materialType;
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

    // Getters and Setters for new planning fields (V20 migration)
    public Integer getBufferDays() {
        return bufferDays;
    }

    public void setBufferDays(Integer bufferDays) {
        this.bufferDays = bufferDays;
    }

    public BigDecimal getLeadTimeMonths() {
        return leadTimeMonths;
    }

    public void setLeadTimeMonths(BigDecimal leadTimeMonths) {
        this.leadTimeMonths = leadTimeMonths;
    }

    public BigDecimal getRopInDays() {
        return ropInDays;
    }

    public void setRopInDays(BigDecimal ropInDays) {
        this.ropInDays = ropInDays;
    }

    public BigDecimal getVarianceDemand() {
        return varianceDemand;
    }

    public void setVarianceDemand(BigDecimal varianceDemand) {
        this.varianceDemand = varianceDemand;
    }

    public BigDecimal getVarianceLeadTimeDemand() {
        return varianceLeadTimeDemand;
    }

    public void setVarianceLeadTimeDemand(BigDecimal varianceLeadTimeDemand) {
        this.varianceLeadTimeDemand = varianceLeadTimeDemand;
    }

    public BigDecimal getDifference() {
        return difference;
    }

    public void setDifference(BigDecimal difference) {
        this.difference = difference;
    }

    public Integer getOrderDeliveryDays() {
        return orderDeliveryDays;
    }

    public void setOrderDeliveryDays(Integer orderDeliveryDays) {
        this.orderDeliveryDays = orderDeliveryDays;
    }

    public BigDecimal getOrderQuantity() {
        return orderQuantity;
    }

    public void setOrderQuantity(BigDecimal orderQuantity) {
        this.orderQuantity = orderQuantity;
    }

    public BigDecimal getPalletRequirement() {
        return palletRequirement;
    }

    public void setPalletRequirement(BigDecimal palletRequirement) {
        this.palletRequirement = palletRequirement;
    }
}

