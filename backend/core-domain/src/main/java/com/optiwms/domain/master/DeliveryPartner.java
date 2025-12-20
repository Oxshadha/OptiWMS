package com.optiwms.domain.master;

import com.optiwms.domain.common.BaseEntity;

public class DeliveryPartner extends BaseEntity {
    private String code;
    private String name;
    private String contactPerson;
    private String email;
    private String phone;
    private String address;
    private String country;
    private String serviceType;
    private String status;

    // Getters and Setters
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getServiceType() { return serviceType; }
    public void setServiceType(String serviceType) { this.serviceType = serviceType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}

