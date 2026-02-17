package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Location;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LocationService {

    private final LocationRepository repository;
    private final InventoryItemRepository inventoryItemRepository;

    public LocationService(LocationRepository repository, InventoryItemRepository inventoryItemRepository) {
        this.repository = repository;
        this.inventoryItemRepository = inventoryItemRepository;
    }

    public List<Location> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Location findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Location not found: " + id));
    }

    public List<Location> findByWarehouse(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    /**
     * Get only storage locations (exclude staging, receiving, shipment, packing areas)
     * For warehouse map visualization - only show racks, not staging areas
     *
     * Include inactive storage locations as well so non-active racks remain visible
     * and can be re-activated from the UI.
     * Material type categorization (raw materials, finished goods) is handled by inventory,
     * not by location type.
     */
    public List<Location> findStorageLocationsByWarehouse(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId).stream()
                .filter(entity -> {
                    // Only STORAGE zone type - exclude RECEIVING, SHIPMENT, PACKING, STAGING
                    String zoneType = entity.getZoneType();
                    return "STORAGE".equals(zoneType);
                })
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Location> findAvailableByWarehouse(UUID warehouseId) {
        return repository.findByWarehouseIdAndIsActive(warehouseId, true).stream()
                .filter(entity -> {
                    String zoneType = entity.getZoneType();
                    return "STORAGE".equals(zoneType) || "storage".equals(entity.getLocationType());
                })
                .filter(entity -> "active".equals(normalizeRackStatus(entity.getRackStatus())))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Location findByLocationCode(String locationCode) {
        return repository.findByLocationCode(locationCode)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationCode));
    }

    public java.util.Optional<Location> findByLocationCodeOptional(String locationCode) {
        return repository.findByLocationCode(locationCode)
                .map(this::toDomain);
    }

    @Transactional
    public Location create(Location location) {
        LocationEntity entity = new LocationEntity();
        entity.setWarehouseId(location.getWarehouseId());
        entity.setLocationCode(location.getLocationCode());
        entity.setArea(location.getArea());
        entity.setRowNumber(location.getRowNumber());
        entity.setBayNumber(location.getBayNumber());
        entity.setLevelNumber(location.getLevelNumber());
        entity.setBinPosition(location.getBinPosition());
        entity.setLocationType(location.getLocationType() != null ? location.getLocationType() : "storage");
        entity.setZoneType(location.getZoneType() != null ? location.getZoneType() : "STORAGE");
        entity.setCapacity(location.getCapacity());
        entity.setIsActive(location.getIsActive() != null ? location.getIsActive() : true);
        entity.setQrCode(location.getQrCode());
        entity.setRackStatus(location.getRackStatus() != null ? location.getRackStatus() : "active");
        entity.setDescription(location.getDescription());
        entity.setNotes(location.getNotes());
        entity.setAccessibilityRating(location.getAccessibilityRating());
        entity.setCoordinateX(location.getCoordinateX());
        entity.setCoordinateY(location.getCoordinateY());
        entity.setMaxPalletCapacity(location.getMaxPalletCapacity());
        entity.setCurrentPalletCount(location.getCurrentPalletCount() != null ? location.getCurrentPalletCount() : 0);

        LocationEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Location update(UUID id, Location location) {
        LocationEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Location not found: " + id));

        String currentStatus = normalizeRackStatus(entity.getRackStatus());
        String requestedStatus = normalizeRackStatus(location.getRackStatus() != null ? location.getRackStatus() : entity.getRackStatus());
        if (!currentStatus.equals(requestedStatus)
                && isBlockedRackStatus(requestedStatus)
                && hasInventoryInRack(entity)) {
            throw new RuntimeException("Cannot set rack to '" + requestedStatus
                    + "' because this rack currently has stock. Move stock out first.");
        }

        entity.setLocationCode(location.getLocationCode());
        entity.setArea(location.getArea());
        entity.setRowNumber(location.getRowNumber());
        entity.setBayNumber(location.getBayNumber());
        entity.setLevelNumber(location.getLevelNumber());
        entity.setBinPosition(location.getBinPosition());
        entity.setLocationType(location.getLocationType());
        if (location.getZoneType() != null) entity.setZoneType(location.getZoneType());
        entity.setCapacity(location.getCapacity());
        entity.setIsActive(location.getIsActive());
        entity.setQrCode(location.getQrCode());
        if (location.getRackStatus() != null) entity.setRackStatus(location.getRackStatus());
        if (location.getDescription() != null) entity.setDescription(location.getDescription());
        if (location.getNotes() != null) entity.setNotes(location.getNotes());
        if (location.getAccessibilityRating() != null) entity.setAccessibilityRating(location.getAccessibilityRating());
        if (location.getCoordinateX() != null) entity.setCoordinateX(location.getCoordinateX());
        if (location.getCoordinateY() != null) entity.setCoordinateY(location.getCoordinateY());
        if (location.getMaxPalletCapacity() != null) entity.setMaxPalletCapacity(location.getMaxPalletCapacity());
        if (location.getCurrentPalletCount() != null) entity.setCurrentPalletCount(location.getCurrentPalletCount());

        LocationEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Location not found: " + id);
        }
        repository.deleteById(id);
    }

    private Location toDomain(LocationEntity entity) {
        Location location = new Location();
        location.setId(entity.getId());
        location.setWarehouseId(entity.getWarehouseId());
        location.setLocationCode(entity.getLocationCode());
        location.setArea(entity.getArea());
        location.setRowNumber(entity.getRowNumber());
        location.setBayNumber(entity.getBayNumber());
        location.setLevelNumber(entity.getLevelNumber());
        location.setBinPosition(entity.getBinPosition());
        location.setLocationType(entity.getLocationType());
        location.setZoneType(entity.getZoneType()); // Add zoneType to domain object
        location.setCapacity(entity.getCapacity());
        location.setIsActive(entity.getIsActive());
        location.setQrCode(entity.getQrCode());
        location.setRackStatus(entity.getRackStatus());
        location.setDescription(entity.getDescription());
        location.setNotes(entity.getNotes());
        location.setAccessibilityRating(entity.getAccessibilityRating());
        location.setCoordinateX(entity.getCoordinateX());
        location.setCoordinateY(entity.getCoordinateY());
        location.setMaxPalletCapacity(entity.getMaxPalletCapacity());
        location.setCurrentPalletCount(entity.getCurrentPalletCount());
        return location;
    }

    private String normalizeRackStatus(String rackStatus) {
        if (rackStatus == null || rackStatus.isBlank()) {
            return "active";
        }
        String normalized = rackStatus.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        if ("outofservice".equals(normalized)) {
            return "out_of_service";
        }
        return normalized;
    }

    private boolean isBlockedRackStatus(String rackStatus) {
        return "reserved".equals(rackStatus)
                || "maintenance".equals(rackStatus)
                || "out_of_service".equals(rackStatus);
    }

    private boolean hasInventoryInRack(LocationEntity location) {
        List<String> rackLocationCodes = repository.findByWarehouseId(location.getWarehouseId()).stream()
                .filter(loc -> loc.getArea().equals(location.getArea())
                        && loc.getRowNumber().equals(location.getRowNumber())
                        && loc.getBayNumber().equals(location.getBayNumber()))
                .map(LocationEntity::getLocationCode)
                .collect(Collectors.toList());

        if (rackLocationCodes.isEmpty()) {
            return false;
        }

        return inventoryItemRepository.existsByLocationCodeInAndQuantityGreaterThan(rackLocationCodes, 0);
    }
}
