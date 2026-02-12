package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "shipments")
public class ShipmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "shipment_number", unique = true, nullable = false)
    private String shipmentNumber;

    @Column(name = "order_id", columnDefinition = "UUID")
    private UUID orderId;

    @Column(name = "carrier")
    private String carrier;

    @Column(name = "tracking_number")
    private String trackingNumber;

    @Column(name = "destination", columnDefinition = "TEXT")
    private String destination;

    @Column(name = "weight_kg", precision = 10, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "driver_name")
    private String driverName;

    @Column(name = "driver_phone")
    private String driverPhone;

    @Column(name = "vehicle_number")
    private String vehicleNumber;

    @Column(name = "status")
    private String status;

    @Column(name = "eta")
    private LocalDate eta;

    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "delivery_confirmed_by", columnDefinition = "UUID")
    private UUID deliveryConfirmedBy;

    @Column(name = "delivery_confirmed_at")
    private LocalDateTime deliveryConfirmedAt;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getShipmentNumber() { return shipmentNumber; }
    public void setShipmentNumber(String shipmentNumber) { this.shipmentNumber = shipmentNumber; }
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public String getCarrier() { return carrier; }
    public void setCarrier(String carrier) { this.carrier = carrier; }
    public String getTrackingNumber() { return trackingNumber; }
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }
    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }
    public String getDriverPhone() { return driverPhone; }
    public void setDriverPhone(String driverPhone) { this.driverPhone = driverPhone; }
    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDate getEta() { return eta; }
    public void setEta(LocalDate eta) { this.eta = eta; }
    public LocalDateTime getShippedAt() { return shippedAt; }
    public void setShippedAt(LocalDateTime shippedAt) { this.shippedAt = shippedAt; }
    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }
    public UUID getDeliveryConfirmedBy() { return deliveryConfirmedBy; }
    public void setDeliveryConfirmedBy(UUID deliveryConfirmedBy) { this.deliveryConfirmedBy = deliveryConfirmedBy; }
    public LocalDateTime getDeliveryConfirmedAt() { return deliveryConfirmedAt; }
    public void setDeliveryConfirmedAt(LocalDateTime deliveryConfirmedAt) { this.deliveryConfirmedAt = deliveryConfirmedAt; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
        if (this.status == null) {
            this.status = "label_created";
        }
    }
}
