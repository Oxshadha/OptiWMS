package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Location;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LocationService {

    private final LocationRepository repository;

    public LocationService(LocationRepository repository) {
        this.repository = repository;
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

    public List<Location> findAvailableByWarehouse(UUID warehouseId) {
        return repository.findByWarehouseIdAndIsActive(warehouseId, true).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Location findByLocationCode(String locationCode) {
        return repository.findByLocationCode(locationCode)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationCode));
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

        entity.setLocationCode(location.getLocationCode());
        entity.setArea(location.getArea());
        entity.setRowNumber(location.getRowNumber());
        entity.setBayNumber(location.getBayNumber());
        entity.setLevelNumber(location.getLevelNumber());
        entity.setBinPosition(location.getBinPosition());
        entity.setLocationType(location.getLocationType());
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
}

