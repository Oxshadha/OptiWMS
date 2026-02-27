package com.optiwms.coreapp.master;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.master.MaterialDefaultLocation;
import com.optiwms.infra.master.MaterialDefaultLocationEntity;
import com.optiwms.infra.master.MaterialDefaultLocationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing default bin locations for materials.
 * Allows assigning materials to specific bin locations in the catalog.
 */
@Service
public class MaterialDefaultLocationService {
    private static final java.util.Set<String> BLOCKED_RACK_STATUSES = java.util.Set.of(
            "reserved", "maintenance", "out_of_service");

    private final MaterialDefaultLocationRepository repository;
    private final MaterialService materialService;
    private final LocationService locationService;
    private final InventoryService inventoryService;

    public MaterialDefaultLocationService(
            MaterialDefaultLocationRepository repository,
            MaterialService materialService,
            LocationService locationService,
            InventoryService inventoryService) {
        this.repository = repository;
        this.materialService = materialService;
        this.locationService = locationService;
        this.inventoryService = inventoryService;
    }

    /**
     * Assign default location to a material in a warehouse
     * Also updates inventory location_code if inventory exists for this
     * material+warehouse
     */
    @Transactional
    public MaterialDefaultLocation assignDefaultLocation(
            UUID materialId,
            UUID warehouseId,
            String locationCode,
            Integer priority,
            String materialType) {

        // Verify material exists
        Material material = materialService.findById(materialId);

        // Verify location exists and is a storage location (not
        // staging/receiving/shipment/packing)
        com.optiwms.domain.master.Location location = locationService.findByLocationCodeOptional(locationCode)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationCode));

        if (!location.getWarehouseId().equals(warehouseId)) {
            throw new RuntimeException("Location does not belong to warehouse: " + warehouseId);
        }

        // Only allow storage locations (exclude staging, receiving, shipment, packing)
        if (!"storage".equals(location.getLocationType()) &&
                !"STORAGE".equals(location.getZoneType())) {
            throw new RuntimeException("Only storage locations can be assigned to materials. Location type: "
                    + location.getLocationType());
        }

        if (!Boolean.TRUE.equals(location.getIsActive())) {
            throw new RuntimeException("Cannot assign inactive location as default: " + locationCode);
        }

        String rackStatus = normalize(location.getRackStatus(), "active");
        if (BLOCKED_RACK_STATUSES.contains(rackStatus)) {
            throw new RuntimeException("Cannot assign blocked rack status location as default: " + locationCode);
        }

        validateMaterialStorageCompatibility(material, locationCode, location.getLocationType());

        Integer resolvedPriority = priority != null ? priority : 1;
        if (resolvedPriority <= 0) {
            throw new RuntimeException("Priority must be >= 1");
        }

        // Keep one primary material per location per warehouse to avoid ambiguous putaway defaults.
        if (resolvedPriority == 1) {
            var existingPrimary = repository.findByWarehouseIdAndLocationCodeAndPriority(warehouseId, locationCode, 1);
            for (MaterialDefaultLocationEntity existing : existingPrimary) {
                if (!existing.getMaterialId().equals(materialId)) {
                    throw new RuntimeException(
                            "Location " + locationCode + " is already primary for another material. Use a different primary bin or lower priority.");
                }
            }
        }

        MaterialDefaultLocationEntity entity = repository
                .findByMaterialIdAndWarehouseIdAndLocationCode(materialId, warehouseId, locationCode)
                .orElse(new MaterialDefaultLocationEntity());

        entity.setMaterialId(materialId);
        entity.setWarehouseId(warehouseId);
        entity.setLocationCode(locationCode);
        entity.setPriority(resolvedPriority);
        entity.setMaterialType(materialType);

        MaterialDefaultLocationEntity saved = repository.save(entity);

        // CRITICAL: Also update inventory location_code if inventory exists
        // This ensures bulk assignment updates actual inventory, not just default
        // locations
        List<InventoryItem> existingInventory = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        for (InventoryItem inv : existingInventory) {
            // Only update if inventory has quantity > 0 (in-stock items)
            if (inv.getQuantity() != null && inv.getQuantity() > 0) {
                inv.setLocationCode(locationCode);
                inventoryService.createOrUpdate(inv);
            }
        }

        return toDomain(saved);
    }

    private void validateMaterialStorageCompatibility(Material material, String locationCode, String locationTypeRaw) {
        String storageType = normalize(material.getStorageType(), "pallet");
        String locationType = normalize(locationTypeRaw, "storage");
        boolean locationIsBulk = "bulk".equals(locationType);
        if ("bulk".equals(storageType) && !locationIsBulk) {
            throw new RuntimeException("Bulk material must use a bulk location. Location " + locationCode
                    + " is type '" + locationType + "'");
        }
        if (!"bulk".equals(storageType) && locationIsBulk) {
            throw new RuntimeException("Non-bulk material cannot use bulk location " + locationCode);
        }
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim().toLowerCase();
    }

    /**
     * Get default locations for a material in a warehouse
     */
    public List<MaterialDefaultLocation> getDefaultLocations(UUID materialId, UUID warehouseId) {
        return repository.findByMaterialIdAndWarehouseId(materialId, warehouseId)
                .stream()
                .sorted((a, b) -> Integer.compare(
                        a.getPriority() != null ? a.getPriority() : 999,
                        b.getPriority() != null ? b.getPriority() : 999))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    /**
     * Get primary (priority 1) default location for a material
     */
    public MaterialDefaultLocation getPrimaryLocation(UUID materialId, UUID warehouseId) {
        return repository.findByMaterialIdAndWarehouseId(materialId, warehouseId)
                .stream()
                .filter(loc -> loc.getPriority() != null && loc.getPriority() == 1)
                .findFirst()
                .map(this::toDomain)
                .orElse(null);
    }

    /**
     * Remove default location assignment
     */
    @Transactional
    public void removeDefaultLocation(UUID materialId, UUID warehouseId, String locationCode) {
        repository.findByMaterialIdAndWarehouseIdAndLocationCode(materialId, warehouseId, locationCode)
                .ifPresent(repository::delete);
    }

    /**
     * Get all materials with their default locations in a warehouse
     */
    public List<MaterialWithLocation> getMaterialsWithLocations(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId)
                .stream()
                .map(entity -> {
                    Material material = materialService.findById(entity.getMaterialId());
                    return new MaterialWithLocation(
                            material.getId(),
                            material.getMaterialCode(),
                            material.getDescription(),
                            material.getMaterialType(),
                            entity.getLocationCode(),
                            entity.getPriority());
                })
                .collect(Collectors.toList());
    }

    /**
     * Assign default locations to all materials in a warehouse (bulk assignment)
     * Uses ABC/FMS preferred zone when available, otherwise defaults to Zone C
     * Also updates inventory location_code for existing inventory
     */
    @Transactional
    public BulkAssignResult assignDefaultLocationsToAllMaterials(UUID warehouseId) {
        // Get all materials
        List<Material> materials = materialService.listAll();

        // Get all storage locations in warehouse, grouped by zone
        List<com.optiwms.domain.master.Location> allStorageLocations = locationService
                .findStorageLocationsByWarehouse(warehouseId);

        if (allStorageLocations.isEmpty()) {
            throw new RuntimeException(
                    "No storage locations found in warehouse. Please create storage locations first.");
        }

        // Group locations by zone (area = A, B, C, D)
        java.util.Map<String, List<com.optiwms.domain.master.Location>> locationsByZone = allStorageLocations.stream()
                .collect(Collectors.groupingBy(loc -> loc.getArea() != null ? loc.getArea().toUpperCase() : "C"));

        // Track which locations we've used in each zone
        java.util.Map<String, Integer> zoneIndexes = new java.util.HashMap<>();
        locationsByZone.keySet().forEach(zone -> zoneIndexes.put(zone, 0));

        int assignedCount = 0;
        int inventoryUpdatedCount = 0;

        for (Material material : materials) {
            // Determine preferred zone (from ABC/FMS classification, or default to C)
            String preferredZone = material.getPreferredZone();
            if (preferredZone == null || preferredZone.isEmpty()) {
                // Default zone selection based on material type
                preferredZone = "C"; // Most materials go to main storage
            }

            // Get locations in preferred zone, fallback to Zone C if not available
            List<com.optiwms.domain.master.Location> zoneLocations = locationsByZone.get(preferredZone);
            if (zoneLocations == null || zoneLocations.isEmpty()) {
                zoneLocations = locationsByZone.get("C");
                preferredZone = "C";
            }

            if (zoneLocations == null || zoneLocations.isEmpty()) {
                // Fallback to any available location
                zoneLocations = allStorageLocations;
                preferredZone = allStorageLocations.get(0).getArea();
            }

            // Get next available location in zone (round-robin within zone)
            int currentIndex = zoneIndexes.getOrDefault(preferredZone, 0);
            if (currentIndex >= zoneLocations.size()) {
                currentIndex = 0;
            }

            com.optiwms.domain.master.Location location = zoneLocations.get(currentIndex);
            zoneIndexes.put(preferredZone, currentIndex + 1);

            // Check if already assigned
            if (repository.findByMaterialIdAndWarehouseId(material.getId(), warehouseId).isEmpty()) {
                assignDefaultLocation(
                        material.getId(),
                        warehouseId,
                        location.getLocationCode(),
                        1,
                        material.getMaterialType());
                assignedCount++;

                // Count inventory updates
                List<InventoryItem> inventory = inventoryService.findByMaterialAndWarehouse(material.getId(),
                        warehouseId);
                for (InventoryItem inv : inventory) {
                    if (inv.getQuantity() != null && inv.getQuantity() > 0) {
                        inventoryUpdatedCount++;
                    }
                }
            }
        }

        return new BulkAssignResult(assignedCount, inventoryUpdatedCount);
    }

    /**
     * Sync inventory location_code from existing material default locations.
     * Useful when default locations exist but inventory wasn't updated.
     */
    @Transactional
    public BulkAssignResult syncInventoryLocationsFromDefaults(UUID warehouseId) {
        int inventoryUpdatedCount = 0;
        int materialsProcessed = 0;

        // Get all existing default locations for this warehouse
        List<MaterialDefaultLocationEntity> defaultLocations = repository.findByWarehouseId(warehouseId);

        for (MaterialDefaultLocationEntity defaultLoc : defaultLocations) {
            materialsProcessed++;

            // Get inventory items for this material in this warehouse
            List<InventoryItem> inventoryItems = inventoryService.findByMaterialAndWarehouse(
                    defaultLoc.getMaterialId(), warehouseId);

            for (InventoryItem inv : inventoryItems) {
                // Update location_code if inventory has quantity and location is different
                if (inv.getQuantity() != null && inv.getQuantity() > 0) {
                    String currentLocation = inv.getLocationCode();
                    String defaultLocation = defaultLoc.getLocationCode();

                    // Only update if location is null, empty, or different
                    if (currentLocation == null || currentLocation.isEmpty() ||
                            !currentLocation.equals(defaultLocation)) {
                        inv.setLocationCode(defaultLocation);
                        inventoryService.createOrUpdate(inv);
                        inventoryUpdatedCount++;
                    }
                }
            }
        }

        return new BulkAssignResult(materialsProcessed, inventoryUpdatedCount);
    }

    public record BulkAssignResult(int materialsAssigned, int inventoryRecordsUpdated) {
    }

    private MaterialDefaultLocation toDomain(MaterialDefaultLocationEntity entity) {
        MaterialDefaultLocation domain = new MaterialDefaultLocation();
        domain.setId(entity.getId());
        domain.setMaterialId(entity.getMaterialId());
        domain.setWarehouseId(entity.getWarehouseId());
        domain.setLocationCode(entity.getLocationCode());
        domain.setPriority(entity.getPriority());
        domain.setMaterialType(entity.getMaterialType());
        domain.setNotes(entity.getNotes());
        domain.setCreatedAt(entity.getCreatedAt());
        domain.setUpdatedAt(entity.getUpdatedAt());
        return domain;
    }

    public record MaterialWithLocation(
            UUID materialId,
            String materialCode,
            String description,
            String materialType,
            String locationCode,
            Integer priority) {
    }
}
