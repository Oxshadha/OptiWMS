package com.optiwms.coreapp.operations;

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

    public PutawayCapacityPlanningService(
            InventoryService inventoryService,
            LocationService locationService,
            MaterialService materialService) {
        this.inventoryService = inventoryService;
        this.locationService = locationService;
        this.materialService = materialService;
    }

    public SplitPlanResult suggestSplitPlan(
            UUID warehouseId,
            UUID materialId,
            Integer totalQuantity,
            String preferredLocationCode
    ) {
        if (totalQuantity == null || totalQuantity <= 0) {
            throw new RuntimeException("Quantity must be greater than 0");
        }

        Material inboundMaterial = materialService.findById(materialId);
        List<InventoryItem> warehouseInventory = inventoryService.findByWarehouse(warehouseId);
        Map<String, List<InventoryItem>> inventoryByLocation = warehouseInventory.stream()
                .filter(item -> item.getLocationCode() != null && !item.getLocationCode().isBlank())
                .collect(Collectors.groupingBy(InventoryItem::getLocationCode));

        Map<UUID, Material> materialCache = buildMaterialCache(warehouseInventory, materialId, inboundMaterial);

        List<Location> candidateLocations = locationService.findAvailableByWarehouse(warehouseId).stream()
                .filter(this::isStorageLocation)
                .sorted(locationComparator(preferredLocationCode, materialId, inventoryByLocation))
                .toList();

        int remaining = totalQuantity;
        List<SplitPlanLine> planLines = new ArrayList<>();
        List<String> notes = new ArrayList<>();

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
                    projected
            ));
            remaining -= allocated;
        }

        boolean feasible = remaining == 0;
        if (!feasible) {
            notes.add("Insufficient eligible capacity. Remaining quantity: " + remaining);
            if (inboundMaterial.getWeightKg() == null) {
                notes.add("Material weight_kg is missing; weight-constrained bins may be unusable.");
            }
            if (inboundMaterial.getVolumeCm3() == null) {
                notes.add("Material volume_cm3 is missing; volume-constrained bins may be unusable.");
            }
        }

        return new SplitPlanResult(feasible, totalQuantity, totalQuantity - remaining, remaining, planLines, notes);
    }

    public ValidationResult validateSingleLocation(
            UUID warehouseId,
            UUID materialId,
            Integer quantity,
            String locationCode
    ) {
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
                materialCache
        );

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
            Map<String, List<InventoryItem>> inventoryByLocation
    ) {
        String preferred = preferredLocationCode != null ? preferredLocationCode.trim().toUpperCase(Locale.ROOT) : null;
        return Comparator
                .comparing((Location loc) -> !loc.getLocationCode().equalsIgnoreCase(preferred != null ? preferred : ""))
                .thenComparing((Location loc) -> {
                    List<InventoryItem> inv = inventoryByLocation.getOrDefault(loc.getLocationCode(), List.of());
                    boolean hasMaterial = inv.stream().anyMatch(item -> materialId.equals(item.getMaterialId()));
                    return !hasMaterial;
                })
                .thenComparing(Location::getLocationCode);
    }

    private String allocationReason(
            Location location,
            String preferredLocationCode,
            UUID materialId,
            List<InventoryItem> locationInventory
    ) {
        if (preferredLocationCode != null && location.getLocationCode().equalsIgnoreCase(preferredLocationCode.trim())) {
            return "Preferred location";
        }
        boolean hasMaterial = locationInventory.stream().anyMatch(item -> materialId.equals(item.getMaterialId()));
        if (hasMaterial) {
            return "Same material consolidation";
        }
        return "Best available capacity";
    }

    private CapacityComputation computeCapacity(
            Location location,
            UUID inboundMaterialId,
            Integer desiredQuantity,
            Material inboundMaterial,
            List<InventoryItem> locationInventory,
            Map<UUID, Material> materialCache
    ) {
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
            if (inboundMaterial.getWeightKg() == null || inboundMaterial.getWeightKg().compareTo(BigDecimal.ZERO) <= 0) {
                allocatable = 0;
                missingWeightMetric = true;
            } else {
                BigDecimal remainingWeight = location.getMaxWeightKg().subtract(currentWeight);
                int byWeight = toPositiveIntFloor(remainingWeight.divide(inboundMaterial.getWeightKg(), 8, RoundingMode.FLOOR));
                allocatable = Math.min(allocatable, byWeight);
                blockedByWeight = byWeight <= 0;
            }
        }

        if (location.getMaxVolumeCm3() != null && location.getMaxVolumeCm3().compareTo(BigDecimal.ZERO) > 0) {
            if (inboundMaterial.getVolumeCm3() == null || inboundMaterial.getVolumeCm3().compareTo(BigDecimal.ZERO) <= 0) {
                allocatable = 0;
                missingVolumeMetric = true;
            } else {
                BigDecimal remainingVolume = location.getMaxVolumeCm3().subtract(currentVolume);
                int byVolume = toPositiveIntFloor(remainingVolume.divide(inboundMaterial.getVolumeCm3(), 8, RoundingMode.FLOOR));
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

        if (location.getMaxPalletCapacity() != null && location.getCurrentPalletCount() != null) {
            if (location.getCurrentPalletCount() >= location.getMaxPalletCapacity() && !hasMaterialAlready) {
                allocatable = 0;
                blockedByRackPalletRule = true;
            }
        }

        if (allocatable < desired && !blockedByUnits && location.getCapacity() != null && location.getCapacity().intValue() > 0) {
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
                missingVolumeMetric
        );
    }

    private CapacitySnapshot buildProjectedSnapshot(
            Location location,
            Material inboundMaterial,
            CapacityComputation computation,
            int allocationQty
    ) {
        int projectedQty = computation.currentQuantity() + Math.max(allocationQty, 0);

        BigDecimal projectedWeight = computation.currentWeightKg();
        if (inboundMaterial.getWeightKg() != null) {
            projectedWeight = projectedWeight.add(inboundMaterial.getWeightKg().multiply(BigDecimal.valueOf(Math.max(allocationQty, 0))));
        }

        BigDecimal projectedVolume = computation.currentVolumeCm3();
        if (inboundMaterial.getVolumeCm3() != null) {
            projectedVolume = projectedVolume.add(inboundMaterial.getVolumeCm3().multiply(BigDecimal.valueOf(Math.max(allocationQty, 0))));
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
                fillPercent(projectedLpn, location.getMaxLpnCount())
        );
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

    private Map<UUID, Material> buildMaterialCache(List<InventoryItem> warehouseInventory, UUID inboundMaterialId, Material inboundMaterial) {
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
            boolean missingVolumeMetric
    ) {
    }

    public record SplitPlanResult(
            boolean feasible,
            int requestedQuantity,
            int plannedQuantity,
            int unplannedQuantity,
            List<SplitPlanLine> allocations,
            List<String> notes
    ) {
    }

    public record SplitPlanLine(
            String locationCode,
            int allocatedQuantity,
            String reason,
            CapacitySnapshot projectedAfter
    ) {
    }

    public record ValidationResult(
            boolean valid,
            List<String> violations,
            CapacitySnapshot projectedAfter
    ) {
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
            String lpnFillPercent
    ) {
    }
}
