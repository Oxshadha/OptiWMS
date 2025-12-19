package com.optiwms.domain.operations;

import com.optiwms.domain.common.BaseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class PackingRecord extends BaseEntity {
    private UUID orderId;
    private String orderNumber;
    private UUID packagingTypeId;
    private String boxType;
    private String boxDimensions; // JSON string
    private String dunnageMaterials; // JSON string
    private Boolean hasFragileItems;
    private BigDecimal actualWeightKg;
    private BigDecimal dimensionalWeightKg;
    private BigDecimal chargeableWeightKg;
    private String trackingNumber;
    private String shippingLabelUrl;
    private String packingSlipUrl;
    private String packingNotes;
    private String packingPhotos; // JSON string
    private UUID packerId;
    private String status;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    // Getters and Setters
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public UUID getPackagingTypeId() { return packagingTypeId; }
    public void setPackagingTypeId(UUID packagingTypeId) { this.packagingTypeId = packagingTypeId; }
    public String getBoxType() { return boxType; }
    public void setBoxType(String boxType) { this.boxType = boxType; }
    public String getBoxDimensions() { return boxDimensions; }
    public void setBoxDimensions(String boxDimensions) { this.boxDimensions = boxDimensions; }
    public String getDunnageMaterials() { return dunnageMaterials; }
    public void setDunnageMaterials(String dunnageMaterials) { this.dunnageMaterials = dunnageMaterials; }
    public Boolean getHasFragileItems() { return hasFragileItems; }
    public void setHasFragileItems(Boolean hasFragileItems) { this.hasFragileItems = hasFragileItems; }
    public BigDecimal getActualWeightKg() { return actualWeightKg; }
    public void setActualWeightKg(BigDecimal actualWeightKg) { this.actualWeightKg = actualWeightKg; }
    public BigDecimal getDimensionalWeightKg() { return dimensionalWeightKg; }
    public void setDimensionalWeightKg(BigDecimal dimensionalWeightKg) { this.dimensionalWeightKg = dimensionalWeightKg; }
    public BigDecimal getChargeableWeightKg() { return chargeableWeightKg; }
    public void setChargeableWeightKg(BigDecimal chargeableWeightKg) { this.chargeableWeightKg = chargeableWeightKg; }
    public String getTrackingNumber() { return trackingNumber; }
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }
    public String getShippingLabelUrl() { return shippingLabelUrl; }
    public void setShippingLabelUrl(String shippingLabelUrl) { this.shippingLabelUrl = shippingLabelUrl; }
    public String getPackingSlipUrl() { return packingSlipUrl; }
    public void setPackingSlipUrl(String packingSlipUrl) { this.packingSlipUrl = packingSlipUrl; }
    public String getPackingNotes() { return packingNotes; }
    public void setPackingNotes(String packingNotes) { this.packingNotes = packingNotes; }
    public String getPackingPhotos() { return packingPhotos; }
    public void setPackingPhotos(String packingPhotos) { this.packingPhotos = packingPhotos; }
    public UUID getPackerId() { return packerId; }
    public void setPackerId(UUID packerId) { this.packerId = packerId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}

