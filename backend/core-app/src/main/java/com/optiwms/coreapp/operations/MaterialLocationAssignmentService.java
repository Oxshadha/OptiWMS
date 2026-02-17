package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.operations.LocationSuggestionService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Location;
import com.optiwms.domain.master.Material;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for assigning materials to bin locations.
 * 
 * This is CRITICAL for the picking workflow - materials must be assigned to locations
 * so workers know where to find items.
 */
@Service
public class MaterialLocationAssignmentService {
    private static final java.util.Set<String> BLOCKED_RACK_STATUSES =
            java.util.Set.of("reserved", "maintenance", "out_of_service");

    private final InventoryService inventoryService;
    private final LocationService locationService;
    private final LocationSuggestionService locationSuggestionService;
    private final MaterialService materialService;

    public MaterialLocationAssignmentService(
            InventoryService inventoryService,
            LocationService locationService,
            LocationSuggestionService locationSuggestionService,
            MaterialService materialService) {
        this.inventoryService = inventoryService;
        this.locationService = locationService;
        this.locationSuggestionService = locationSuggestionService;
        this.materialService = materialService;
    }

    /**
     * Assign material to a specific location during putaway.
     * Creates or updates inventory record with location code.
     */
    @Transactional
    public InventoryItem assignMaterialToLocation(
            UUID materialId,
            UUID warehouseId,
            Integer quantity,
            String locationCode) {
        
        // Verify location exists and is active
        Location location = locationService.findByLocationCodeOptional(locationCode)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationCode));
        
        if (!location.getWarehouseId().equals(warehouseId)) {
            throw new RuntimeException("Location does not belong to warehouse: " + warehouseId);
        }
        
        if (!Boolean.TRUE.equals(location.getIsActive())) {
            throw new RuntimeException("Location is not active: " + locationCode);
        }
        if (!isRackStatusPutawayAllowed(location.getRackStatus())) {
            throw new RuntimeException("Location is not available for putaway due to rack status '"
                    + normalizeRackStatus(location.getRackStatus()) + "': " + locationCode);
        }

        validateLocationCapacity(location, warehouseId, quantity, materialId);

        // Find existing inventory at this location
        List<InventoryItem> existingInventory = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId)
                .stream()
                .filter(item -> locationCode.equals(item.getLocationCode()))
                .collect(Collectors.toList());

        InventoryItem inventoryItem;
        
        if (!existingInventory.isEmpty()) {
            // Update existing inventory
            inventoryItem = existingInventory.get(0);
            Integer currentQty = inventoryItem.getQuantity() != null ? inventoryItem.getQuantity() : 0;
            Integer currentAvailable = inventoryItem.getAvailableQuantity() != null ? inventoryItem.getAvailableQuantity() : 0;
            
            inventoryItem.setQuantity(currentQty + quantity);
            inventoryItem.setAvailableQuantity(currentAvailable + quantity);
            inventoryItem.setLocationCode(locationCode);
            
            return inventoryService.createOrUpdate(inventoryItem);
        } else {
            // Create new inventory record
            Material material = materialService.findById(materialId);
            
            inventoryItem = new InventoryItem();
            inventoryItem.setMaterialId(materialId);
            inventoryItem.setWarehouseId(warehouseId);
            inventoryItem.setLocationCode(locationCode);
            inventoryItem.setQuantity(quantity);
            inventoryItem.setAvailableQuantity(quantity);
            inventoryItem.setReservedQuantity(0);
            inventoryItem.setStatus("active");
            inventoryItem.setMaterialType(material.getMaterialType());
            
            return inventoryService.createOrUpdate(inventoryItem);
        }
    }

    private void validateLocationCapacity(Location location, UUID warehouseId, Integer putawayQuantity, UUID materialId) {
        if (putawayQuantity == null || putawayQuantity <= 0) {
            throw new RuntimeException("Invalid putaway quantity");
        }

        List<InventoryItem> locationInventory = inventoryService.findByWarehouse(warehouseId).stream()
                .filter(item -> location.getLocationCode().equals(item.getLocationCode()))
                .collect(Collectors.toList());

        int currentQuantity = locationInventory.stream()
                .mapToInt(item -> item.getQuantity() != null ? item.getQuantity() : 0)
                .sum();

        if (location.getCapacity() != null && location.getCapacity().intValue() > 0) {
            int capacityUnits = location.getCapacity().intValue();
            if (currentQuantity + putawayQuantity > capacityUnits) {
                throw new RuntimeException("Location capacity exceeded for " + location.getLocationCode()
                        + ". Capacity: " + capacityUnits + ", Current: " + currentQuantity
                        + ", Requested: " + putawayQuantity);
            }
        }

        boolean hasMaterialAlready = locationInventory.stream().anyMatch(item -> materialId.equals(item.getMaterialId()));
        if (location.getMaxPalletCapacity() != null && location.getCurrentPalletCount() != null) {
            if (location.getCurrentPalletCount() >= location.getMaxPalletCapacity() && !hasMaterialAlready) {
                throw new RuntimeException("Location pallet capacity reached for " + location.getLocationCode());
            }
        }
    }

    /**
     * Find all locations where a material is stored in a warehouse.
     * Returns locations with available quantities.
     */
    public List<LocationInventory> findMaterialLocations(UUID materialId, UUID warehouseId) {
        List<InventoryItem> inventoryItems = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId)
                .stream()
                .filter(item -> item.getLocationCode() != null && !item.getLocationCode().isEmpty())
                .filter(item -> item.getAvailableQuantity() != null && item.getAvailableQuantity() > 0)
                .collect(Collectors.toList());

        return inventoryItems.stream()
                .map(item -> {
                    Location location = locationService.findByLocationCodeOptional(item.getLocationCode()).orElse(null);
                    return new LocationInventory(
                            item.getLocationCode(),
                            location != null ? location.getArea() : null,
                            location != null ? location.getRowNumber() : null,
                            location != null ? location.getBayNumber() : null,
                            location != null ? location.getLevelNumber() : null,
                            location != null ? location.getBinPosition() : null,
                            item.getAvailableQuantity()
                    );
                })
                .collect(Collectors.toList());
    }

    /**
     * Get available quantity of a material at a specific location.
     */
    public Integer getAvailableQuantityAtLocation(
            UUID materialId,
            UUID warehouseId,
            String locationCode) {
        
        List<InventoryItem> inventoryItems = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId)
                .stream()
                .filter(item -> locationCode.equals(item.getLocationCode()))
                .collect(Collectors.toList());

        return inventoryItems.stream()
                .mapToInt(item -> item.getAvailableQuantity() != null ? item.getAvailableQuantity() : 0)
                .sum();
    }

    /**
     * Suggest location for putaway (with AI support if available).
     */
    public String suggestLocationForPutaway(
            UUID materialId,
            UUID warehouseId,
            Integer quantity) {
        
        Material material = materialService.findById(materialId);
        
        // Use LocationSuggestionService (supports AI if available)
        com.optiwms.coreapp.operations.LocationSuggestionService.LocationSuggestion suggestion = 
                locationSuggestionService.suggestPutawayLocation(
                        warehouseId,
                        materialId,
                        quantity,
                        material.getMaterialType() != null ? material.getMaterialType() : "product"
                );
        
        return suggestion.getLocationCode();
    }

    /**
     * Record representing material location with available quantity.
     */
    public record LocationInventory(
            String locationCode,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            Integer availableQuantity
    ) {}

    private boolean isRackStatusPutawayAllowed(String rackStatus) {
        return !BLOCKED_RACK_STATUSES.contains(normalizeRackStatus(rackStatus));
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
}
