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

    /**
     * Bounds the replan loop that drops planner-offered bins putaway would refuse. Each pass
     * excludes strictly more bins, so this only caps how far a badly mismatched warehouse is
     * chased before falling back to the generic search.
     */
    private static final int MAX_PLACEMENT_VERIFICATION_ATTEMPTS = 5;

    private final InventoryService inventoryService;
    private final LocationService locationService;
    private final MaterialService materialService;
    private final StockPlacementPlanner stockPlacementPlanner;
    private final HandlingUnitCapacityService handlingUnitCapacityService;
    private final PutawayReservationService reservationService;

    public PutawayCapacityPlanningService(
            InventoryService inventoryService,
            LocationService locationService,
            MaterialService materialService,
            StockPlacementPlanner stockPlacementPlanner,
            HandlingUnitCapacityService handlingUnitCapacityService,
            PutawayReservationService reservationService) {
        this.inventoryService = inventoryService;
        this.locationService = locationService;
        this.materialService = materialService;
        this.stockPlacementPlanner = stockPlacementPlanner;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
        this.reservationService = reservationService;
    }

    public SplitPlanResult suggestSplitPlan(
            UUID warehouseId,
            UUID materialId,
            Integer totalQuantity,
            String preferredLocationCode) {
        return suggestSplitPlan(warehouseId, materialId, totalQuantity, preferredLocationCode, Map.of());
    }

    /**
     * @param additionalReserved pallet slots claimed earlier in the same planning run but not yet
     *                           persisted -- how a batch keeps its own lines from colliding.
     */
    private SplitPlanResult suggestSplitPlan(
            UUID warehouseId,
            UUID materialId,
            Integer totalQuantity,
            String preferredLocationCode,
            Map<String, Integer> additionalReserved) {
        if (totalQuantity == null || totalQuantity <= 0) {
            throw new RuntimeException("Quantity must be greater than 0");
        }

        Material inboundMaterial = materialService.findById(materialId);

        List<InventoryItem> warehouseInventory = inventoryService.findByWarehouse(warehouseId);
        Map<String, List<InventoryItem>> inventoryByLocation = warehouseInventory.stream()
                .filter(item -> item.getLocationCode() != null && !item.getLocationCode().isBlank())
                .collect(Collectors.groupingBy(InventoryItem::getLocationCode));

        Map<UUID, Material> materialCache = buildMaterialCache(warehouseInventory, materialId, inboundMaterial);

        // Space already promised to other inbound work: persisted claims plus anything claimed
        // earlier in this same planning run. Read once for the whole plan so a bin another line has
        // taken is not offered again here.
        Map<String, Integer> reservedByLocation =
                new HashMap<>(reservationService.reservedPalletsByLocation(warehouseId));
        additionalReserved.forEach((code, pallets) ->
                reservedByLocation.merge(code.trim().toUpperCase(Locale.ROOT), pallets, Integer::sum));

        BigDecimal unitsPerPalletEarly = inboundMaterial.getUnitsPerPallet() != null
                ? BigDecimal.valueOf(inboundMaterial.getUnitsPerPallet()) : null;
        if (unitsPerPalletEarly != null && unitsPerPalletEarly.compareTo(BigDecimal.ZERO) > 0) {
            SplitPlanResult palletPlan = planViaPlacementPlanner(
                    warehouseId,
                    materialId,
                    totalQuantity,
                    preferredLocationCode,
                    inboundMaterial,
                    unitsPerPalletEarly,
                    inventoryByLocation,
                    materialCache,
                    reservedByLocation);
            if (palletPlan != null) {
                return palletPlan;
            }
        }

        List<Location> candidateLocations = locationService.findAvailableByWarehouse(warehouseId).stream()
                .filter(loc -> loc.getLocationCode() != null && !loc.getLocationCode().isBlank())
                .filter(this::isStorageLocation)
                .sorted(locationComparator(
                        preferredLocationCode,
                        materialId,
                        inboundMaterial.getFmsClass(),
                        inventoryByLocation))
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
                        if (max == null || max <= 0)
                            return 0;
                        int current = occupiedPallets(
                                inventoryByLocation.getOrDefault(loc.getLocationCode(), List.of()),
                                materialCache)
                                + reservedPalletsAt(reservedByLocation, loc.getLocationCode());
                        return Math.max(max - current, 0);
                    })
                    .sum();
            notesForPalletModel(notes, requiredPalletSlots, availablePalletSlots, unitsPerPallet);
        }

        int remaining = totalQuantity;
        List<SplitPlanLine> planLines = new ArrayList<>();
        // Why bins were passed over, so an infeasible plan can name the binding constraint
        // instead of reporting "insufficient capacity" beside a healthy free-slot count.
        Map<String, Integer> rejections = new LinkedHashMap<>();

        for (Location location : candidateLocations) {
            if (remaining <= 0) {
                break;
            }

            CapacityComputation computation = computeCapacity(location, materialId, remaining, inboundMaterial,
                    inventoryByLocation.getOrDefault(location.getLocationCode(), List.of()), materialCache,
                    reservedPalletsAt(reservedByLocation, location.getLocationCode()));

            if (computation.allocatableQuantity() <= 0) {
                recordRejection(rejections, computation);
                continue;
            }

            int allocated = palletAlign(
                    Math.min(remaining, computation.allocatableQuantity()), remaining, unitsPerPallet);
            if (allocated <= 0) {
                recordRejection(rejections, computation);
                continue;
            }
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
            notes.add("Could not place " + remaining + " of " + totalQuantity + " units across "
                    + candidateLocations.size() + " eligible bin(s).");
            if (!rejections.isEmpty()) {
                notes.add("Bins were refused by: " + rejections.entrySet().stream()
                        .map(entry -> entry.getKey() + " (" + entry.getValue() + ")")
                        .collect(Collectors.joining(", ")) + ".");
            }
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

    /**
     * Runs the pallet-model planner and returns its plan only once every bin in it passes the same
     * capacity rules putaway will apply at the bin face. Returns null when this model cannot produce
     * a verified plan, so the caller falls through to the generic unit-capacity search.
     *
     * <p>The planner and this service historically checked overlapping but unequal rule sets: the
     * planner weighed a single pallet against the bin and the rack beam, while putaway weighed
     * cumulative units, weight, volume, LPN count and missing material metrics. Neither was a
     * superset, so the planner could hand a worker a bin that putaway then refused. Rather than keep
     * two rule sets in step by hand, every candidate the planner proposes is checked here through
     * {@link #computeCapacity} -- the same code putaway runs -- and any bin that fails is fed back
     * as an exclusion so the planner picks another. What leaves this method is therefore acceptable
     * to putaway by construction.
     *
     * <p>Each bin receives at most one pallet per plan, so bins can be verified independently.
     */
    private SplitPlanResult planViaPlacementPlanner(
            UUID warehouseId,
            UUID materialId,
            int totalQuantity,
            String preferredLocationCode,
            Material inboundMaterial,
            BigDecimal unitsPerPallet,
            Map<String, List<InventoryItem>> inventoryByLocation,
            Map<UUID, Material> materialCache,
            Map<String, Integer> reservedByLocation) {

        Set<String> rejectedBins = new HashSet<>();
        // Bins already claimed by other inbound work are excluded up front so the planner never
        // proposes space that is spoken for. The planner's exclusion set is all-or-nothing per bin,
        // which is exact here because every storage bin holds one pallet (BinOccupancyService pins
        // max_pallet_capacity to 1); if bins ever hold more, this would need per-bin headroom
        // rather than an exclusion.
        reservedByLocation.forEach((code, pallets) -> {
            if (pallets > 0) {
                rejectedBins.add(code);
            }
        });

        for (int attempt = 0; attempt < MAX_PLACEMENT_VERIFICATION_ATTEMPTS; attempt++) {
            StockPlacementPlanner.PlacementPlan placementPlan = stockPlacementPlanner.planPlacement(
                    warehouseId,
                    materialId,
                    totalQuantity,
                    preferredLocationCode,
                    Set.copyOf(rejectedBins));

            if (placementPlan.lines().isEmpty()) {
                return null;
            }

            List<String> failingBins = new ArrayList<>();
            for (StockPlacementPlanner.PlacementLine line : placementPlan.lines()) {
                if (!acceptableAtBinFace(line, warehouseId, materialId, inboundMaterial,
                        inventoryByLocation, materialCache)) {
                    failingBins.add(line.locationCode());
                }
            }

            if (failingBins.isEmpty()) {
                return toSplitPlanResult(placementPlan, totalQuantity, unitsPerPallet, rejectedBins);
            }

            // No progress is possible if the planner keeps returning bins already known to fail.
            if (!rejectedBins.addAll(failingBins)) {
                return null;
            }
        }
        return null;
    }

    /** True when putaway's own capacity rules would accept this pallet at this bin. */
    private boolean acceptableAtBinFace(
            StockPlacementPlanner.PlacementLine line,
            UUID warehouseId,
            UUID materialId,
            Material inboundMaterial,
            Map<String, List<InventoryItem>> inventoryByLocation,
            Map<UUID, Material> materialCache) {
        Location location = locationService.findByLocationCodeOptional(line.locationCode()).orElse(null);
        if (location == null
                || !warehouseId.equals(location.getWarehouseId())
                || !Boolean.TRUE.equals(location.getIsActive())
                || !isRackStatusPutawayAllowed(location.getRackStatus())) {
            return false;
        }

        CapacityComputation computation = computeCapacity(
                location,
                materialId,
                line.quantityAllocated(),
                inboundMaterial,
                inventoryByLocation.getOrDefault(line.locationCode(), List.of()),
                materialCache);

        return computation.allocatableQuantity() >= line.quantityAllocated()
                && !computation.missingWeightMetric()
                && !computation.missingVolumeMetric();
    }

    private SplitPlanResult toSplitPlanResult(
            StockPlacementPlanner.PlacementPlan placementPlan,
            int totalQuantity,
            BigDecimal unitsPerPallet,
            Set<String> rejectedBins) {
        List<SplitPlanLine> planLines = placementPlan.lines().stream()
                .map(line -> new SplitPlanLine(
                        line.locationCode(),
                        line.quantityAllocated(),
                        "Pallet slot " + line.palletCount() + " on rack " + line.rackId(),
                        null))
                .toList();
        int allocated = planLines.stream().mapToInt(SplitPlanLine::allocatedQuantity).sum();

        List<String> notes = new ArrayList<>(placementPlan.notes());
        if (!rejectedBins.isEmpty()) {
            notes.add("Skipped " + rejectedBins.size()
                    + " bin(s) that the planner offered but putaway would have refused.");
        }

        return new SplitPlanResult(
                placementPlan.remainingPallets() <= 0,
                totalQuantity,
                allocated,
                totalQuantity - allocated,
                placementPlan.requiredPallets(),
                placementPlan.assignedPallets(),
                unitsPerPallet.stripTrailingZeros().toPlainString(),
                planLines,
                notes);
    }

    public BatchSplitPlanResult suggestBatchSplitPlan(UUID warehouseId, List<SplitPlanRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return new BatchSplitPlanResult(List.of(), List.of("No inbound items were provided for capacity review."));
        }
        List<BatchSplitPlanLine> results = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        // Bins consumed by earlier lines of this same batch. Without this every line was planned
        // against identical warehouse state, so two lines of one order were told the same bin was
        // free and only the first worker to arrive could use it.
        Map<String, Integer> claimedInThisBatch = new HashMap<>();
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
                        request.preferredLocationCode(),
                        Map.copyOf(claimedInThisBatch));
                recordBatchClaims(claimedInThisBatch, plan);
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

    /**
     * Marks the bins a just-planned line took, so later lines in the same batch see them as full.
     * Each planner allocation is one pallet into one bin.
     */
    private void recordBatchClaims(Map<String, Integer> claimed, SplitPlanResult plan) {
        for (SplitPlanLine line : plan.allocations()) {
            if (line.locationCode() == null) {
                continue;
            }
            claimed.merge(line.locationCode().trim().toUpperCase(Locale.ROOT), 1, Integer::sum);
        }
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
            String materialFmsClass,
            Map<String, List<InventoryItem>> inventoryByLocation) {
        String preferred = preferredLocationCode != null ? preferredLocationCode.trim().toUpperCase(Locale.ROOT) : null;
        String requiredVelocity = normalizeFmsClass(materialFmsClass);
        return Comparator
                .comparing((Location loc) -> !sameLocationCode(loc.getLocationCode(), preferred))
                .thenComparing((Location loc) -> {
                    List<InventoryItem> inv = inventoryByLocation.getOrDefault(loc.getLocationCode(), List.of());
                    boolean hasMaterial = inv.stream().anyMatch(item -> materialId.equals(item.getMaterialId()));
                    return !hasMaterial;
                })
                .thenComparingInt((Location loc) -> zonePutawayRank(loc.getZoneType()))
                .thenComparing((Location loc) -> !locationMatchesVelocity(loc, requiredVelocity))
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

    /**
     * Bulk receipts belong in reserve; pick faces are normally fed by replenishment. Rank them
     * so putaway drains reserve first and only spills into pick faces when reserve is full --
     * without that spill a warehouse whose reserve is 91% occupied simply stops receiving.
     */
    private int zonePutawayRank(String zoneType) {
        String zone = zoneType == null ? "" : zoneType.trim().toUpperCase(Locale.ROOT);
        if ("RESERVE".equals(zone) || "STORAGE".equals(zone)) {
            return 0;
        }
        return "PICK_FACE".equals(zone) ? 1 : 2;
    }

    private boolean locationMatchesVelocity(Location location, String requiredVelocity) {
        if (requiredVelocity == null) {
            return true;
        }
        String rackClass = location.getAmalgamatedClass();
        if (rackClass == null || rackClass.isBlank()) {
            return false;
        }
        String normalized = rackClass.trim().toUpperCase(Locale.ROOT);
        return normalized.endsWith(requiredVelocity);
    }

    private String normalizeFmsClass(String fmsClass) {
        if (fmsClass == null || fmsClass.isBlank()) {
            return null;
        }
        String normalized = fmsClass.trim().toUpperCase(Locale.ROOT);
        return Set.of("F", "M", "S").contains(normalized) ? normalized : null;
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

    /**
     * Execution-time capacity: physical contents only.
     *
     * <p>Reservations are deliberately not counted here. A worker confirming a pallet into a bin is
     * consuming the very claim that reserved it, so counting the claim would block the move it
     * exists to protect.
     */
    /**
     * Trim an allocation to a whole number of pallets so the plan does not manufacture partial
     * pallets it did not need.
     *
     * <p>A pallet lives in exactly one bin, so putaway raises one task per pallet per bin. When a
     * bin's headroom cut an allocation mid-pallet, the leftover units started a fresh partial
     * pallet in the next bin and the receipt ended up with more tasks than pallets -- 3 tasks for
     * 2 pallets. Aligning here keeps the total at ceil(total / unitsPerPallet).
     *
     * <p>The final chunk keeps its remainder (that partial pallet is real), and an allocation
     * smaller than one pallet is kept intact rather than dropped, so a warehouse of small bins
     * still makes progress instead of stalling.
     */
    private int palletAlign(int allocated, int remaining, BigDecimal unitsPerPallet) {
        if (allocated <= 0 || unitsPerPallet == null || unitsPerPallet.compareTo(BigDecimal.ZERO) <= 0) {
            return Math.max(allocated, 0);
        }
        int perPallet = Math.max(unitsPerPallet.setScale(0, RoundingMode.FLOOR).intValue(), 1);
        if (allocated >= remaining || allocated < perPallet) {
            return allocated;
        }
        int aligned = (allocated / perPallet) * perPallet;
        return aligned > 0 ? aligned : allocated;
    }

    private void recordRejection(Map<String, Integer> rejections, CapacityComputation computation) {
        if (computation.blockedByRackPalletRule()) {
            rejections.merge("no free pallet slot", 1, Integer::sum);
        }
        if (computation.blockedByWeight()) {
            rejections.merge("bin weight limit", 1, Integer::sum);
        }
        if (computation.blockedByVolume()) {
            rejections.merge("bin volume limit", 1, Integer::sum);
        }
        if (computation.blockedByLpn()) {
            rejections.merge("bin already holds another pallet", 1, Integer::sum);
        }
        if (computation.blockedByUnits()) {
            rejections.merge("bin unit capacity", 1, Integer::sum);
        }
        if (computation.missingWeightMetric()) {
            rejections.merge("material weight not recorded", 1, Integer::sum);
        }
        if (computation.missingVolumeMetric()) {
            rejections.merge("material volume not recorded", 1, Integer::sum);
        }
    }

    private CapacityComputation computeCapacity(
            Location location,
            UUID inboundMaterialId,
            Integer desiredQuantity,
            Material inboundMaterial,
            List<InventoryItem> locationInventory,
            Map<UUID, Material> materialCache) {
        return computeCapacity(location, inboundMaterialId, desiredQuantity, inboundMaterial,
                locationInventory, materialCache, 0);
    }

    /**
     * Planning-time capacity: physical contents plus pallet slots already claimed by other inbound
     * work. {@code reservedPallets} is what stops two lines of one order, or two concurrent orders,
     * being offered the same bin.
     */
    private CapacityComputation computeCapacity(
            Location location,
            UUID inboundMaterialId,
            Integer desiredQuantity,
            Material inboundMaterial,
            List<InventoryItem> locationInventory,
            Map<UUID, Material> materialCache,
            int reservedPallets) {
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

        BigDecimal unitsPerPallet = inboundMaterial.getUnitsPerPallet() != null
                && inboundMaterial.getUnitsPerPallet() > 0
                ? BigDecimal.valueOf(inboundMaterial.getUnitsPerPallet())
                : null;
        boolean palletCapacityModel = unitsPerPallet != null
                && location.getMaxPalletCapacity() != null
                && location.getMaxPalletCapacity() > 0;

        // In the versioned rack layout, capacity=1 means one pallet position,
        // not one sellable unit. Do not clamp a palletized SKU to one unit.
        if (!palletCapacityModel && location.getCapacity() != null && location.getCapacity().intValue() > 0) {
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
            if (inboundMaterial.getWeightKg() == null
                    || inboundMaterial.getWeightKg().compareTo(BigDecimal.ZERO) <= 0) {
                allocatable = 0;
                missingWeightMetric = true;
            } else {
                // Weigh what is actually being placed, not a notional full pallet. An empty bin
                // rated below a full pallet can still carry a partial one, and gating on the
                // pallet rating made empty bins stricter than part-filled ones -- which stranded
                // every heavy-pallet SKU in a warehouse whose free bins were all empty.
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

        if (palletCapacityModel) {
            int currentPalletCount = occupiedPallets(locationInventory, materialCache)
                    + Math.max(reservedPallets, 0);
            int slotHeadroom = Math.max(location.getMaxPalletCapacity() - currentPalletCount, 0);
            int byPalletSlots = toPositiveIntFloor(
                    BigDecimal.valueOf(slotHeadroom).multiply(unitsPerPallet));
            allocatable = Math.min(allocatable, byPalletSlots);
            if (byPalletSlots <= 0) {
                allocatable = 0;
                blockedByRackPalletRule = true;
            }
        }

        if (allocatable < desired && !palletCapacityModel && !blockedByUnits && location.getCapacity() != null
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

        Integer effectiveUnitCapacity = effectiveUnitCapacity(location, inboundMaterial);
        return new CapacitySnapshot(
                projectedQty,
                effectiveUnitCapacity,
                fillPercent(projectedQty, effectiveUnitCapacity),
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

    private Integer effectiveUnitCapacity(Location location, Material material) {
        if (material.getUnitsPerPallet() != null && material.getUnitsPerPallet() > 0
                && location.getMaxPalletCapacity() != null && location.getMaxPalletCapacity() > 0) {
            long capacity = (long) material.getUnitsPerPallet() * location.getMaxPalletCapacity();
            return capacity > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) capacity;
        }
        return location.getCapacity() != null ? location.getCapacity().intValue() : null;
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

    /**
     * Putaway uses the same storage definition as the rest of the system. Narrowing it to
     * zone_type=STORAGE hid every PICK_FACE and RESERVE bin from the planner, which in the
     * V8 layout is the entire live warehouse.
     */
    private boolean isStorageLocation(Location loc) {
        return LocationService.isOperationalStorageLocation(loc.getLocationType(), loc.getZoneType());
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

    /**
     * Pallets physically occupying a bin, derived from the stock actually in it.
     *
     * <p>The denormalised {@code location.current_pallet_count} column is deliberately not read
     * here. Nothing in the putaway write path maintains it -- only two manual admin endpoints do --
     * so it drifts from reality in both directions: stale-high made this validator reject bins the
     * planner had just offered as empty, and stale-low let a one-pallet bin accept a second pallet.
     * {@link StockPlacementPlanner} has always derived occupancy from inventory; deriving it the
     * same way here is what makes a suggested bin one that putaway will actually accept.
     */
    private int occupiedPallets(List<InventoryItem> locationInventory, Map<UUID, Material> materialCache) {
        int pallets = 0;
        for (InventoryItem item : locationInventory) {
            int quantity = nvl(item.getQuantity());
            if (quantity <= 0) {
                continue;
            }
            Material material = materialCache.get(item.getMaterialId());
            BigDecimal unitsPerPallet = material != null
                    ? handlingUnitCapacityService.resolveUnitsPerPallet(
                            material.getUnitsPerPallet(), material.getPalletSpaces())
                    : BigDecimal.ONE;
            pallets += handlingUnitCapacityService.computePalletCount(
                    BigDecimal.valueOf(quantity), unitsPerPallet);
        }
        return pallets;
    }

    /** Pallet slots at a bin already claimed by inbound work that has not landed there yet. */
    private int reservedPalletsAt(Map<String, Integer> reservedByLocation, String locationCode) {
        if (reservedByLocation == null || locationCode == null) {
            return 0;
        }
        Integer reserved = reservedByLocation.get(locationCode.trim().toUpperCase(Locale.ROOT));
        return reserved != null ? reserved : 0;
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
