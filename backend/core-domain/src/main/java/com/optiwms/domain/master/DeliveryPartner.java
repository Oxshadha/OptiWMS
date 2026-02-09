package com.optiwms.domain.master;

import com.optiwms.domain.common.BaseEntity;

import java.math.BigDecimal;
import java.util.UUID;

public class DeliveryPartner extends BaseEntity {
    private String partnerCode;
    private String companyName;
    private String contactPerson;
    private String email;
    private String phone;
    private String address;
    private String city;
    private String country;
    private String currencyCode; // e.g., "USD", "LKR", "EUR"
    private String serviceAreas; // JSON string
    private BigDecimal rating;
    private BigDecimal costPerDelivery;
    private String status;
    private Integer totalShipments;
    private BigDecimal onTimeDeliveryRate;

    // Getters and Setters
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
    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }
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
}

