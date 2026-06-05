package com.optiwms.infra.master;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "supplier_constraints")
public class SupplierConstraintEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private SupplierEntity supplier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id")
    private MaterialEntity material;

    @Column(name = "min_order_qty")
    private Double minOrderQty;

    @Column(name = "max_order_qty")
    private Double maxOrderQty;

    @Column(name = "bulk_discount_threshold")
    private Double bulkDiscountThreshold;

    @Column(name = "bulk_discount_percent")
    private Double bulkDiscountPercent;

    @Column(name = "unit_price")
    private Double unitPrice;

    private String currency;

    @Column(name = "avg_shipment_delay_days")
    private Integer avgShipmentDelayDays;

    @Column(name = "lead_time_std_dev_days")
    private Integer leadTimeStdDevDays;

    @Column(name = "supplier_otif_percent")
    private Double supplierOtifPercent;

    @Column(name = "ordering_cost_per_order")
    private Double orderingCostPerOrder;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public SupplierConstraintEntity() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public SupplierEntity getSupplier() { return supplier; }
    public void setSupplier(SupplierEntity supplier) { this.supplier = supplier; }

    public MaterialEntity getMaterial() { return material; }
    public void setMaterial(MaterialEntity material) { this.material = material; }

    public Double getMinOrderQty() { return minOrderQty; }
    public void setMinOrderQty(Double minOrderQty) { this.minOrderQty = minOrderQty; }

    public Double getMaxOrderQty() { return maxOrderQty; }
    public void setMaxOrderQty(Double maxOrderQty) { this.maxOrderQty = maxOrderQty; }

    public Double getBulkDiscountThreshold() { return bulkDiscountThreshold; }
    public void setBulkDiscountThreshold(Double bulkDiscountThreshold) { this.bulkDiscountThreshold = bulkDiscountThreshold; }

    public Double getBulkDiscountPercent() { return bulkDiscountPercent; }
    public void setBulkDiscountPercent(Double bulkDiscountPercent) { this.bulkDiscountPercent = bulkDiscountPercent; }

    public Double getUnitPrice() { return unitPrice; }
    public void setUnitPrice(Double unitPrice) { this.unitPrice = unitPrice; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public Integer getAvgShipmentDelayDays() { return avgShipmentDelayDays; }
    public void setAvgShipmentDelayDays(Integer avgShipmentDelayDays) { this.avgShipmentDelayDays = avgShipmentDelayDays; }

    public Integer getLeadTimeStdDevDays() { return leadTimeStdDevDays; }
    public void setLeadTimeStdDevDays(Integer leadTimeStdDevDays) { this.leadTimeStdDevDays = leadTimeStdDevDays; }

    public Double getSupplierOtifPercent() { return supplierOtifPercent; }
    public void setSupplierOtifPercent(Double supplierOtifPercent) { this.supplierOtifPercent = supplierOtifPercent; }

    public Double getOrderingCostPerOrder() { return orderingCostPerOrder; }
    public void setOrderingCostPerOrder(Double orderingCostPerOrder) { this.orderingCostPerOrder = orderingCostPerOrder; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
