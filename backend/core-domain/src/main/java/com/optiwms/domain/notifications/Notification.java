package com.optiwms.domain.notifications;

import com.optiwms.domain.common.BaseEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public class Notification extends BaseEntity {
    private UUID userId; // NULL means broadcast to all users
    private String audienceRoles; // Comma-separated role names for broadcast targeting
    private UUID warehouseId; // Optional warehouse scope for targeted broadcasts
    private String title;
    private String message;
    private String notificationType; // order, inventory, cycle_count, task, anomaly, shipment, return, system
    private Boolean read = false;
    private String actionUrl;
    private String metadata; // JSON string
    private OffsetDateTime createdAt;

    // Getters and Setters
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getAudienceRoles() { return audienceRoles; }
    public void setAudienceRoles(String audienceRoles) { this.audienceRoles = audienceRoles; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getNotificationType() { return notificationType; }
    public void setNotificationType(String notificationType) { this.notificationType = notificationType; }
    public Boolean getRead() { return read; }
    public void setRead(Boolean read) { this.read = read; }
    public String getActionUrl() { return actionUrl; }
    public void setActionUrl(String actionUrl) { this.actionUrl = actionUrl; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
