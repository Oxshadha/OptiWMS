package com.optiwms.domain.master;

import java.math.BigDecimal;
import java.util.UUID;

public class Location {
    private UUID id;
    private UUID warehouseId;
    private String locationCode;
    private String area;
    private String rowNumber;
    private String bayNumber;
    private Integer levelNumber;
    private String binPosition;
    private String locationType;
    private String zoneType; // STORAGE, STAGING, RECEIVING, SHIPMENT, PACKING
    private BigDecimal capacity;
    private Boolean isActive;
    private String qrCode;
    
    // Rack system fields
    private String rackStatus;
    private String description;
    private String notes;
    private Integer accessibilityRating;
    private BigDecimal coordinateX;
    private BigDecimal coordinateY;
    private BigDecimal coordinateZ;
    private Integer maxPalletCapacity;
    private Integer currentPalletCount;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
    public String getArea() { return area; }
    public void setArea(String area) { this.area = area; }
    public String getRowNumber() { return rowNumber; }
    public void setRowNumber(String rowNumber) { this.rowNumber = rowNumber; }
    public String getBayNumber() { return bayNumber; }
    public void setBayNumber(String bayNumber) { this.bayNumber = bayNumber; }
    public Integer getLevelNumber() { return levelNumber; }
    public void setLevelNumber(Integer levelNumber) { this.levelNumber = levelNumber; }
    public String getBinPosition() { return binPosition; }
    public void setBinPosition(String binPosition) { this.binPosition = binPosition; }
    public String getLocationType() { return locationType; }
    public void setLocationType(String locationType) { this.locationType = locationType; }
    public String getZoneType() { return zoneType; }
    public void setZoneType(String zoneType) { this.zoneType = zoneType; }
    public BigDecimal getCapacity() { return capacity; }
    public void setCapacity(BigDecimal capacity) { this.capacity = capacity; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public String getQrCode() { return qrCode; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }
    
    // Rack system getters and setters
    public String getRackStatus() { return rackStatus; }
    public void setRackStatus(String rackStatus) { this.rackStatus = rackStatus; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Integer getAccessibilityRating() { return accessibilityRating; }
    public void setAccessibilityRating(Integer accessibilityRating) { this.accessibilityRating = accessibilityRating; }
    public BigDecimal getCoordinateX() { return coordinateX; }
    public void setCoordinateX(BigDecimal coordinateX) { this.coordinateX = coordinateX; }
    public BigDecimal getCoordinateY() { return coordinateY; }
    public void setCoordinateY(BigDecimal coordinateY) { this.coordinateY = coordinateY; }
    public BigDecimal getCoordinateZ() { return coordinateZ; }
    public void setCoordinateZ(BigDecimal coordinateZ) { this.coordinateZ = coordinateZ; }
    public Integer getMaxPalletCapacity() { return maxPalletCapacity; }
    public void setMaxPalletCapacity(Integer maxPalletCapacity) { this.maxPalletCapacity = maxPalletCapacity; }
    public Integer getCurrentPalletCount() { return currentPalletCount; }
    public void setCurrentPalletCount(Integer currentPalletCount) { this.currentPalletCount = currentPalletCount; }
}

