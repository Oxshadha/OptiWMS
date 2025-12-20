package com.optiwms.domain.anomalies;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public class Anomaly extends BaseEntity {
    private String anomalyNumber;
    private String anomalyType;
    private UUID warehouseId;
    private UUID materialId;
    private String locationCode;
    private String severity;
    private String status;
    private String description;
    private String resolution;
    private UUID detectedBy;
    private UUID resolvedBy;
    private LocalDateTime detectedAt;
    private LocalDateTime resolvedAt;

    // Getters and Setters
    public String getAnomalyNumber() { return anomalyNumber; }
    public void setAnomalyNumber(String anomalyNumber) { this.anomalyNumber = anomalyNumber; }
    public String getAnomalyType() { return anomalyType; }
    public void setAnomalyType(String anomalyType) { this.anomalyType = anomalyType; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }
    public UUID getDetectedBy() { return detectedBy; }
    public void setDetectedBy(UUID detectedBy) { this.detectedBy = detectedBy; }
    public UUID getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(UUID resolvedBy) { this.resolvedBy = resolvedBy; }
    public LocalDateTime getDetectedAt() { return detectedAt; }
    public void setDetectedAt(LocalDateTime detectedAt) { this.detectedAt = detectedAt; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}

