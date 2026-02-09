package com.optiwms.integration;

import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationLevelEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.LocationLevelRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Realistic Storage Location Generator
 * Creates storage locations with proper ABC/FMS zones (A, B, C, D)
 * Based on Training Report structure for optimal storage categorization
 * 
 * Zone Structure:
 * - Zone A: High accessibility (front/ground) - 1 row, few bays - for fast movers
 * - Zone B: Medium accessibility (middle) - 2-3 rows - for medium movers  
 * - Zone C: Main storage (most locations) - multiple rows - for regular items
 * - Zone D: Low accessibility (back/upper) - back rows, upper levels - for slow movers
 */
@Component
public class RealisticStorageLocationGenerator {

    private final LocationRepository locationRepository;
    private final LocationLevelRepository locationLevelRepository;

    public RealisticStorageLocationGenerator(
            LocationRepository locationRepository,
            LocationLevelRepository locationLevelRepository) {
        this.locationRepository = locationRepository;
        this.locationLevelRepository = locationLevelRepository;
    }

    /**
     * Generate realistic storage locations for a warehouse
     * Creates zones A, B, C, D with proper accessibility ratings for ABC/FMS
     * Only generates zones that don't already exist
     */
    @Transactional
    public int generateRealisticStorageLocations(UUID warehouseId) {
        System.out.println("Generating realistic storage locations for warehouse: " + warehouseId);
        
        // Check which zones already exist
        List<LocationEntity> existingLocations = locationRepository.findByWarehouseId(warehouseId);
        java.util.Set<String> existingZones = existingLocations.stream()
            .filter(loc -> "STORAGE".equals(loc.getZoneType()))
            .map(LocationEntity::getArea)
            .filter(area -> area != null && (area.equals("A") || area.equals("B") || area.equals("C") || area.equals("D")))
            .collect(java.util.stream.Collectors.toSet());
        
        if (existingZones.size() == 4) {
            System.out.println("  All realistic zones (A, B, C, D) already exist. Skipping generation.");
            return 0;
        }
        
        int totalLocations = 0;
        
        // Zone A: High Accessibility (Front/Ground) - 1 row, 5 bays
        // For ABC-A items (fast movers, high value)
        // Accessibility: 9-10 (highest), Ground level preferred
        if (!existingZones.contains("A")) {
            totalLocations += generateZone(warehouseId, "A", 1, 5, 4, 3, 
                    9, 10, "High Accessibility - Front/Ground - ABC-A Items");
        } else {
            System.out.println("  Zone A already exists, skipping");
        }
        
        // Zone B: Medium Accessibility (Middle) - 2 rows, 8 bays each
        // For ABC-B items (medium movers)
        // Accessibility: 6-8 (medium), Middle levels
        if (!existingZones.contains("B")) {
            totalLocations += generateZone(warehouseId, "B", 2, 8, 5, 3,
                    6, 8, "Medium Accessibility - Middle - ABC-B Items");
        } else {
            System.out.println("  Zone B already exists, skipping");
        }
        
        // Zone C: Main Storage (Most locations) - 10 rows, 12 bays each
        // For ABC-C items and general storage
        // Accessibility: 4-6 (medium-low), All levels
        if (!existingZones.contains("C")) {
            totalLocations += generateZone(warehouseId, "C", 10, 12, 5, 3,
                    4, 6, "Main Storage - ABC-C Items - General Storage");
        } else {
            System.out.println("  Zone C already exists, skipping");
        }
        
        // Zone D: Low Accessibility (Back/Upper) - 3 rows, 10 bays each
        // For slow movers, bulk storage
        // Accessibility: 1-3 (lowest), Upper levels preferred
        if (!existingZones.contains("D")) {
            totalLocations += generateZone(warehouseId, "D", 3, 10, 5, 3,
                    1, 3, "Low Accessibility - Back/Upper - Slow Movers");
        } else {
            System.out.println("  Zone D already exists, skipping");
        }
        
        System.out.println("Generated " + totalLocations + " realistic storage locations");
        return totalLocations;
    }

    /**
     * Generate locations for a specific zone
     * 
     * @param warehouseId Warehouse ID
     * @param areaCode Area code (A, B, C, D)
     * @param rows Number of rows in this zone
     * @param baysPerRow Number of bays per row
     * @param levelsPerBay Number of levels per bay
     * @param binsPerLevel Number of bin positions per level
     * @param minAccessibility Minimum accessibility rating (1-10)
     * @param maxAccessibility Maximum accessibility rating (1-10)
     * @param description Zone description
     */
    private int generateZone(
            UUID warehouseId,
            String areaCode,
            int rows,
            int baysPerRow,
            int levelsPerBay,
            int binsPerLevel,
            int minAccessibility,
            int maxAccessibility,
            String description) {
        
        List<LocationEntity> locations = new ArrayList<>();
        List<LocationLevelEntity> levels = new ArrayList<>();
        
        int locationCount = 0;
        String[] binPositions = {"A", "B", "C"};
        
        // Calculate coordinates based on zone position
        // Zone A: Front (x: 0-50), Zone B: Middle-front (x: 50-150), 
        // Zone C: Middle (x: 150-350), Zone D: Back (x: 350-450)
        int baseX = getBaseXForZone(areaCode);
        int baseY = 0;
        
        for (int row = 1; row <= rows; row++) {
            for (int bay = 1; bay <= baysPerRow; bay++) {
                // Calculate accessibility for this rack (varies by row and bay)
                int rackAccessibility = calculateRackAccessibility(
                    areaCode, row, rows, bay, baysPerRow, minAccessibility, maxAccessibility);
                
                for (int level = 1; level <= levelsPerBay; level++) {
                    // Level accessibility: Lower levels = higher accessibility
                    int levelAccessibility = calculateLevelAccessibility(
                        rackAccessibility, level, levelsPerBay);
                    
                    for (int binIdx = 0; binIdx < binsPerLevel && binIdx < binPositions.length; binIdx++) {
                        String binPosition = binPositions[binIdx];
                        
                        // Create location code: AREA-ROW-BAY-LEVEL-POS
                        // Example: C-01-01-1-A
                        String locationCode = String.format("%s-%02d-%02d-%d-%s",
                            areaCode, row, bay, level, binPosition);
                        
                        // Calculate coordinates
                        BigDecimal coordinateX = new BigDecimal(baseX + (row - 1) * 20 + bay * 2);
                        BigDecimal coordinateY = new BigDecimal(baseY + (row - 1) * 15);
                        BigDecimal coordinateZ = new BigDecimal(level * 150); // Height in cm
                        
                        // Create location entity
                        LocationEntity location = new LocationEntity();
                        location.setWarehouseId(warehouseId);
                        location.setLocationCode(locationCode);
                        location.setArea(areaCode);
                        location.setRowNumber(String.format("%02d", row));
                        location.setBayNumber(String.format("%02d", bay));
                        location.setLevelNumber(level);
                        location.setBinPosition(binPosition);
                        location.setLocationType("storage");
                        location.setZoneType("STORAGE");
                        location.setIsActive(true);
                        location.setRackStatus("active");
                        location.setDescription(description);
                        location.setAccessibilityRating(levelAccessibility);
                        location.setCoordinateX(coordinateX);
                        location.setCoordinateY(coordinateY);
                        location.setCoordinateZ(coordinateZ);
                        location.setMaxPalletCapacity(2); // 2 pallets per rack
                        location.setCurrentPalletCount(0);
                        location.setCreatedAt(OffsetDateTime.now());
                        
                        locations.add(location);
                        locationCount++;
                    }
                }
            }
        }
        
        // Save all locations first
        List<LocationEntity> savedLocations = locationRepository.saveAll(locations);
        
        // Group locations by rack (area-row-bay) to create one level entity per level per rack
        // This avoids duplicate level entities for the same rack level
        java.util.Map<String, java.util.Map<Integer, LocationEntity>> rackLevelMap = new java.util.HashMap<>();
        
        for (LocationEntity location : savedLocations) {
            String rackKey = location.getArea() + "-" + location.getRowNumber() + "-" + location.getBayNumber();
            rackLevelMap.putIfAbsent(rackKey, new java.util.HashMap<>());
            // Use first location of each level as representative for level entity
            if (!rackLevelMap.get(rackKey).containsKey(location.getLevelNumber())) {
                rackLevelMap.get(rackKey).put(location.getLevelNumber(), location);
            }
        }
        
        // Create location_levels - one per level per rack
        for (java.util.Map<Integer, LocationEntity> levelMap : rackLevelMap.values()) {
            for (LocationEntity location : levelMap.values()) {
                LocationLevelEntity levelEntity = new LocationLevelEntity();
                levelEntity.setLocationId(location.getId());
                levelEntity.setLevelNumber(location.getLevelNumber());
                
                // Weight capacity based on level (lower levels can hold more)
                BigDecimal weightCapacity = calculateWeightCapacity(location.getLevelNumber());
                levelEntity.setWeightCapacityKg(weightCapacity);
                
                // Pallet capacity: 1 pallet per level
                levelEntity.setPalletCapacity(1);
                
                // Height: 150cm per level
                levelEntity.setHeightCm(new BigDecimal(150));
                
                // Level accessibility (lower levels = higher accessibility)
                levelEntity.setAccessibilityRating(
                    calculateLevelAccessibility(location.getAccessibilityRating(), 
                        location.getLevelNumber(), levelsPerBay));
                
                levelEntity.setCurrentWeightKg(BigDecimal.ZERO);
                levelEntity.setCurrentPalletCount(0);
                levelEntity.setCreatedAt(OffsetDateTime.now());
                levelEntity.setUpdatedAt(OffsetDateTime.now());
                
                levels.add(levelEntity);
            }
        }
        
        // Save all levels
        if (!levels.isEmpty()) {
            locationLevelRepository.saveAll(levels);
        }
        
        System.out.println("  Zone " + areaCode + ": " + locationCount + " locations " +
            "(" + rows + " rows × " + baysPerRow + " bays × " + levelsPerBay + 
            " levels × " + binsPerLevel + " bins)");
        
        return locationCount;
    }

    /**
     * Get base X coordinate for zone (for path finding)
     */
    private int getBaseXForZone(String areaCode) {
        switch (areaCode) {
            case "A": return 0;    // Front
            case "B": return 50;    // Middle-front
            case "C": return 150;   // Middle (main storage)
            case "D": return 350;   // Back
            default: return 150;
        }
    }

    /**
     * Calculate rack accessibility based on zone, row, and bay position
     */
    private int calculateRackAccessibility(
            String areaCode, int row, int totalRows, int bay, int totalBays,
            int minAccess, int maxAccess) {
        
        // Base accessibility from zone
        int baseAccess = (minAccess + maxAccess) / 2;
        
        // Adjust based on position:
        // - Front rows = higher accessibility
        // - Front bays = higher accessibility
        double rowFactor = 1.0 - ((row - 1.0) / totalRows) * 0.3; // Front rows get +30% boost
        double bayFactor = 1.0 - ((bay - 1.0) / totalBays) * 0.2; // Front bays get +20% boost
        
        int accessibility = (int) Math.round(baseAccess * rowFactor * bayFactor);
        
        // Clamp to min-max range
        return Math.max(minAccess, Math.min(maxAccess, accessibility));
    }

    /**
     * Calculate level accessibility (lower levels = higher accessibility)
     */
    private int calculateLevelAccessibility(int rackAccessibility, int level, int totalLevels) {
        // Level 1 (ground) = full accessibility
        // Level 5 (top) = 60% of rack accessibility
        double levelFactor = 1.0 - ((level - 1.0) / totalLevels) * 0.4;
        return (int) Math.round(rackAccessibility * levelFactor);
    }

    /**
     * Calculate weight capacity based on level
     * Lower levels can hold more weight
     */
    private BigDecimal calculateWeightCapacity(int level) {
        // Level 1: 2000kg, Level 2: 1500kg, Level 3: 1000kg, Level 4: 800kg, Level 5: 500kg
        double[] capacities = {2000.0, 1500.0, 1000.0, 800.0, 500.0};
        int index = Math.min(level - 1, capacities.length - 1);
        return new BigDecimal(capacities[index]);
    }
}
