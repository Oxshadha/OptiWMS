package com.optiwms.infra.master;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "locations")
public class LocationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "warehouse_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;

    @Column(name = "location_code", unique = true, nullable = false)
    private String locationCode;

    @Column(name = "area", nullable = false)
    private String area;

    @Column(name = "row_number", nullable = false)
    private String rowNumber;

    @Column(name = "bay_number", nullable = false)
    private String bayNumber;

    @Column(name = "level_number", nullable = false)
    private Integer levelNumber;

    @Column(name = "bin_position", nullable = false)
    private String binPosition;

    @Column(name = "location_type")
    private String locationType;

    @Column(name = "zone_type", length = 20)
    private String zoneType;

    @Column(name = "capacity", precision = 15, scale = 2)
    private java.math.BigDecimal capacity;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "qr_code", columnDefinition = "TEXT")
    private String qrCode;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    // Rack system fields (added in V11)
    @Column(name = "rack_status", length = 20)
    private String rackStatus;

    @Column(name = "amalgamated_class", length = 2)
    private String amalgamatedClass;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "accessibility_rating")
    private Integer accessibilityRating;

    @Column(name = "coordinate_x", precision = 10, scale = 2)
    private java.math.BigDecimal coordinateX;

    @Column(name = "coordinate_y", precision = 10, scale = 2)
    private java.math.BigDecimal coordinateY;

    @Column(name = "coordinate_z", precision = 10, scale = 2)
    private java.math.BigDecimal coordinateZ;

    @Column(name = "max_pallet_capacity")
    private Integer maxPalletCapacity;

    @Column(name = "current_pallet_count")
    private Integer currentPalletCount;

    @Column(name = "max_weight_kg", precision = 15, scale = 2)
    private java.math.BigDecimal maxWeightKg;

    @Column(name = "max_volume_cm3", precision = 18, scale = 2)
    private java.math.BigDecimal maxVolumeCm3;

    @Column(name = "max_lpn_count")
    private Integer maxLpnCount;

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
    public java.math.BigDecimal getCapacity() { return capacity; }
    public void setCapacity(java.math.BigDecimal capacity) { this.capacity = capacity; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public String getQrCode() { return qrCode; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    // Rack system getters and setters
    public String getRackStatus() { return rackStatus; }
    public void setRackStatus(String rackStatus) { this.rackStatus = rackStatus; }
    public String getAmalgamatedClass() { return amalgamatedClass; }
    public void setAmalgamatedClass(String amalgamatedClass) { this.amalgamatedClass = amalgamatedClass; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Integer getAccessibilityRating() { return accessibilityRating; }
    public void setAccessibilityRating(Integer accessibilityRating) { this.accessibilityRating = accessibilityRating; }
    public java.math.BigDecimal getCoordinateX() { return coordinateX; }
    public void setCoordinateX(java.math.BigDecimal coordinateX) { this.coordinateX = coordinateX; }
    public java.math.BigDecimal getCoordinateY() { return coordinateY; }
    public void setCoordinateY(java.math.BigDecimal coordinateY) { this.coordinateY = coordinateY; }
    public java.math.BigDecimal getCoordinateZ() { return coordinateZ; }
    public void setCoordinateZ(java.math.BigDecimal coordinateZ) { this.coordinateZ = coordinateZ; }
    public Integer getMaxPalletCapacity() { return maxPalletCapacity; }
    public void setMaxPalletCapacity(Integer maxPalletCapacity) { this.maxPalletCapacity = maxPalletCapacity; }
    public Integer getCurrentPalletCount() { return currentPalletCount; }
    public void setCurrentPalletCount(Integer currentPalletCount) { this.currentPalletCount = currentPalletCount; }
    public java.math.BigDecimal getMaxWeightKg() { return maxWeightKg; }
    public void setMaxWeightKg(java.math.BigDecimal maxWeightKg) { this.maxWeightKg = maxWeightKg; }
    public java.math.BigDecimal getMaxVolumeCm3() { return maxVolumeCm3; }
    public void setMaxVolumeCm3(java.math.BigDecimal maxVolumeCm3) { this.maxVolumeCm3 = maxVolumeCm3; }
    public Integer getMaxLpnCount() { return maxLpnCount; }
    public void setMaxLpnCount(Integer maxLpnCount) { this.maxLpnCount = maxLpnCount; }

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
        if (this.isActive == null) {
            this.isActive = true;
        }
        if (this.locationType == null) {
            this.locationType = "storage";
        }
        if (this.rackStatus == null) {
            this.rackStatus = "active";
        }
        if (this.currentPalletCount == null) {
            this.currentPalletCount = 0;
        }
    }
}
