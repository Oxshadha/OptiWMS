package com.optiwms.domain.master;

import java.time.LocalDateTime;
import java.util.UUID;

public class SupplierConstraint {
    private UUID id;
    private UUID supplierId;
    private UUID materialId;
    private Double minOrderQty;
    private Double maxOrderQty;
    private Double bulkDiscountThreshold;
    private Double bulkDiscountPercent;
    private Double unitPrice;
    private String currency;
    private Integer avgShipmentDelayDays;
    private Integer leadTimeStdDevDays;
    private Double supplierOtifPercent;
    private Double orderingCostPerOrder;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public SupplierConstraint() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    
    public UUID getSupplierId() { return supplierId; }
    public void setSupplierId(UUID supplierId) { this.supplierId = supplierId; }
    
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    
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
