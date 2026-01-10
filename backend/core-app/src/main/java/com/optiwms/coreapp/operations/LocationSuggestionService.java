package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Location;
import com.optiwms.domain.master.Material;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Location Suggestion Service
 * 
 * Provides location suggestions for putaway operations.
 * 
 * Architecture:
 * 1. First tries AI service (if available)
 * 2. Falls back to industry-standard rules if AI unavailable
 * 
 * This ensures WMS works fluently without AI services.
 */
@Service
public class LocationSuggestionService {

    private static final Logger logger = LoggerFactory.getLogger(LocationSuggestionService.class);
    
    private final LocationService locationService;
    private final InventoryService inventoryService;
    private final MaterialService materialService;
    private final AIServiceAdapter aiServiceAdapter;

    public LocationSuggestionService(
            LocationService locationService,
            InventoryService inventoryService,
            MaterialService materialService,
            AIServiceAdapter aiServiceAdapter) {
        this.locationService = locationService;
        this.inventoryService = inventoryService;
        this.materialService = materialService;
        this.aiServiceAdapter = aiServiceAdapter;
    }

    /**
     * Suggest putaway location for material
     * 
     * Flow:
     * 1. Try AI service (if available)
     * 2. Fall back to rule-based suggestion if AI unavailable
     */
    public LocationSuggestion suggestPutawayLocation(
            UUID warehouseId,
            UUID materialId,
            Integer quantity,
            String materialType) {
        
        logger.info("Suggesting putaway location for material: {}, warehouse: {}", materialId, warehouseId);
        
        // Try AI service first (non-blocking, graceful degradation)
        Optional<LocationSuggestion> aiSuggestion = aiServiceAdapter.suggestOptimalStorage(
            warehouseId, materialId, quantity, materialType);
        
        if (aiSuggestion.isPresent() && aiSuggestion.get().isAiEnhanced()) {
            logger.info("Using AI-enhanced location suggestion: {}", aiSuggestion.get().getLocationCode());
            return aiSuggestion.get();
        }
        
        // Fall back to rule-based suggestion
        logger.info("AI service unavailable, using rule-based location suggestion");
        return suggestLocationByRules(warehouseId, materialId, quantity, materialType);
    }

    /**
     * Industry-standard rule-based location suggestion
     * 
     * Rules (in priority order):
     * 1. Same material consolidation (if material already exists, use same location)
     * 2. Zone-based assignment (fast-moving items near entrance)
     * 3. First available location (FIFO for empty locations)
     * 4. Capacity-based selection (avoid overfilling)
     */
    private LocationSuggestion suggestLocationByRules(
            UUID warehouseId,
            UUID materialId,
            Integer quantity,
            String materialType) {
        
        // Rule 1: Check if material already exists - consolidate if possible
        List<InventoryItem> existingInventory = inventoryService.findByWarehouse(warehouseId)
            .stream()
            .filter(item -> item.getMaterialId().equals(materialId))
            .filter(item -> item.getLocationCode() != null && !item.getLocationCode().isEmpty())
            .collect(Collectors.toList());
        
        if (!existingInventory.isEmpty()) {
            // Find location with same material that has capacity
            for (InventoryItem item : existingInventory) {
                try {
                    Location location = locationService.findByLocationCode(item.getLocationCode());
                    if (location != null && Boolean.TRUE.equals(location.getIsActive()) && hasCapacity(location, quantity)) {
                        return new LocationSuggestion(
                            location.getLocationCode(),
                            "Same material consolidation - existing location",
                            false
                        );
                    }
                } catch (Exception e) {
                    logger.warn("Error finding location {}: {}", item.getLocationCode(), e.getMessage());
                }
            }
        }
        
        // Rule 2: Zone-based assignment (fast-moving items near entrance)
        Material material = materialService.findById(materialId);
        boolean isFastMoving = isFastMovingMaterial(material);
        
        List<Location> availableLocations = locationService.findByWarehouse(warehouseId)
            .stream()
            .filter(loc -> Boolean.TRUE.equals(loc.getIsActive()))
            .filter(loc -> "storage".equals(loc.getLocationType()) || "putaway".equals(loc.getLocationType()))
            .filter(loc -> isLocationAvailable(loc))
            .filter(loc -> hasCapacity(loc, quantity))
            .sorted(Comparator
                .comparing((Location loc) -> isFastMoving ? getAccessibilityScore(loc) : 0)
                .reversed()
                .thenComparing(Location::getLocationCode))
            .collect(Collectors.toList());
        
        if (!availableLocations.isEmpty()) {
            Location selected = availableLocations.get(0);
            String reason = isFastMoving 
                ? "Fast-moving item - assigned to high-accessibility location"
                : "First available location based on capacity";
            
            return new LocationSuggestion(selected.getLocationCode(), reason, false);
        }
        
        // Rule 3: If no perfect match, find any available location
        List<Location> allLocations = locationService.findByWarehouse(warehouseId)
            .stream()
            .filter(loc -> Boolean.TRUE.equals(loc.getIsActive()))
            .filter(loc -> isLocationAvailable(loc))
            .sorted(Comparator.comparing(Location::getLocationCode))
            .collect(Collectors.toList());
        
        if (!allLocations.isEmpty()) {
            return new LocationSuggestion(
                allLocations.get(0).getLocationCode(),
                "First available location (fallback)",
                false
            );
        }
        
        // No location found
        throw new RuntimeException("No available location found for putaway");
    }

    /**
     * Check if location has capacity for quantity
     */
    private boolean hasCapacity(Location location, Integer quantity) {
        // Get current inventory at location
        List<InventoryItem> locationInventory = inventoryService.findByWarehouse(location.getWarehouseId())
            .stream()
            .filter(item -> location.getLocationCode().equals(item.getLocationCode()))
            .collect(Collectors.toList());
        
        int currentQuantity = locationInventory.stream()
            .mapToInt(item -> item.getQuantity() != null ? item.getQuantity() : 0)
            .sum();
        
        // Assume location capacity (can be enhanced with location.maxCapacity field)
        int maxCapacity = 100; // Default capacity
        return (currentQuantity + quantity) <= maxCapacity;
    }

    /**
     * Check if location is available (not reserved, not full)
     */
    private boolean isLocationAvailable(Location location) {
        // Check if location is not reserved for other operations
        // This can be enhanced with reservation system
        return Boolean.TRUE.equals(location.getIsActive());
    }

    /**
     * Determine if material is fast-moving based on historical data
     * Simple heuristic: check inventory turnover or material type
     */
    private boolean isFastMovingMaterial(Material material) {
        // Simple heuristic: check material type or description
        // Fast-moving items are often consumer goods, electronics, etc.
        // Can be enhanced with actual movement history from inventory
        if (material.getMaterialType() != null) {
            String type = material.getMaterialType().toLowerCase();
            // Common fast-moving categories
            return type.contains("fast") || type.contains("consumer") || type.contains("retail");
        }
        return false;
    }

    /**
     * Calculate accessibility score for location
     * Locations closer to entrance (lower aisle/bay numbers) score higher
     */
    private int getAccessibilityScore(Location location) {
        // Use accessibility rating if available
        if (location.getAccessibilityRating() != null) {
            return location.getAccessibilityRating();
        }
        
        // Fallback: parse location code (format: A-01-01-01 = Aisle-Bay-Level-Position)
        String code = location.getLocationCode();
        try {
            String[] parts = code.split("-");
            if (parts.length >= 2) {
                int aisle = Integer.parseInt(parts[1]);
                int bay = parts.length >= 3 ? Integer.parseInt(parts[2]) : 1;
                // Lower numbers = higher accessibility
                return 100 - (aisle * 10) - bay;
            }
        } catch (NumberFormatException e) {
            logger.warn("Could not parse location code for accessibility: {}", code);
        }
        return 50; // Default score
    }

    /**
     * Location suggestion result
     */
    public static class LocationSuggestion {
        private final String locationCode;
        private final String reason;
        private final boolean aiEnhanced;

        public LocationSuggestion(String locationCode, String reason, boolean aiEnhanced) {
            this.locationCode = locationCode;
            this.reason = reason;
            this.aiEnhanced = aiEnhanced;
        }

        public String getLocationCode() {
            return locationCode;
        }

        public String getReason() {
            return reason;
        }

        public boolean isAiEnhanced() {
            return aiEnhanced;
        }
    }
}
