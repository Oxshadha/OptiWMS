package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A claim on pallet slots in one bin, held for one inbound order line.
 *
 * <p>This is what makes the capacity check at order creation binding. Without it every line was
 * planned against the same unchanged warehouse state and nothing recorded the answer, so the same
 * bin was promised to several lines at once.
 */
@Entity
@Table(name = "inbound_putaway_allocation")
public class InboundPutawayAllocationEntity {

    /** Claimed at order creation; no putaway task exists yet. Counts against bin capacity. */
    public static final String STATUS_PLANNED = "planned";
    /** Putaway tasks now carry the claim, so the task is the reservation and this no longer counts. */
    public static final String STATUS_TASKED = "tasked";
    /** Stock is physically in the bin and shows up as inventory instead. */
    public static final String STATUS_FULFILLED = "fulfilled";
    /** Order cancelled, line removed, or the plan was superseded. */
    public static final String STATUS_RELEASED = "released";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "order_id", columnDefinition = "UUID", nullable = false)
    private UUID orderId;

    @Column(name = "order_item_id", columnDefinition = "UUID", nullable = false)
    private UUID orderItemId;

    @Column(name = "warehouse_id", columnDefinition = "UUID", nullable = false)
    private UUID warehouseId;

    @Column(name = "material_id", columnDefinition = "UUID", nullable = false)
    private UUID materialId;

    @Column(name = "location_code", length = 50, nullable = false)
    private String locationCode;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "pallets", nullable = false)
    private Integer pallets;

    @Column(name = "status", length = 20, nullable = false)
    private String status = STATUS_PLANNED;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (status == null) status = STATUS_PLANNED;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public UUID getOrderItemId() { return orderItemId; }
    public void setOrderItemId(UUID orderItemId) { this.orderItemId = orderItemId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Integer getPallets() { return pallets; }
    public void setPallets(Integer pallets) { this.pallets = pallets; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
