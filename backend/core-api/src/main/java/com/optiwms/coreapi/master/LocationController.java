package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.LocationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/api/locations", "/api/master/locations"}) // Support both routes for compatibility
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    @GetMapping
    public ResponseEntity<List<LocationDto>> list(
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String area
    ) {
        List<com.optiwms.domain.master.Location> locations;
        
        if (warehouseId != null) {
            if ("available".equals(status)) {
                locations = locationService.findAvailableByWarehouse(warehouseId);
            } else {
                locations = locationService.findByWarehouse(warehouseId);
            }
        } else {
            locations = locationService.listAll();
        }

        var data = locations.stream()
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LocationDto> getById(@PathVariable UUID id) {
        try {
            var location = locationService.findById(id);
            return ResponseEntity.ok(toDto(location));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/code/{locationCode}")
    public ResponseEntity<LocationDto> getByCode(@PathVariable String locationCode) {
        try {
            var location = locationService.findByLocationCode(locationCode);
            return ResponseEntity.ok(toDto(location));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/warehouse/{warehouseId}")
    public ResponseEntity<List<LocationDto>> getByWarehouse(@PathVariable UUID warehouseId) {
        var locations = locationService.findByWarehouse(warehouseId);
        return ResponseEntity.ok(locations.stream().map(this::toDto).toList());
    }

    /**
     * Get only storage locations (exclude staging, receiving, shipment, packing areas)
     * For warehouse map visualization - only show racks, not staging areas
     */
    @GetMapping("/warehouse/{warehouseId}/storage-only")
    public ResponseEntity<List<LocationDto>> getStorageLocationsByWarehouse(@PathVariable UUID warehouseId) {
        var locations = locationService.findStorageLocationsByWarehouse(warehouseId);
        return ResponseEntity.ok(locations.stream().map(this::toDto).toList());
    }

    @GetMapping("/available")
    public ResponseEntity<List<LocationDto>> getAvailable(
            @RequestParam UUID warehouseId
    ) {
        var locations = locationService.findAvailableByWarehouse(warehouseId);
        return ResponseEntity.ok(locations.stream().map(this::toDto).toList());
    }

    @GetMapping("/hierarchy")
    public ResponseEntity<Map<String, Object>> getHierarchy(
            @RequestParam UUID warehouseId
    ) {
        var locations = locationService.findByWarehouse(warehouseId);
        
        // Group by area, row, bay
        var hierarchy = locations.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                    com.optiwms.domain.master.Location::getArea,
                    java.util.stream.Collectors.groupingBy(
                        com.optiwms.domain.master.Location::getRowNumber,
                        java.util.stream.Collectors.groupingBy(
                            com.optiwms.domain.master.Location::getBayNumber,
                            java.util.stream.Collectors.mapping(this::toDto, java.util.stream.Collectors.toList())
                        )
                    )
                ));
        
        return ResponseEntity.ok(Map.of("warehouseId", warehouseId.toString(), "hierarchy", hierarchy));
    }

    @PostMapping
    public ResponseEntity<LocationDto> create(@RequestBody CreateLocationRequest request) {
        try {
            var location = new com.optiwms.domain.master.Location();
            location.setWarehouseId(UUID.fromString(request.warehouseId()));
            location.setLocationCode(request.locationCode());
            location.setArea(request.area());
            location.setRowNumber(request.rowNumber());
            location.setBayNumber(request.bayNumber());
            location.setLevelNumber(request.levelNumber());
            location.setBinPosition(request.binPosition());
            location.setLocationType(request.locationType() != null ? request.locationType() : "storage");
            location.setCapacity(request.capacity() != null ? new java.math.BigDecimal(request.capacity()) : null);
            location.setIsActive(request.isActive() != null ? request.isActive() : true);
            location.setQrCode(request.qrCode());

            var created = locationService.create(location);
            return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/bulk-racks")
    public ResponseEntity<?> bulkCreateRacks(@RequestBody BulkCreateRacksRequest request) {
        try {
            if (request.warehouseId() == null || request.warehouseId().isBlank()) {
                throw new RuntimeException("warehouseId is required");
            }
            var result = locationService.bulkCreateStorageRacks(
                    UUID.fromString(request.warehouseId()),
                    request.area(),
                    request.rowsToAdd(),
                    request.baysPerRow(),
                    request.levelsPerRack(),
                    request.binsPerLevel(),
                    request.startRow(),
                    request.startBay()
            );
            return ResponseEntity.ok(Map.of(
                    "message", String.format("Created %d racks (%d locations) in zone %s.",
                            result.createdRacks(), result.createdLocations(), result.area()),
                    "area", result.area(),
                    "createdRacks", result.createdRacks(),
                    "createdLocations", result.createdLocations(),
                    "skippedRacks", result.skippedRacks()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody UpdateLocationRequest request) {
        try {
            var location = new com.optiwms.domain.master.Location();
            location.setLocationCode(request.locationCode());
            location.setArea(request.area());
            location.setRowNumber(request.rowNumber());
            location.setBayNumber(request.bayNumber());
            location.setLevelNumber(request.levelNumber());
            location.setBinPosition(request.binPosition());
            location.setLocationType(request.locationType());
            location.setCapacity(request.capacity() != null ? new java.math.BigDecimal(request.capacity()) : null);
            location.setIsActive(request.isActive());
            location.setQrCode(request.qrCode());
            location.setRackStatus(request.rackStatus());
            location.setAmalgamatedClass(request.amalgamatedClass());
            location.setDescription(request.description());
            location.setNotes(request.notes());
            location.setAccessibilityRating(request.accessibilityRating());
            location.setCoordinateX(request.coordinateX() != null ? new java.math.BigDecimal(request.coordinateX()) : null);
            location.setCoordinateY(request.coordinateY() != null ? new java.math.BigDecimal(request.coordinateY()) : null);
            location.setMaxPalletCapacity(request.maxPalletCapacity());
            location.setCurrentPalletCount(request.currentPalletCount());
            location.setMaxWeightKg(request.maxWeightKg() != null ? new java.math.BigDecimal(request.maxWeightKg()) : null);
            location.setMaxVolumeCm3(request.maxVolumeCm3() != null ? new java.math.BigDecimal(request.maxVolumeCm3()) : null);
            location.setMaxLpnCount(request.maxLpnCount());

            var updated = locationService.update(id, location);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // Rack-specific update endpoint (updates only rack properties)
    @PutMapping("/racks/{id}")
    public ResponseEntity<?> updateRack(@PathVariable UUID id, @RequestBody UpdateRackRequest request) {
        try {
            var location = locationService.findById(id);
            if (request.rackStatus() != null) location.setRackStatus(request.rackStatus());
            if (request.amalgamatedClass() != null) location.setAmalgamatedClass(request.amalgamatedClass());
            if (request.description() != null) location.setDescription(request.description());
            if (request.notes() != null) location.setNotes(request.notes());
            if (request.accessibilityRating() != null) location.setAccessibilityRating(request.accessibilityRating());
            if (request.capacity() != null) location.setCapacity(new java.math.BigDecimal(request.capacity()));
            if (request.maxPalletCapacity() != null) location.setMaxPalletCapacity(request.maxPalletCapacity());
            if (request.maxWeightKg() != null) location.setMaxWeightKg(new java.math.BigDecimal(request.maxWeightKg()));
            if (request.maxVolumeCm3() != null) location.setMaxVolumeCm3(new java.math.BigDecimal(request.maxVolumeCm3()));
            if (request.maxLpnCount() != null) location.setMaxLpnCount(request.maxLpnCount());

            var updated = locationService.update(id, location);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            locationService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/racks")
    public ResponseEntity<?> deleteRack(
            @RequestParam UUID warehouseId,
            @RequestParam String area,
            @RequestParam String rowNumber,
            @RequestParam String bayNumber
    ) {
        try {
            var result = locationService.deleteRack(warehouseId, area, rowNumber, bayNumber);
            return ResponseEntity.ok(Map.of(
                    "message", String.format("Deleted rack %s-%s-%s (%d locations).",
                            result.area(), result.rowNumber(), result.bayNumber(), result.deletedLocations()),
                    "area", result.area(),
                    "rowNumber", result.rowNumber(),
                    "bayNumber", result.bayNumber(),
                    "deletedLocations", result.deletedLocations()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private LocationDto toDto(com.optiwms.domain.master.Location location) {
        return new LocationDto(
                location.getId().toString(),
                location.getWarehouseId().toString(),
                location.getLocationCode(),
                location.getArea(),
                location.getRowNumber(),
                location.getBayNumber(),
                location.getLevelNumber(),
                location.getBinPosition(),
                location.getLocationType(),
                location.getZoneType(),
                location.getCapacity() != null ? location.getCapacity().toString() : null,
                location.getIsActive() != null ? location.getIsActive() : true,
                location.getQrCode(),
                location.getRackStatus(),
                location.getAmalgamatedClass(),
                location.getDescription(),
                location.getNotes(),
                location.getAccessibilityRating(),
                location.getCoordinateX() != null ? location.getCoordinateX().toString() : null,
                location.getCoordinateY() != null ? location.getCoordinateY().toString() : null,
                location.getMaxPalletCapacity(),
                location.getCurrentPalletCount(),
                location.getMaxWeightKg() != null ? location.getMaxWeightKg().toString() : null,
                location.getMaxVolumeCm3() != null ? location.getMaxVolumeCm3().toString() : null,
                location.getMaxLpnCount()
        );
    }

    public record LocationDto(
            String id,
            String warehouseId,
            String locationCode,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            String locationType,
            String zoneType,
            String capacity,
            Boolean isActive,
            String qrCode,
            String rackStatus,
            String amalgamatedClass,
            String description,
            String notes,
            Integer accessibilityRating,
            String coordinateX,
            String coordinateY,
            Integer maxPalletCapacity,
            Integer currentPalletCount,
            String maxWeightKg,
            String maxVolumeCm3,
            Integer maxLpnCount
    ) {}


    public record CreateLocationRequest(
            String warehouseId,
            String locationCode,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            String locationType,
            String capacity,
            Boolean isActive,
            String qrCode
    ) {}

    public record UpdateLocationRequest(
            String locationCode,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            String locationType,
            String capacity,
            Boolean isActive,
            String qrCode,
            String rackStatus,
            String amalgamatedClass,
            String description,
            String notes,
            Integer accessibilityRating,
            String coordinateX,
            String coordinateY,
            Integer maxPalletCapacity,
            Integer currentPalletCount,
            String maxWeightKg,
            String maxVolumeCm3,
            Integer maxLpnCount
    ) {}

    public record UpdateRackRequest(
            String rackStatus,
            String amalgamatedClass,
            String description,
            String notes,
            Integer accessibilityRating,
            String capacity,
            Integer maxPalletCapacity,
            String maxWeightKg,
            String maxVolumeCm3,
            Integer maxLpnCount
    ) {}

    public record BulkCreateRacksRequest(
            String warehouseId,
            String area,
            Integer rowsToAdd,
            Integer baysPerRow,
            Integer levelsPerRack,
            Integer binsPerLevel,
            Integer startRow,
            Integer startBay
    ) {}

}
