package com.optiwms.integration;

import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationLevelEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.WarehouseRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.util.UUID;

/**
 * Generates synthetic rack data with realistic industry-standard values.
 * 
 * Industry Standards Applied:
 * - Lower levels: Higher weight capacity (2000 kg), higher accessibility (10)
 * - Higher levels: Lower weight capacity (500 kg), lower accessibility (2)
 * - Typical pallet capacity: 1-2 pallets per level
 * - Height per level: 150-200 cm
 */
@Component
@Order(20) // Run after warehouse seeding
@ConditionalOnProperty(name = "optiwms.seed.racks", havingValue = "true", matchIfMissing = false)
public class RackDataSeeder implements CommandLineRunner {

    private final LocationRepository locationRepository;
    private final WarehouseRepository warehouseRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public RackDataSeeder(LocationRepository locationRepository, WarehouseRepository warehouseRepository) {
        this.locationRepository = locationRepository;
        this.warehouseRepository = warehouseRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        var warehouses = warehouseRepository.findAll();
        if (warehouses.isEmpty()) {
            // Silently skip if no warehouses - this is normal during initial setup
            return;
        }

        // Quick check: Do all warehouses already have all required areas?
        boolean allComplete = true;
        var requiredAreas = java.util.Set.of("ST", "RM", "FG", "PK", "PA", "RC", "SH");
        
        for (var warehouse : warehouses) {
            long existingCount = locationRepository.countByWarehouseId(warehouse.getId());
            if (existingCount == 0) {
                allComplete = false;
                break;
            }
            
            var existingLocations = locationRepository.findByWarehouseId(warehouse.getId());
            var existingAreas = existingLocations.stream()
                .map(loc -> loc.getArea())
                .filter(area -> area != null)
                .collect(java.util.stream.Collectors.toSet());
            
            for (String area : requiredAreas) {
                if (!existingAreas.contains(area)) {
                    allComplete = false;
                    break;
                }
            }
            if (!allComplete) break;
        }
        
        // If all warehouses have all required areas, skip silently
        if (allComplete) {
            return;
        }

        // Only print message if we're actually generating data
        System.out.println("Generating synthetic rack data...");

        int totalRacks = 0;
        int totalLocations = 0;
        int totalLevels = 0;
        Set<String> usedLocationCodes = new HashSet<>(
            locationRepository.findAll().stream()
                .map(LocationEntity::getLocationCode)
                .filter(code -> code != null && !code.isBlank())
                .toList()
        );

        for (var warehouse : warehouses) {
            // Check if warehouse already has locations
            long existingCount = locationRepository.countByWarehouseId(warehouse.getId());
            if (existingCount > 0) {
                // Check if all required areas exist
                var existingLocations = locationRepository.findByWarehouseId(warehouse.getId());
                var existingAreas = existingLocations.stream()
                    .map(loc -> loc.getArea())
                    .filter(area -> area != null)
                    .collect(java.util.stream.Collectors.toSet());
                
                var missingAreas = new java.util.ArrayList<String>();
                for (String area : requiredAreas) {
                    if (!existingAreas.contains(area)) {
                        missingAreas.add(area);
                    }
                }
                
                if (missingAreas.isEmpty()) {
                    // Skip silently if complete
                    continue;
                } else {
                    System.out.println("  Warehouse " + warehouse.getName() + " has " + existingCount + " locations but missing areas: " + String.join(", ", missingAreas) + ". Adding missing areas.");
                }
            } else {
                System.out.println("  Generating racks for warehouse: " + warehouse.getName());
            }

            // Get existing areas if warehouse has locations
            var existingAreas = new java.util.HashSet<String>();
            if (existingCount > 0) {
                var existingLocations = locationRepository.findByWarehouseId(warehouse.getId());
                existingAreas = existingLocations.stream()
                    .map(loc -> loc.getArea())
                    .filter(area -> area != null)
                    .collect(java.util.stream.Collectors.toCollection(java.util.HashSet::new));
            }

            // Check if realistic storage zones (A, B, C, D) exist
            boolean hasRealisticZones = existingAreas.contains("A") || 
                                        existingAreas.contains("B") || 
                                        existingAreas.contains("C") || 
                                        existingAreas.contains("D");
            
            // Generate realistic storage zones (A, B, C, D) for ABC/FMS if they don't exist
            if (!hasRealisticZones) {
                // Use realistic generator for ABC/FMS zones
                try {
                    var realisticGenerator = new com.optiwms.integration.RealisticStorageLocationGenerator(
                        locationRepository, 
                        null // Will be injected if needed, or create levels separately
                    );
                    // Note: This will be called via API endpoint instead
                    System.out.println("  Realistic zones (A, B, C, D) should be generated via API endpoint: /api/integration/locations/generate/{warehouseId}");
                } catch (Exception e) {
                    // Fallback to old method if realistic generator not available
                    System.out.println("  Falling back to standard storage area generation");
                }
            }
            
            // Generate racks for different storage areas (only if area doesn't exist)
            // Keep old areas for backward compatibility, but prefer realistic zones
            if (!existingAreas.contains("ST") && !hasRealisticZones) {
                int racks = generateStorageRacks(warehouse.getId(), warehouse.getCode(), "ST", "Storage", 20, 4, usedLocationCodes);
                totalRacks += racks;
                totalLocations += racks * 5 * 3; // 5 levels * 3 bins per level
            }

            if (!existingAreas.contains("RM")) {
                int racks = generateStorageRacks(warehouse.getId(), warehouse.getCode(), "RM", "Raw Materials Storage", 10, 4, usedLocationCodes);
                totalRacks += racks;
                totalLocations += racks * 5 * 3;
            }

            if (!existingAreas.contains("FG")) {
                int racks = generateStorageRacks(warehouse.getId(), warehouse.getCode(), "FG", "Finished Goods Storage", 15, 4, usedLocationCodes);
                totalRacks += racks;
                totalLocations += racks * 5 * 3;
            }

            if (!existingAreas.contains("PK")) {
                int racks = generateStorageRacks(warehouse.getId(), warehouse.getCode(), "PK", "Picking Area", 5, 3, usedLocationCodes);
                totalRacks += racks;
                totalLocations += racks * 3 * 2; // 3 levels * 2 bins
            }

            if (!existingAreas.contains("PA")) {
                int racks = generateStorageRacks(warehouse.getId(), warehouse.getCode(), "PA", "Putaway Area", 5, 3, usedLocationCodes);
                totalRacks += racks;
                totalLocations += racks * 3 * 2; // 3 levels * 2 bins
            }

            if (!existingAreas.contains("RC")) {
                int racks = generateStorageRacks(warehouse.getId(), warehouse.getCode(), "RC", "Reception Area", 3, 2, usedLocationCodes);
                totalRacks += racks;
                totalLocations += racks * 2 * 2; // 2 levels * 2 bins (lower for reception)
            }

            if (!existingAreas.contains("SH")) {
                int racks = generateStorageRacks(warehouse.getId(), warehouse.getCode(), "SH", "Shipping Area", 3, 2, usedLocationCodes);
                totalRacks += racks;
                totalLocations += racks * 2 * 2; // 2 levels * 2 bins (lower for shipping)
            }

            totalLevels += totalRacks * 5; // Average 5 levels per rack
        }

        System.out.println("Generated " + totalRacks + " racks with " + totalLocations + " locations and " + totalLevels + " levels");
    }

    /**
     * Generate racks for a storage area
     * @param warehouseId Warehouse ID
     * @param warehouseCode Warehouse code for location code prefix
     * @param areaCode Area code (ST, RM, FG, PK, etc.)
     * @param areaName Area name for description
     * @param numAisles Number of aisles
     * @param racksPerAisle Number of racks per aisle
     */
    private int generateStorageRacks(
            UUID warehouseId,
            String warehouseCode,
            String areaCode,
            String areaName,
            int numAisles,
            int racksPerAisle,
            Set<String> usedLocationCodes) {
        int rackCount = 0;
        boolean capacityExhausted = false;

        // Industry-standard level capacities (higher level = lower capacity)
        // Level 1 (ground): 2000 kg, 2 pallets, accessibility 10
        // Level 2: 1500 kg, 2 pallets, accessibility 8
        // Level 3: 1000 kg, 2 pallets, accessibility 6
        // Level 4: 800 kg, 1 pallet, accessibility 4
        // Level 5: 500 kg, 1 pallet, accessibility 2
        int[][] levelCapacities = {
            {2000, 2, 10}, // Level 1
            {1500, 2, 8},  // Level 2
            {1000, 2, 6},  // Level 3
            {800, 1, 4},   // Level 4
            {500, 1, 2}    // Level 5
        };

        outer:
        for (int aisle = 1; aisle <= numAisles; aisle++) {
            for (int bay = 1; bay <= racksPerAisle; bay++) {
                // Calculate rack-level accessibility (lower racks = more accessible)
                int rackAccessibility = calculateRackAccessibility(aisle, bay, numAisles, racksPerAisle);
                
                // Calculate total pallet capacity for this rack
                int totalPalletCapacity = 0;
                for (int[] capacity : levelCapacities) {
                    totalPalletCapacity += capacity[1];
                }

                // Generate locations for each level and bin
                List<LocationEntity> rackLocations = new ArrayList<>();
                List<LocationLevelEntity> rackLevels = new ArrayList<>();

                for (int level = 1; level <= 5; level++) {
                    int[] levelSpec = levelCapacities[level - 1];
                    int weightCapacity = levelSpec[0];
                    int palletCapacity = levelSpec[1];
                    int levelAccessibility = levelSpec[2];

                    // Generate bins for this level (typically 1-3 bins per level)
                    int binsPerLevel = level <= 3 ? 3 : 2; // Lower levels have more bins
                    String[] binPositions = {"A", "B", "C"};

                    for (int binIdx = 0; binIdx < binsPerLevel; binIdx++) {
                        LocationEntity location = new LocationEntity();
                        location.setWarehouseId(warehouseId);
                        String locationAreaCode = toLocationAreaCode(areaCode);
                        int locationRow = findNextAvailableRow(
                                usedLocationCodes, locationAreaCode, aisle, bay, level, binPositions[binIdx]
                        );
                        if (locationRow < 0) {
                            capacityExhausted = true;
                            break outer;
                        }
                        // Must match DB constraint chk_location_code_format: AREA-ROW-BAY-LEVEL-POS
                        // Example: C-01-01-1-A
                        String locationCode = String.format(
                                "%s-%02d-%02d-%d-%s",
                                locationAreaCode, locationRow, bay, level, binPositions[binIdx]
                        );
                        location.setLocationCode(locationCode);
                        usedLocationCodes.add(locationCode);
                        location.setArea(areaCode);
                        location.setRowNumber(String.format("%02d", locationRow));
                        location.setBayNumber(String.format("%02d", bay));
                        location.setLevelNumber(level);
                        location.setBinPosition(binPositions[binIdx]);
                        location.setLocationType(getLocationTypeForArea(areaCode));
                        location.setIsActive(true);
                        
                        // Set rack properties (same for all locations in a rack)
                        location.setRackStatus("active");
                        location.setDescription(areaName + " - Aisle " + aisle + ", Bay " + bay);
                        location.setAccessibilityRating(rackAccessibility);
                        location.setMaxPalletCapacity(totalPalletCapacity);
                        location.setCurrentPalletCount(0);
                        
                        // Set coordinates for path finding (grid layout)
                        location.setCoordinateX(new BigDecimal(aisle * 200 + bay * 50));
                        location.setCoordinateY(new BigDecimal(level * 150));

                        rackLocations.add(location);
                    }

                    // Create level capacity record
                    LocationLevelEntity levelEntity = new LocationLevelEntity();
                    levelEntity.setLocationId(null); // Will be set after location is saved
                    levelEntity.setLevelNumber(level);
                    levelEntity.setWeightCapacityKg(new BigDecimal(weightCapacity));
                    levelEntity.setPalletCapacity(palletCapacity);
                    levelEntity.setHeightCm(new BigDecimal(150 + (level - 1) * 20)); // 150-230 cm
                    levelEntity.setAccessibilityRating(levelAccessibility);
                    levelEntity.setCurrentWeightKg(BigDecimal.ZERO);
                    levelEntity.setCurrentPalletCount(0);
                    rackLevels.add(levelEntity);
                }

                // Save all locations for this rack
                for (LocationEntity location : rackLocations) {
                    LocationEntity saved = locationRepository.save(location);
                    
                    // Save level capacity for the first location of each level (representative)
                    if (location.getBinPosition().equals("A")) {
                        LocationLevelEntity levelEntity = rackLevels.get(location.getLevelNumber() - 1);
                        if (levelEntity != null) {
                            levelEntity.setLocationId(saved.getId());
                            entityManager.persist(levelEntity);
                        }
                    }
                }

                rackCount++;
            }
        }

        if (capacityExhausted) {
            System.out.println("  Rack seeding capacity exhausted for area " + areaCode
                    + ". Skipped remaining synthetic racks for this area.");
        }

        return rackCount;
    }

    private int findNextAvailableRow(
            Set<String> usedLocationCodes,
            String areaCode,
            int preferredRow,
            int bay,
            int level,
            String binPosition) {
        int row = preferredRow;
        for (int attempts = 0; attempts < 99; attempts++) {
            String candidate = String.format("%s-%02d-%02d-%d-%s", areaCode, row, bay, level, binPosition);
            if (!usedLocationCodes.contains(candidate)) {
                return row;
            }
            row = (row % 99) + 1;
        }
        return -1;
    }

    /**
     * Maps legacy multi-letter area codes to single-letter location code prefixes
     * required by DB constraint chk_location_code_format.
     *
     * Note: the {@code area} column keeps the manager-facing zone code (e.g. FG).
     * Rack/layout UIs derive rack IDs from area+row+bay; only {@code location_code}
     * uses the canonical single-letter prefix below.
     */
    private String toLocationAreaCode(String areaCode) {
        if (areaCode == null || areaCode.isBlank()) {
            return "C";
        }
        return switch (areaCode.toUpperCase()) {
            case "ST" -> "C"; // Storage
            case "RM" -> "A"; // Raw materials
            case "FG" -> "B"; // Finished goods
            case "PK" -> "D"; // Picking
            case "PA" -> "E"; // Putaway
            case "RC" -> "F"; // Receiving
            case "SH" -> "G"; // Shipping
            default -> {
                String upper = areaCode.toUpperCase();
                yield upper.substring(0, 1);
            }
        };
    }

    /**
     * Calculate rack accessibility based on position
     * Racks closer to entrance (lower aisle/bay numbers) are more accessible
     */
    private int calculateRackAccessibility(int aisle, int bay, int maxAisles, int maxBays) {
        // Normalize to 1-10 scale
        // Closer to entrance (aisle 1, bay 1) = higher accessibility
        double aisleFactor = 1.0 - ((double)(aisle - 1) / maxAisles) * 0.5;
        double bayFactor = 1.0 - ((double)(bay - 1) / maxBays) * 0.3;
        int accessibility = (int) Math.round(5 + (aisleFactor + bayFactor) * 5);
        return Math.max(1, Math.min(10, accessibility));
    }

    /**
     * Get location type based on area code
     */
    private String getLocationTypeForArea(String areaCode) {
        return switch (areaCode) {
            case "ST" -> "storage";
            case "RM" -> "storage_rm";
            case "FG" -> "storage_fg";
            case "PK" -> "picking";
            case "PA" -> "putaway";
            case "RC" -> "reception";
            case "SH" -> "shipping";
            default -> "storage";
        };
    }
}
