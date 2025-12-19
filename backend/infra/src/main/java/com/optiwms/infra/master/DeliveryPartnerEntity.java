package com.optiwms.infra.master;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "delivery_partners")
public class DeliveryPartnerEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "partner_code", unique = true, nullable = false)
    private String partnerCode;

    @Column(name = "company_name", nullable = false)
    private String companyName;

    @Column(name = "contact_person")
    private String contactPerson;

    @Column(name = "email")
    private String email;

    @Column(name = "phone")
    private String phone;

    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    @Column(name = "city")
    private String city;

    @Column(name = "country")
    private String country;

    @Column(name = "service_areas", columnDefinition = "JSONB")
    private String serviceAreas; // JSON string

    @Column(name = "rating", precision = 3, scale = 2)
    private BigDecimal rating;

    @Column(name = "cost_per_delivery", precision = 10, scale = 2)
    private BigDecimal costPerDelivery;

    @Column(name = "status")
    private String status;

    @Column(name = "total_shipments")
    private Integer totalShipments;

    @Column(name = "on_time_delivery_rate", precision = 5, scale = 2)
    private BigDecimal onTimeDeliveryRate;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getPartnerCode() { return partnerCode; }
    public void setPartnerCode(String partnerCode) { this.partnerCode = partnerCode; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getServiceAreas() { return serviceAreas; }
    public void setServiceAreas(String serviceAreas) { this.serviceAreas = serviceAreas; }
    public BigDecimal getRating() { return rating; }
    public void setRating(BigDecimal rating) { this.rating = rating; }
    public BigDecimal getCostPerDelivery() { return costPerDelivery; }
    public void setCostPerDelivery(BigDecimal costPerDelivery) { this.costPerDelivery = costPerDelivery; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getTotalShipments() { return totalShipments; }
    public void setTotalShipments(Integer totalShipments) { this.totalShipments = totalShipments; }
    public BigDecimal getOnTimeDeliveryRate() { return onTimeDeliveryRate; }
    public void setOnTimeDeliveryRate(BigDecimal onTimeDeliveryRate) { this.onTimeDeliveryRate = onTimeDeliveryRate; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = OffsetDateTime.now();
        if (this.status == null) {
            this.status = "active";
        }
        if (this.totalShipments == null) {
            this.totalShipments = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}

