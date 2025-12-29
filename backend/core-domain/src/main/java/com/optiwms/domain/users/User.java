package com.optiwms.domain.users;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public class User extends BaseEntity {
    private String username;
    private String email;
    private String passwordHash;
    private String employeeId;
    private String firstName;
    private String lastName;
    private String role; // admin, supervisor, worker
    private UUID warehouseId;
    private String phone;
    private String avatarUrl;
    private String status;
    private String deviceId;
    private LocalDateTime lastLoginAt;

    // Getters and Setters
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
}

