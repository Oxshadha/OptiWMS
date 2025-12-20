package com.optiwms.infra.packing;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "packing_records")
public class PackingRecordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "order_id", columnDefinition = "UUID")
    private UUID orderId;

    @Column(name = "order_number", length = 50)
    private String orderNumber;

    @Column(name = "packaging_type_id", columnDefinition = "UUID")
    private UUID packagingTypeId;

    @Column(name = "box_type", length = 50)
    private String boxType;

    @Column(name = "box_dimensions", columnDefinition = "JSONB")
    private String boxDimensions;

    @Column(name = "dunnage_materials", columnDefinition = "JSONB")
    private String dunnageMaterials;

    @Column(name = "has_fragile_items")
    private Boolean hasFragileItems;

    @Column(name = "actual_weight_kg", precision = 10, scale = 3)
    private BigDecimal actualWeightKg;

    @Column(name = "dimensional_weight_kg", precision = 10, scale = 3)
    private BigDecimal dimensionalWeightKg;

    @Column(name = "chargeable_weight_kg", precision = 10, scale = 3)
    private BigDecimal chargeableWeightKg;

    @Column(name = "tracking_number", length = 100)
    private String trackingNumber;

    @Column(name = "shipping_label_url", columnDefinition = "TEXT")
    private String shippingLabelUrl;

    @Column(name = "packing_slip_url", columnDefinition = "TEXT")
    private String packingSlipUrl;

    @Column(name = "packing_notes", columnDefinition = "TEXT")
    private String packingNotes;

    @Column(name = "packing_photos", columnDefinition = "JSONB")
    private String packingPhotos;

    @Column(name = "packer_id", columnDefinition = "UUID")
    private UUID packerId;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "in_progress";
        }
        if (hasFragileItems == null) {
            hasFragileItems = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
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
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

