package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Location;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
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
        String area = normalizeArea(location.getArea());
        String rowNumber = normalizeRowNumber(location.getRowNumber());
        String bayNumber = normalizeBayNumber(location.getBayNumber());
        Integer levelNumber = normalizeLevelNumber(location.getLevelNumber());
        String binPosition = normalizeBinPosition(location.getBinPosition());

        LocationEntity entity = new LocationEntity();
        entity.setWarehouseId(location.getWarehouseId());
        entity.setArea(area);
        entity.setRowNumber(rowNumber);
        entity.setBayNumber(bayNumber);
        entity.setLevelNumber(levelNumber);
        entity.setBinPosition(binPosition);
        entity.setLocationCode(buildCanonicalLocationCode(area, rowNumber, bayNumber, levelNumber, binPosition));
        entity.setLocationType(location.getLocationType() != null ? location.getLocationType() : "storage");
        entity.setZoneType(location.getZoneType() != null ? location.getZoneType() : "STORAGE");
        entity.setCapacity(location.getCapacity());
        entity.setIsActive(location.getIsActive() != null ? location.getIsActive() : true);
        entity.setQrCode(location.getQrCode());
        entity.setRackStatus(location.getRackStatus() != null ? location.getRackStatus() : "active");
        entity.setAmalgamatedClass(normalizeAmalgamatedClass(location.getAmalgamatedClass()));
        entity.setDescription(location.getDescription());
        entity.setNotes(location.getNotes());
        entity.setAccessibilityRating(location.getAccessibilityRating());
        entity.setCoordinateX(location.getCoordinateX());
        entity.setCoordinateY(location.getCoordinateY());
        entity.setMaxPalletCapacity(location.getMaxPalletCapacity());
        entity.setCurrentPalletCount(location.getCurrentPalletCount() != null ? location.getCurrentPalletCount() : 0);
        entity.setMaxWeightKg(location.getMaxWeightKg());
        entity.setMaxVolumeCm3(location.getMaxVolumeCm3());
        entity.setMaxLpnCount(location.getMaxLpnCount());

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

        String area = normalizeArea(location.getArea() != null ? location.getArea() : entity.getArea());
        String rowNumber = normalizeRowNumber(location.getRowNumber() != null ? location.getRowNumber() : entity.getRowNumber());
        String bayNumber = normalizeBayNumber(location.getBayNumber() != null ? location.getBayNumber() : entity.getBayNumber());
        Integer levelNumber = normalizeLevelNumber(location.getLevelNumber() != null ? location.getLevelNumber() : entity.getLevelNumber());
        String binPosition = normalizeBinPosition(location.getBinPosition() != null ? location.getBinPosition() : entity.getBinPosition());

        entity.setArea(area);
        entity.setRowNumber(rowNumber);
        entity.setBayNumber(bayNumber);
        entity.setLevelNumber(levelNumber);
        entity.setBinPosition(binPosition);
        entity.setLocationCode(buildCanonicalLocationCode(area, rowNumber, bayNumber, levelNumber, binPosition));
        entity.setLocationType(location.getLocationType());
        if (location.getZoneType() != null) entity.setZoneType(location.getZoneType());
        entity.setCapacity(location.getCapacity());
        entity.setIsActive(location.getIsActive());
        entity.setQrCode(location.getQrCode());
        if (location.getRackStatus() != null) entity.setRackStatus(location.getRackStatus());
        if (location.getAmalgamatedClass() != null) {
            entity.setAmalgamatedClass(normalizeAmalgamatedClass(location.getAmalgamatedClass()));
        }
        if (location.getDescription() != null) entity.setDescription(location.getDescription());
        if (location.getNotes() != null) entity.setNotes(location.getNotes());
        if (location.getAccessibilityRating() != null) entity.setAccessibilityRating(location.getAccessibilityRating());
        if (location.getCoordinateX() != null) entity.setCoordinateX(location.getCoordinateX());
        if (location.getCoordinateY() != null) entity.setCoordinateY(location.getCoordinateY());
        if (location.getMaxPalletCapacity() != null) entity.setMaxPalletCapacity(location.getMaxPalletCapacity());
        if (location.getCurrentPalletCount() != null) entity.setCurrentPalletCount(location.getCurrentPalletCount());
        if (location.getMaxWeightKg() != null) entity.setMaxWeightKg(location.getMaxWeightKg());
        if (location.getMaxVolumeCm3() != null) entity.setMaxVolumeCm3(location.getMaxVolumeCm3());
        if (location.getMaxLpnCount() != null) entity.setMaxLpnCount(location.getMaxLpnCount());

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

    @Transactional
    public RackDeleteResult deleteRack(UUID warehouseId, String area, String rowNumber, String bayNumber) {
        String normalizedArea = normalizeArea(area);
        String normalizedRow = normalizeRowNumber(rowNumber);
        String normalizedBay = normalizeBayNumber(bayNumber);

        List<LocationEntity> rackLocations = repository.findByWarehouseId(warehouseId).stream()
                .filter(loc -> normalizedArea.equalsIgnoreCase(loc.getArea()))
                .filter(loc -> normalizedRow.equals(normalizeRowNumber(loc.getRowNumber())))
                .filter(loc -> normalizedBay.equals(normalizeBayNumber(loc.getBayNumber())))
                .collect(Collectors.toList());

        if (rackLocations.isEmpty()) {
            throw new RuntimeException("Rack not found for " + normalizedArea + "-" + normalizedRow + "-" + normalizedBay);
        }

        List<String> locationCodes = rackLocations.stream().map(LocationEntity::getLocationCode).collect(Collectors.toList());
        if (inventoryItemRepository.existsByLocationCodeInAndQuantityGreaterThan(locationCodes, 0)) {
            throw new RuntimeException("Cannot delete rack with inventory stock. Move all stock out first.");
        }

        repository.deleteAll(rackLocations);
        return new RackDeleteResult(
                normalizedArea,
                normalizedRow,
                normalizedBay,
                rackLocations.size()
        );
    }

    @Transactional
    public BulkRackCreateResult bulkCreateStorageRacks(
            UUID warehouseId,
            String area,
            Integer rowsToAdd,
            Integer baysPerRow,
            Integer levelsPerRack,
            Integer binsPerLevel,
            Integer startRow,
            Integer startBay
    ) {
        String normalizedArea = normalizeArea(area);
        int rows = rowsToAdd != null ? rowsToAdd : 1;
        int bays = baysPerRow != null ? baysPerRow : 1;
        int levels = levelsPerRack != null ? levelsPerRack : 5;
        int bins = binsPerLevel != null ? binsPerLevel : 2;
        int firstBay = startBay != null ? startBay : 1;

        if (rows < 1 || rows > 50) {
            throw new RuntimeException("rowsToAdd must be between 1 and 50");
        }
        if (bays < 1 || bays > 50) {
            throw new RuntimeException("baysPerRow must be between 1 and 50");
        }
        if (levels < 1 || levels > 10) {
            throw new RuntimeException("levelsPerRack must be between 1 and 10");
        }
        if (bins < 1 || bins > 5) {
            throw new RuntimeException("binsPerLevel must be between 1 and 5");
        }
        if (firstBay < 1 || firstBay > 999) {
            throw new RuntimeException("startBay must be between 1 and 999");
        }

        List<LocationEntity> existingLocations = repository.findByWarehouseId(warehouseId).stream()
                .filter(entity -> {
                    String zoneType = entity.getZoneType();
                    return "STORAGE".equals(zoneType) || "storage".equals(entity.getLocationType());
                })
                .collect(Collectors.toList());

        int firstRow = startRow != null
                ? startRow
                : existingLocations.stream()
                .filter(entity -> normalizedArea.equalsIgnoreCase(entity.getArea()))
                .map(LocationEntity::getRowNumber)
                .map(this::safeParseInt)
                .filter(value -> value > 0)
                .max(Integer::compareTo)
                .orElse(0) + 1;
        if (firstRow < 1 || firstRow > 99) {
            throw new RuntimeException("startRow must be between 1 and 99");
        }
        if (firstRow + rows - 1 > 99) {
            throw new RuntimeException("Requested rows exceed row limit (99)");
        }
        if (firstBay + bays - 1 > 999) {
            throw new RuntimeException("Requested bays exceed bay limit (999)");
        }

        Set<String> existingRacks = existingLocations.stream()
                .map(entity -> rackKey(entity.getArea(), entity.getRowNumber(), entity.getBayNumber()))
                .collect(Collectors.toSet());
        Set<String> existingLocationCodes = existingLocations.stream()
                .map(LocationEntity::getLocationCode)
                .collect(Collectors.toCollection(HashSet::new));

        List<String> skippedRackKeys = new ArrayList<>();
        int createdRackCount = 0;
        int createdLocationCount = 0;

        for (int rowOffset = 0; rowOffset < rows; rowOffset++) {
            int row = firstRow + rowOffset;
            String rowCode = String.format("%02d", row);
            for (int bayOffset = 0; bayOffset < bays; bayOffset++) {
                int bay = firstBay + bayOffset;
                String bayCode = String.format("%03d", bay);
                String rackKey = rackKey(normalizedArea, rowCode, bayCode);

                if (existingRacks.contains(rackKey)) {
                    skippedRackKeys.add(rackKey);
                    continue;
                }

                for (int level = 1; level <= levels; level++) {
                    for (int binIndex = 0; binIndex < bins; binIndex++) {
                        String binPosition = String.valueOf((char) ('A' + binIndex));
                        String locationCode = buildCanonicalLocationCode(normalizedArea, rowCode, bayCode, level, binPosition);
                        if (existingLocationCodes.contains(locationCode)) {
                            continue;
                        }
                        LocationEntity entity = new LocationEntity();
                        entity.setWarehouseId(warehouseId);
                        entity.setLocationCode(locationCode);
                        entity.setArea(normalizedArea);
                        entity.setRowNumber(rowCode);
                        entity.setBayNumber(bayCode);
                        entity.setLevelNumber(level);
                        entity.setBinPosition(binPosition);
                        entity.setLocationType("storage");
                        entity.setZoneType("STORAGE");
                        entity.setIsActive(true);
                        entity.setRackStatus("active");
                        entity.setAmalgamatedClass(defaultClassForArea(normalizedArea));
                        entity.setDescription(String.format("Zone %s Rack %s-%s", normalizedArea, rowCode, bayCode));
                        entity.setMaxPalletCapacity(levels * bins);
                        entity.setCurrentPalletCount(0);
                        repository.save(entity);
                        existingLocationCodes.add(locationCode);
                        createdLocationCount++;
                    }
                }

                existingRacks.add(rackKey);
                createdRackCount++;
            }
        }

        return new BulkRackCreateResult(
                normalizedArea,
                createdRackCount,
                createdLocationCount,
                skippedRackKeys
        );
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
        location.setAmalgamatedClass(entity.getAmalgamatedClass());
        location.setDescription(entity.getDescription());
        location.setNotes(entity.getNotes());
        location.setAccessibilityRating(entity.getAccessibilityRating());
        location.setCoordinateX(entity.getCoordinateX());
        location.setCoordinateY(entity.getCoordinateY());
        location.setMaxPalletCapacity(entity.getMaxPalletCapacity());
        location.setCurrentPalletCount(entity.getCurrentPalletCount());
        location.setMaxWeightKg(entity.getMaxWeightKg());
        location.setMaxVolumeCm3(entity.getMaxVolumeCm3());
        location.setMaxLpnCount(entity.getMaxLpnCount());
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

    private String normalizeArea(String area) {
        if (area == null || area.isBlank()) {
            return "A";
        }
        return area.trim().toUpperCase(Locale.ROOT).substring(0, 1);
    }

    private String normalizeAmalgamatedClass(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String defaultClassForArea(String area) {
        return switch (normalizeArea(area)) {
            case "A" -> "AF";
            case "B" -> "BM";
            case "C" -> "CM";
            case "D" -> "CS";
            default -> "CM";
        };
    }

    private int safeParseInt(String value) {
        try {
            return Integer.parseInt(value == null ? "" : value.trim());
        } catch (Exception e) {
            return -1;
        }
    }

    private String normalizeRowNumber(String rowNumber) {
        int parsed = safeParseInt(rowNumber);
        if (parsed < 1 || parsed > 99) {
            throw new RuntimeException("rowNumber must be between 1 and 99");
        }
        return String.format("%02d", parsed);
    }

    private String normalizeBayNumber(String bayNumber) {
        int parsed = safeParseInt(bayNumber);
        if (parsed < 1 || parsed > 999) {
            throw new RuntimeException("bayNumber must be between 1 and 999");
        }
        return String.format("%03d", parsed);
    }

    private Integer normalizeLevelNumber(Integer levelNumber) {
        int parsed = levelNumber == null ? 1 : levelNumber;
        if (parsed < 1 || parsed > 10) {
            throw new RuntimeException("levelNumber must be between 1 and 10");
        }
        return parsed;
    }

    private String normalizeBinPosition(String binPosition) {
        if (binPosition == null || binPosition.isBlank()) {
            throw new RuntimeException("binPosition is required");
        }
        String normalized = binPosition.trim().toUpperCase(Locale.ROOT);
        if (!normalized.matches("^[A-Z]$")) {
            throw new RuntimeException("binPosition must be a single letter (A-Z)");
        }
        return normalized;
    }

    private String buildCanonicalLocationCode(String area, String rowNumber, String bayNumber, Integer levelNumber, String binPosition) {
        return String.format("%s-%s-%s-%d-%s", area, rowNumber, bayNumber, levelNumber, binPosition);
    }

    /** Rack grouping key — matches frontend deriveRackId (area-row-bay, not location_code prefix). */
    private String rackKey(String area, String rowNumber, String bayNumber) {
        return (area == null ? "" : area.trim().toUpperCase(Locale.ROOT))
                + "-"
                + (rowNumber == null ? "" : rowNumber.trim())
                + "-"
                + (bayNumber == null ? "" : bayNumber.trim());
    }

    public record BulkRackCreateResult(
            String area,
            Integer createdRacks,
            Integer createdLocations,
            List<String> skippedRacks
    ) {}

    public record RackDeleteResult(
            String area,
            String rowNumber,
            String bayNumber,
            Integer deletedLocations
    ) {}
}
