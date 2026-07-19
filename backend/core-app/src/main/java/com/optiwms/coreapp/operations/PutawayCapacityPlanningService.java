package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.StockPlacementPlanner;
import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Location;
import com.optiwms.domain.master.Material;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PutawayCapacityPlanningService {

    private static final Set<String> BLOCKED_RACK_STATUSES = Set.of("reserved", "maintenance", "out_of_service");

    private final InventoryService inventoryService;
    private final LocationService locationService;
    private final MaterialService materialService;
    private final StockPlacementPlanner stockPlacementPlanner;
    private final HandlingUnitCapacityService handlingUnitCapacityService;

    public PutawayCapacityPlanningService(
            InventoryService inventoryService,
            LocationService locationService,
            MaterialService materialService,
            StockPlacementPlanner stockPlacementPlanner,
            HandlingUnitCapacityService handlingUnitCapacityService) {
        this.inventoryService = inventoryService;
        this.locationService = locationService;
        this.materialService = materialService;
        this.stockPlacementPlanner = stockPlacementPlanner;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
    }

    public SplitPlanResult suggestSplitPlan(
            UUID warehouseId,
            UUID materialId,
            Integer totalQuantity,
            String preferredLocationCode) {
        if (totalQuantity == null || totalQuantity <= 0) {
            throw new RuntimeException("Quantity must be greater than 0");
        }

        Material inboundMaterial = materialService.findById(materialId);
        BigDecimal unitsPerPalletEarly = inboundMaterial.getUnitsPerPallet() != null
                ? BigDecimal.valueOf(inboundMaterial.getUnitsPerPallet()) : null;
        if (unitsPerPalletEarly != null && unitsPerPalletEarly.compareTo(BigDecimal.ZERO) > 0) {
            StockPlacementPlanner.PlacementPlan placementPlan = stockPlacementPlanner.planPlacement(
                    warehouseId,
                    materialId,
                    totalQuantity,
                    preferredLocationCode,
                    Set.of());
            if (!placementPlan.lines().isEmpty()) {
                List<SplitPlanLine> planLines = placementPlan.lines().stream()
                        .map(line -> new SplitPlanLine(
                                line.locationCode(),
                                line.quantityAllocated(),
                                "Pallet slot " + line.palletCount() + " on rack " + line.rackId(),
                                null))
                        .toList();
                int allocated = planLines.stream().mapToInt(SplitPlanLine::allocatedQuantity).sum();
                return new SplitPlanResult(
                        placementPlan.remainingPallets() <= 0,
                        totalQuantity,
                        allocated,
                        totalQuantity - allocated,
                        placementPlan.requiredPallets(),
                        placementPlan.assignedPallets(),
                        unitsPerPalletEarly.stripTrailingZeros().toPlainString(),
                        planLines,
                        placementPlan.notes());
            }
        }

        List<InventoryItem> warehouseInventory = inventoryService.findByWarehouse(warehouseId);
        Map<String, List<InventoryItem>> inventoryByLocation = warehouseInventory.stream()
                .filter(item -> item.getLocationCode() != null && !item.getLocationCode().isBlank())
                .collect(Collectors.groupingBy(InventoryItem::getLocationCode));

        Map<UUID, Material> materialCache = buildMaterialCache(warehouseInventory, materialId, inboundMaterial);

        List<Location> candidateLocations = locationService.findAvailableByWarehouse(warehouseId).stream()
                .filter(loc -> loc.getLocationCode() != null && !loc.getLocationCode().isBlank())
                .filter(this::isStorageLocation)
                .sorted(locationComparator(preferredLocationCode, materialId, inventoryByLocation))
                .toList();

        List<String> notes = new ArrayList<>();
        Integer requiredPalletSlots = null;
        Integer availablePalletSlots = null;
        BigDecimal unitsPerPallet = inboundMaterial.getUnitsPerPallet() != null
                ? BigDecimal.valueOf(inboundMaterial.getUnitsPerPallet()) : null;
        if (unitsPerPallet != null && unitsPerPallet.compareTo(BigDecimal.ZERO) > 0) {
            requiredPalletSlots = toPositiveIntCeil(
                    BigDecimal.valueOf(totalQuantity).divide(unitsPerPallet, 8, RoundingMode.CEILING));
            availablePalletSlots = candidateLocations.stream()
                    .mapToInt(loc -> {
                        Integer max = loc.getMaxPalletCapacity();
                        Integer current = loc.getCurrentPalletCount();
                        if (max == null || max <= 0)
                            return 0;
                        return Math.max(max - (current != null ? current : 0), 0);
                    })
                    .sum();
            notesForPalletModel(notes, requiredPalletSlots, availablePalletSlots, unitsPerPallet);
        }

        int remaining = totalQuantity;
        List<SplitPlanLine> planLines = new ArrayList<>();

        for (Location location : candidateLocations) {
            if (remaining <= 0) {
                break;
            }

            CapacityComputation computation = computeCapacity(location, materialId, remaining, inboundMaterial,
                    inventoryByLocation.getOrDefault(location.getLocationCode(), List.of()), materialCache);

            if (computation.allocatableQuantity() <= 0) {
                continue;
            }

            int allocated = Math.min(remaining, computation.allocatableQuantity());
            CapacitySnapshot projected = buildProjectedSnapshot(location, inboundMaterial, computation, allocated);

            planLines.add(new SplitPlanLine(
                    location.getLocationCode(),
                    allocated,
                    allocationReason(location, preferredLocationCode, materialId,
                            inventoryByLocation.getOrDefault(location.getLocationCode(), List.of())),
                    projected));
            remaining -= allocated;
        }

        boolean feasible = remaining == 0;
        if (requiredPalletSlots != null && availablePalletSlots != null && availablePalletSlots < requiredPalletSlots) {
            feasible = false;
        }
        if (!feasible) {
            notes.add("Insufficient eligible capacity. Remaining quantity: " + remaining);
            if (inboundMaterial.getWeightKg() == null) {
                notes.add("Material weight_kg is missing; weight-constrained bins may be unusable.");
            }
            if (inboundMaterial.getVolumeCm3() == null) {
                notes.add("Material volume_cm3 is missing; volume-constrained bins may be unusable.");
            }
        }

        return new SplitPlanResult(
                feasible,
                totalQuantity,
                totalQuantity - remaining,
                remaining,
                requiredPalletSlots,
                availablePalletSlots,
                toString(unitsPerPallet),
                planLines,
                notes);
    }

    public BatchSplitPlanResult suggestBatchSplitPlan(UUID warehouseId, List<SplitPlanRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return new BatchSplitPlanResult(List.of(), List.of("No inbound items were provided for capacity review."));
        }
        List<BatchSplitPlanLine> results = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        int index = 0;
        for (SplitPlanRequest request : requests) {
            int itemIndex = request.itemIndex() != null ? request.itemIndex() : index;
            try {
                if (request.materialId() == null) {
                    throw new RuntimeException("Material is required");
                }
                SplitPlanResult plan = suggestSplitPlan(
                        warehouseId,
                        request.materialId(),
                        request.quantity(),
                        request.preferredLocationCode());
                results.add(new BatchSplitPlanLine(itemIndex, true, null, plan));
            } catch (RuntimeException ex) {
                SplitPlanResult failed = new SplitPlanResult(
                        false,
                        request.quantity() != null ? request.quantity() : 0,
                        0,
                        request.quantity() != null ? request.quantity() : 0,
                        null,
                        null,
                        null,
                        List.of(),
                        List.of(ex.getMessage()));
                results.add(new BatchSplitPlanLine(itemIndex, false, ex.getMessage(), failed));
            }
            index++;
        }
        return new BatchSplitPlanResult(results, notes);
    }

    public ValidationResult validateSingleLocation(
            UUID warehouseId,
            UUID materialId,
            Integer quantity,
            String locationCode) {
        if (quantity == null || quantity <= 0) {
            throw new RuntimeException("Invalid putaway quantity");
        }

        Location location = locationService.findByLocationCodeOptional(locationCode)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationCode));

        if (!warehouseId.equals(location.getWarehouseId())) {
            throw new RuntimeException("Location does not belong to warehouse: " + warehouseId);
        }

        if (!Boolean.TRUE.equals(location.getIsActive())) {
            throw new RuntimeException("Location is not active: " + locationCode);
        }

        if (!isRackStatusPutawayAllowed(location.getRackStatus())) {
            throw new RuntimeException("Location is not available for putaway due to rack status '"
                    + normalizeRackStatus(location.getRackStatus()) + "': " + locationCode);
        }

        Material inboundMaterial = materialService.findById(materialId);
        List<InventoryItem> warehouseInventory = inventoryService.findByWarehouse(warehouseId);
        Map<UUID, Material> materialCache = buildMaterialCache(warehouseInventory, materialId, inboundMaterial);
        List<InventoryItem> locationInventory = warehouseInventory.stream()
                .filter(item -> locationCode.equals(item.getLocationCode()))
                .toList();

        CapacityComputation computation = computeCapacity(
                location,
                materialId,
                quantity,
                inboundMaterial,
                locationInventory,
                materialCache);

        List<String> violations = new ArrayList<>();
        if (computation.blockedByRackPalletRule()) {
            violations.add("Location pallet capacity reached for " + locationCode);
        }
        if (computation.blockedByUnits()) {
            violations.add("Quantity capacity exceeded for " + locationCode);
        }
        if (computation.blockedByWeight()) {
            violations.add("Weight capacity exceeded for " + locationCode);
        }
        if (computation.blockedByVolume()) {
            violations.add("Volume capacity exceeded for " + locationCode);
        }
        if (computation.blockedByLpn()) {
            violations.add("LPN capacity exceeded for " + locationCode);
        }
        if (computation.missingWeightMetric()) {
            violations.add("Missing material weight_kg for weight-constrained location " + locationCode);
        }
        if (computation.missingVolumeMetric()) {
            violations.add("Missing material volume_cm3 for volume-constrained location " + locationCode);
        }

        boolean valid = violations.isEmpty() && computation.allocatableQuantity() >= quantity;
        CapacitySnapshot projected = buildProjectedSnapshot(location, inboundMaterial, computation, quantity);

        return new ValidationResult(valid, violations, projected);
    }

    private Comparator<Location> locationComparator(
            String preferredLocationCode,
            UUID materialId,
            Map<String, List<InventoryItem>> inventoryByLocation) {
        String preferred = preferredLocationCode != null ? preferredLocationCode.trim().toUpperCase(Locale.ROOT) : null;
        return Comparator
                .comparing((Location loc) -> !sameLocationCode(loc.getLocationCode(), preferred))
                .thenComparing((Location loc) -> {
                    List<InventoryItem> inv = inventoryByLocation.getOrDefault(loc.getLocationCode(), List.of());
                    boolean hasMaterial = inv.stream().anyMatch(item -> materialId.equals(item.getMaterialId()));
                    return !hasMaterial;
                })
                .thenComparing((Location loc) -> {
                    List<InventoryItem> inv = inventoryByLocation.getOrDefault(loc.getLocationCode(), List.of());
                    boolean hasMaterial = inv.stream().anyMatch(item -> materialId.equals(item.getMaterialId()));
                    int level = loc.getLevelNumber() != null ? loc.getLevelNumber() : 0;
                    // Consolidation prefers easy-access lower levels; overflow prefers
                    // deeper/higher levels.
                    return hasMaterial ? level : -level;
                })
                .thenComparing(Location::getLocationCode);
    }

    private String allocationReason(
            Location location,
            String preferredLocationCode,
            UUID materialId,
            List<InventoryItem> locationInventory) {
        if (sameLocationCode(location.getLocationCode(), preferredLocationCode)) {
            return "Preferred location";
        }
        boolean hasMaterial = locationInventory.stream().anyMatch(item -> materialId.equals(item.getMaterialId()));
        if (hasMaterial) {
            return "Same material consolidation";
        }
        if (location.getLevelNumber() != null && location.getLevelNumber() > 1) {
            return "Overflow placement (higher level)";
        }
        return "Best available capacity";
    }

    private boolean sameLocationCode(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }

    private CapacityComputation computeCapacity(
            Location location,
            UUID inboundMaterialId,
            Integer desiredQuantity,
            Material inboundMaterial,
            List<InventoryItem> locationInventory,
            Map<UUID, Material> materialCache) {
        int currentQty = locationInventory.stream().mapToInt(item -> nvl(item.getQuantity())).sum();
        int desired = Math.max(desiredQuantity, 0);
        int allocatable = desired;

        boolean blockedByUnits = false;
        boolean blockedByWeight = false;
        boolean blockedByVolume = false;
        boolean blockedByLpn = false;
        boolean blockedByRackPalletRule = false;
        boolean missingWeightMetric = false;
        boolean missingVolumeMetric = false;

        if (location.getCapacity() != null && location.getCapacity().intValue() > 0) {
            int unitsHeadroom = Math.max(location.getCapacity().intValue() - currentQty, 0);
            allocatable = Math.min(allocatable, unitsHeadroom);
            blockedByUnits = unitsHeadroom <= 0;
        }

        BigDecimal currentWeight = BigDecimal.ZERO;
        BigDecimal currentVolume = BigDecimal.ZERO;
        for (InventoryItem item : locationInventory) {
            Material existingMaterial = materialCache.get(item.getMaterialId());
            if (existingMaterial == null) {
                continue;
            }
            int qty = nvl(item.getQuantity());
            if (existingMaterial.getWeightKg() != null) {
                currentWeight = currentWeight.add(existingMaterial.getWeightKg().multiply(BigDecimal.valueOf(qty)));
            }
            if (existingMaterial.getVolumeCm3() != null) {
                currentVolume = currentVolume.add(existingMaterial.getVolumeCm3().multiply(BigDecimal.valueOf(qty)));
            }
        }

        if (location.getMaxWeightKg() != null && location.getMaxWeightKg().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal palletWeight = handlingUnitCapacityService.resolvePalletWeightKg(
                    inboundMaterial.getWeightKg(),
                    inboundMaterial.getPalletSpaces(),
                    inboundMaterial.getMaxPalletWeightKg());
            if (currentQty == 0 && palletWeight.compareTo(BigDecimal.ZERO) > 0
                    && palletWeight.compareTo(location.getMaxWeightKg()) > 0) {
                allocatable = 0;
                blockedByWeight = true;
            } else if (inboundMaterial.getWeightKg() == null
                    || inboundMaterial.getWeightKg().compareTo(BigDecimal.ZERO) <= 0) {
                allocatable = 0;
                missingWeightMetric = true;
            } else {
                BigDecimal remainingWeight = location.getMaxWeightKg().subtract(currentWeight);
                int byWeight = toPositiveIntFloor(
                        remainingWeight.divide(inboundMaterial.getWeightKg(), 8, RoundingMode.FLOOR));
                allocatable = Math.min(allocatable, byWeight);
                blockedByWeight = byWeight <= 0;
            }
        }

        if (location.getMaxVolumeCm3() != null && location.getMaxVolumeCm3().compareTo(BigDecimal.ZERO) > 0) {
            if (inboundMaterial.getVolumeCm3() == null
                    || inboundMaterial.getVolumeCm3().compareTo(BigDecimal.ZERO) <= 0) {
                allocatable = 0;
                missingVolumeMetric = true;
            } else {
                BigDecimal remainingVolume = location.getMaxVolumeCm3().subtract(currentVolume);
                int byVolume = toPositiveIntFloor(
                        remainingVolume.divide(inboundMaterial.getVolumeCm3(), 8, RoundingMode.FLOOR));
                allocatable = Math.min(allocatable, byVolume);
                blockedByVolume = byVolume <= 0;
            }
        }

        long currentLpnCount = locationInventory.stream()
                .map(InventoryItem::getLpnCode)
                .filter(code -> code != null && !code.isBlank())
                .distinct()
                .count();

        boolean hasMaterialAlready = locationInventory.stream()
                .anyMatch(item -> inboundMaterialId.equals(item.getMaterialId()));

        if (location.getMaxLpnCount() != null && location.getMaxLpnCount() > 0) {
            int incomingLpn = hasMaterialAlready ? 0 : 1;
            if (currentLpnCount + incomingLpn > location.getMaxLpnCount()) {
                allocatable = 0;
                blockedByLpn = true;
            }
        }

        if (location.getMaxPalletCapacity() != null && location.getMaxPalletCapacity() > 0
                && inboundMaterial.getPalletSpaces() != null
                && inboundMaterial.getPalletSpaces().compareTo(BigDecimal.ZERO) > 0) {
            int currentPalletCount = location.getCurrentPalletCount() != null ? location.getCurrentPalletCount() : 0;
            int slotHeadroom = Math.max(location.getMaxPalletCapacity() - currentPalletCount, 0);
            int byPalletSlots = toPositiveIntFloor(
                    BigDecimal.valueOf(slotHeadroom).multiply(inboundMaterial.getPalletSpaces()));
            allocatable = Math.min(allocatable, byPalletSlots);
            if (byPalletSlots <= 0) {
                allocatable = 0;
                blockedByRackPalletRule = true;
            }
        }

        if (allocatable < desired && !blockedByUnits && location.getCapacity() != null
                && location.getCapacity().intValue() > 0) {
            blockedByUnits = true;
        }

        return new CapacityComputation(
                Math.max(allocatable, 0),
                currentQty,
                currentWeight,
                currentVolume,
                (int) currentLpnCount,
                blockedByUnits,
                blockedByWeight,
                blockedByVolume,
                blockedByLpn,
                blockedByRackPalletRule,
                missingWeightMetric,
                missingVolumeMetric);
    }

    private CapacitySnapshot buildProjectedSnapshot(
            Location location,
            Material inboundMaterial,
            CapacityComputation computation,
            int allocationQty) {
        int projectedQty = computation.currentQuantity() + Math.max(allocationQty, 0);

        BigDecimal projectedWeight = computation.currentWeightKg();
        if (inboundMaterial.getWeightKg() != null) {
            projectedWeight = projectedWeight
                    .add(inboundMaterial.getWeightKg().multiply(BigDecimal.valueOf(Math.max(allocationQty, 0))));
        }

        BigDecimal projectedVolume = computation.currentVolumeCm3();
        if (inboundMaterial.getVolumeCm3() != null) {
            projectedVolume = projectedVolume
                    .add(inboundMaterial.getVolumeCm3().multiply(BigDecimal.valueOf(Math.max(allocationQty, 0))));
        }

        int projectedLpn = computation.currentLpnCount();
        if (allocationQty > 0 && location.getMaxLpnCount() != null && location.getMaxLpnCount() > 0) {
            projectedLpn = Math.min(projectedLpn + 1, Integer.MAX_VALUE);
        }

        return new CapacitySnapshot(
                projectedQty,
                location.getCapacity() != null ? location.getCapacity().intValue() : null,
                fillPercent(projectedQty, location.getCapacity() != null ? location.getCapacity().intValue() : null),
                toString(projectedWeight),
                toString(location.getMaxWeightKg()),
                fillPercent(projectedWeight, location.getMaxWeightKg()),
                toString(projectedVolume),
                toString(location.getMaxVolumeCm3()),
                fillPercent(projectedVolume, location.getMaxVolumeCm3()),
                projectedLpn,
                location.getMaxLpnCount(),
                fillPercent(projectedLpn, location.getMaxLpnCount()));
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

    private boolean isRackStatusPutawayAllowed(String rackStatus) {
        return !BLOCKED_RACK_STATUSES.contains(normalizeRackStatus(rackStatus));
    }

    private boolean isStorageLocation(Location loc) {
        String zoneType = loc.getZoneType();
        String locType = loc.getLocationType();
        return "STORAGE".equals(zoneType) || "storage".equals(locType);
    }

    private Map<UUID, Material> buildMaterialCache(List<InventoryItem> warehouseInventory, UUID inboundMaterialId,
            Material inboundMaterial) {
        Map<UUID, Material> cache = new HashMap<>();
        cache.put(inboundMaterialId, inboundMaterial);

        Set<UUID> needed = warehouseInventory.stream()
                .map(InventoryItem::getMaterialId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        for (UUID materialId : needed) {
            if (cache.containsKey(materialId)) {
                continue;
            }
            try {
                cache.put(materialId, materialService.findById(materialId));
            } catch (RuntimeException ignored) {
                // Keep unresolved materials out of strict metric aggregation.
            }
        }
        return cache;
    }

    private int nvl(Integer value) {
        return value != null ? value : 0;
    }

    private int toPositiveIntFloor(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return value.setScale(0, RoundingMode.FLOOR).intValue();
    }

    private int toPositiveIntCeil(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return value.setScale(0, RoundingMode.CEILING).intValue();
    }

    private void notesForPalletModel(List<String> notes, Integer requiredPalletSlots, Integer availablePalletSlots,
            BigDecimal unitsPerPallet) {
        if (requiredPalletSlots == null || availablePalletSlots == null || unitsPerPallet == null) {
            return;
        }
        notes.add("Handling model: " + unitsPerPallet.stripTrailingZeros().toPlainString() + " units per pallet slot.");
        notes.add("Required pallet slots: " + requiredPalletSlots + ", available pallet slots: " + availablePalletSlots
                + ".");
    }

    private String fillPercent(Integer used, Integer max) {
        if (max == null || max <= 0) {
            return null;
        }
        BigDecimal pct = BigDecimal.valueOf(used)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(max), 1, RoundingMode.HALF_UP);
        return pct.toPlainString();
    }

    private String fillPercent(BigDecimal used, BigDecimal max) {
        if (max == null || max.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        BigDecimal pct = used
                .multiply(BigDecimal.valueOf(100))
                .divide(max, 1, RoundingMode.HALF_UP);
        return pct.toPlainString();
    }

    private String toString(BigDecimal value) {
        return value != null ? value.setScale(2, RoundingMode.HALF_UP).toPlainString() : null;
    }

    private record CapacityComputation(
            int allocatableQuantity,
            int currentQuantity,
            BigDecimal currentWeightKg,
            BigDecimal currentVolumeCm3,
            int currentLpnCount,
            boolean blockedByUnits,
            boolean blockedByWeight,
            boolean blockedByVolume,
            boolean blockedByLpn,
            boolean blockedByRackPalletRule,
            boolean missingWeightMetric,
            boolean missingVolumeMetric) {
    }

    public record SplitPlanResult(
            boolean feasible,
            int requestedQuantity,
            int plannedQuantity,
            int unplannedQuantity,
            Integer requiredPalletSlots,
            Integer availablePalletSlots,
            String unitsPerPallet,
            List<SplitPlanLine> allocations,
            List<String> notes) {
    }

    public record SplitPlanLine(
            String locationCode,
            int allocatedQuantity,
            String reason,
            CapacitySnapshot projectedAfter) {
    }

    public record SplitPlanRequest(
            Integer itemIndex,
            UUID materialId,
            Integer quantity,
            String preferredLocationCode) {
    }

    public record BatchSplitPlanResult(
            List<BatchSplitPlanLine> items,
            List<String> notes) {
    }

    public record BatchSplitPlanLine(
            int itemIndex,
            boolean success,
            String error,
            SplitPlanResult plan) {
    }

    public record ValidationResult(
            boolean valid,
            List<String> violations,
            CapacitySnapshot projectedAfter) {
    }

    public record CapacitySnapshot(
            Integer quantityUsed,
            Integer quantityCapacity,
            String quantityFillPercent,
            String weightUsedKg,
            String weightCapacityKg,
            String weightFillPercent,
            String volumeUsedCm3,
            String volumeCapacityCm3,
            String volumeFillPercent,
            Integer lpnUsed,
            Integer lpnCapacity,
            String lpnFillPercent) {
    }
}
