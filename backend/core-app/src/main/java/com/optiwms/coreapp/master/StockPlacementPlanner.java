package com.optiwms.coreapp.master;

import com.optiwms.coreapp.slotting.DemandSpacePlanningService;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationLevelEntity;
import com.optiwms.infra.master.LocationLevelRepository;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StockPlacementPlanner {

    private final LocationRepository locationRepository;
    private final InventoryItemRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final LocationLevelRepository locationLevelRepository;
    private final HandlingUnitCapacityService capacityService;

    public StockPlacementPlanner(
            LocationRepository locationRepository,
            InventoryItemRepository inventoryRepository,
            MaterialRepository materialRepository,
            LocationLevelRepository locationLevelRepository,
            HandlingUnitCapacityService capacityService) {
        this.locationRepository = locationRepository;
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.locationLevelRepository = locationLevelRepository;
        this.capacityService = capacityService;
    }

    /**
     * Per-run cache of the warehouse-wide reads this planner needs.
     *
     * Planning one material re-reads every location and every inventory row in
     * the warehouse. That is affordable once, but the slotting optimizer plans
     * each material in turn, so on a large site it re-read a 160k-row inventory
     * table once per material and the run took minutes. Callers that plan more
     * than one material should create a context and pass it to every call.
     *
     * Not thread-safe and intentionally short-lived: it is a snapshot for the
     * duration of one planning run, not a cache with an invalidation story.
     */
    public static final class PlacementContext {
        private final Map<UUID, List<LocationEntity>> locations = new HashMap<>();
        private final Map<UUID, List<InventoryItemEntity>> inventory = new HashMap<>();
        private final Map<UUID, MaterialEntity> materials = new HashMap<>();
        private final Map<UUID, LocationLevelEntity> levels = new HashMap<>();
        private final Set<UUID> levelsLoadedFor = new HashSet<>();
    }

    public PlacementContext newContext() {
        return new PlacementContext();
    }

    public PlacementPlan planPlacement(
            UUID warehouseId,
            UUID materialId,
            int totalQuantity,
            String preferredLocationCode,
            Set<String> excludeLocationCodes) {
        return planPlacement(warehouseId, materialId, totalQuantity, preferredLocationCode,
                excludeLocationCodes, new PlacementContext());
    }

    public PlacementPlan planPlacement(
            UUID warehouseId,
            UUID materialId,
            int totalQuantity,
            String preferredLocationCode,
            Set<String> excludeLocationCodes,
            PlacementContext context) {
        if (totalQuantity <= 0) {
            return new PlacementPlan(0, 0, 0, List.of(), List.of("Quantity must be positive"));
        }

        MaterialEntity material = material(materialId, context);
        if (material == null) {
            throw new RuntimeException("Material not found: " + materialId);
        }

        BigDecimal unitsPerPallet = capacityService.resolveUnitsPerPallet(material);
        int requiredPallets = capacityService.computePalletCount(totalQuantity, material);
        int qtyPerPallet = unitsPerPallet.setScale(0, RoundingMode.CEILING).intValue();

        LocationEntity preferredLocation = preferredLocationCode == null || preferredLocationCode.isBlank()
                ? null
                : locationRepository.findByLocationCode(preferredLocationCode)
                        .filter(location -> warehouseId.equals(location.getWarehouseId()))
                        .orElse(null);

        List<LocationEntity> candidates = warehouseLocations(warehouseId, context).stream()
                .filter(loc -> "STORAGE".equals(loc.getZoneType()))
                .filter(loc -> Boolean.TRUE.equals(loc.getIsActive()))
                .filter(loc -> loc.getLocationCode() != null && !loc.getLocationCode().isBlank())
                .filter(loc -> excludeLocationCodes == null || !excludeLocationCodes.contains(loc.getLocationCode()))
                .filter(loc -> isRackAvailable(loc))
                .sorted(Comparator
                        .comparingInt((LocationEntity loc) -> proximityToPreferred(loc, preferredLocation))
                        .thenComparing((LocationEntity loc) -> !locationMatchesVelocity(loc, material.getFmsClass()))
                        .thenComparingInt(loc -> loc.getLevelNumber() != null ? loc.getLevelNumber() : 3))
                .toList();

        WarehouseOccupancyState state = buildOccupancyState(warehouseId, candidates, excludeLocationCodes, context);
        List<PlacementLine> lines = new ArrayList<>();
        int remainingQty = totalQuantity;
        int remainingPallets = requiredPallets;
        List<String> notes = new ArrayList<>();
        notes.add("Handling model: " + unitsPerPallet.stripTrailingZeros().toPlainString() + " units/pallet, "
                + requiredPallets + " pallet(s) required.");

        for (LocationEntity location : candidates) {
            if (remainingPallets <= 0) {
                break;
            }
            if (!capacityService.palletFitsBin(material, location)) {
                continue;
            }
            if (!capacityService.binHasPalletHeadroom(location, state.binPalletCount(location.getLocationCode()))) {
                continue;
            }
            if (!state.canAddPallet(location, material, capacityService)) {
                continue;
            }

            int qtyForBin = Math.min(remainingQty, qtyPerPallet);
            int palletsHere = 1;
            state.addPallet(location, material, qtyForBin);
            lines.add(new PlacementLine(
                    location.getLocationCode(),
                    palletsHere,
                    qtyForBin,
                    capacityService.rackKey(location),
                    location.getLevelNumber()));
            remainingQty -= qtyForBin;
            remainingPallets -= palletsHere;
        }

        boolean feasible = remainingPallets <= 0;
        if (!feasible) {
            notes.add("Insufficient compatible bins. Remaining pallets: " + remainingPallets);
        }

        return new PlacementPlan(
                requiredPallets,
                requiredPallets - remainingPallets,
                remainingPallets,
                lines,
                notes);
    }

    /**
     * Reclaim bins from falling-demand SKUs that hold stock above ROP + safety minimum.
     */
    public List<ReclaimBin> planReclaim(
            UUID warehouseId,
            Map<UUID, DemandSpacePlanningService.DemandProfile> demandProfiles,
            int binsNeeded,
            Set<String> excludeLocationCodes) {
        if (binsNeeded <= 0 || demandProfiles == null || demandProfiles.isEmpty()) {
            return List.of();
        }

        List<ReclaimCandidate> candidates = new ArrayList<>();
        for (DemandSpacePlanningService.DemandProfile profile : demandProfiles.values()) {
            if (profile.demandTrend() != DemandSpacePlanningService.DemandTrend.FALLING
                    || profile.reclaimablePositions() <= 0) {
                continue;
            }
            int minUnits = profile.minStockUnits().setScale(0, RoundingMode.CEILING).intValue();
            List<InventoryItemEntity> stock = inventoryRepository.findByMaterialIdAndWarehouseId(
                    profile.materialId(), warehouseId);
            for (InventoryItemEntity item : stock) {
                if (item.getQuantity() == null || item.getQuantity() <= 0 || item.getLocationCode() == null) {
                    continue;
                }
                if (excludeLocationCodes != null && excludeLocationCodes.contains(item.getLocationCode())) {
                    continue;
                }
                if (item.getQuantity() <= minUnits) {
                    continue;
                }
                candidates.add(new ReclaimCandidate(
                        item.getLocationCode(),
                        profile.materialId(),
                        profile.materialCode(),
                        item.getQuantity() - minUnits,
                        profile.reclaimablePositions()));
            }
        }

        candidates.sort(Comparator
                .comparingInt(ReclaimCandidate::excessUnits).reversed()
                .thenComparing(ReclaimCandidate::reclaimablePositions, Comparator.reverseOrder()));

        List<ReclaimBin> reclaimed = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (ReclaimCandidate candidate : candidates) {
            if (reclaimed.size() >= binsNeeded) {
                break;
            }
            if (used.contains(candidate.locationCode())) {
                continue;
            }
            used.add(candidate.locationCode());
            reclaimed.add(new ReclaimBin(
                    candidate.locationCode(),
                    candidate.materialId(),
                    candidate.materialCode(),
                    "Reclaim from falling-demand SKU above ROP"));
        }
        return reclaimed;
    }

    private record ReclaimCandidate(
            String locationCode,
            UUID materialId,
            String materialCode,
            int excessUnits,
            int reclaimablePositions) {}

    public record ReclaimBin(
            String locationCode,
            UUID sourceMaterialId,
            String sourceMaterialCode,
            String rationale) {}

    private boolean isRackAvailable(LocationEntity location) {
        String status = location.getRackStatus() != null ? location.getRackStatus().toLowerCase() : "active";
        return "active".equals(status);
    }

    private LocationEntity resolveAnchor(String preferredLocationCode, List<LocationEntity> candidates) {
        if (preferredLocationCode == null || preferredLocationCode.isBlank()) {
            return candidates.isEmpty() ? null : candidates.get(0);
        }
        return candidates.stream()
                .filter(loc -> preferredLocationCode.equals(loc.getLocationCode()))
                .findFirst()
                .orElse(candidates.isEmpty() ? null : candidates.get(0));
    }

    private int proximityToPreferred(LocationEntity loc, LocationEntity preferred) {
        if (preferred == null) {
            return 0;
        }
        return capacityService.proximityScore(loc, preferred);
    }

    private boolean locationMatchesVelocity(LocationEntity location, String materialFmsClass) {
        if (materialFmsClass == null || materialFmsClass.isBlank()) {
            return true;
        }
        String required = materialFmsClass.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("F", "M", "S").contains(required)) {
            return true;
        }
        String rackClass = location.getAmalgamatedClass();
        return rackClass != null && rackClass.trim().toUpperCase(Locale.ROOT).endsWith(required);
    }

    /**
     * Active storage locations, read once per context. The zone and active
     * filters run in SQL rather than in the stream below, because a warehouse
     * can hold ~195k rows of which only a few thousand are placement
     * candidates.
     */
    private List<LocationEntity> warehouseLocations(UUID warehouseId, PlacementContext context) {
        return context.locations.computeIfAbsent(warehouseId,
                id -> locationRepository.findByWarehouseIdAndZoneTypeAndIsActive(id, "STORAGE", true));
    }

    /** Warehouse inventory, read once per context. This is the large one. */
    private List<InventoryItemEntity> warehouseInventory(UUID warehouseId, PlacementContext context) {
        return context.inventory.computeIfAbsent(warehouseId, inventoryRepository::findByWarehouseId);
    }

    private MaterialEntity material(UUID materialId, PlacementContext context) {
        return context.materials.computeIfAbsent(materialId,
                id -> materialRepository.findById(id).orElse(null));
    }

    private Map<UUID, MaterialEntity> materials(Set<UUID> materialIds, PlacementContext context) {
        List<UUID> missing = materialIds.stream()
                .filter(id -> !context.materials.containsKey(id))
                .toList();
        if (!missing.isEmpty()) {
            materialRepository.findAllById(missing)
                    .forEach(entity -> context.materials.put(entity.getId(), entity));
        }
        Map<UUID, MaterialEntity> result = new HashMap<>();
        for (UUID id : materialIds) {
            MaterialEntity entity = context.materials.get(id);
            if (entity != null) {
                result.put(id, entity);
            }
        }
        return result;
    }

    private WarehouseOccupancyState buildOccupancyState(
            UUID warehouseId,
            List<LocationEntity> candidates,
            Set<String> excludeLocationCodes,
            PlacementContext context) {
        Set<String> codes = candidates.stream().map(LocationEntity::getLocationCode).collect(Collectors.toSet());
        List<InventoryItemEntity> inventory = warehouseInventory(warehouseId, context).stream()
                .filter(item -> item.getLocationCode() != null && codes.contains(item.getLocationCode()))
                .filter(item -> excludeLocationCodes == null || !excludeLocationCodes.contains(item.getLocationCode()))
                .toList();

        Set<UUID> materialIds = inventory.stream()
                .map(InventoryItemEntity::getMaterialId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, MaterialEntity> materials = materials(materialIds, context);

        Map<String, LocationEntity> locationByCode = candidates.stream()
                .collect(Collectors.toMap(LocationEntity::getLocationCode, l -> l, (a, b) -> a));

        Map<String, BigDecimal> levelWeight = new HashMap<>();
        Map<String, Integer> binPallets = new HashMap<>();

        for (InventoryItemEntity item : inventory) {
            if (capacityService.isBinEmpty(item)) {
                continue;
            }
            LocationEntity loc = locationByCode.get(item.getLocationCode());
            if (loc == null) {
                continue;
            }
            MaterialEntity mat = materials.get(item.getMaterialId());
            int qty = item.getQuantity();
            int pallets = capacityService.computePalletCount(qty, mat);
            BigDecimal weight = capacityService.computeBinWeightKg(qty, mat);
            binPallets.merge(item.getLocationCode(), pallets, Integer::sum);
            levelWeight.merge(capacityService.rackLevelKey(loc), weight, BigDecimal::add);
        }

        Map<String, LocationLevelEntity> levelCaps = loadLevelCaps(candidates, context);
        return new WarehouseOccupancyState(levelWeight, binPallets, levelCaps, capacityService);
    }

    private Map<String, LocationLevelEntity> loadLevelCaps(List<LocationEntity> candidates, PlacementContext context) {
        Map<String, UUID> rep = new HashMap<>();
        for (LocationEntity loc : candidates) {
            String pos = loc.getBinPosition() != null ? loc.getBinPosition().toUpperCase() : "A";
            if ("A".equals(pos)) {
                rep.putIfAbsent(capacityService.rackLevelKey(loc), loc.getId());
            }
        }
        // Only fetch levels this context has not seen; on later materials the
        // candidate set is largely the same, so this is usually a no-op.
        List<UUID> unseen = rep.values().stream()
                .filter(id -> !context.levelsLoadedFor.contains(id))
                .toList();
        if (!unseen.isEmpty()) {
            locationLevelRepository.findByLocationIdIn(unseen)
                    .forEach(level -> context.levels.put(level.getLocationId(), level));
            context.levelsLoadedFor.addAll(unseen);
        }
        Map<UUID, LocationLevelEntity> byLoc = context.levels;
        Map<String, LocationLevelEntity> result = new HashMap<>();
        for (Map.Entry<String, UUID> e : rep.entrySet()) {
            LocationLevelEntity level = byLoc.get(e.getValue());
            if (level != null) {
                result.put(e.getKey(), level);
            }
        }
        return result;
    }

    private static final class WarehouseOccupancyState {
        private final Map<String, BigDecimal> levelWeightUsed;
        private final Map<String, Integer> binPalletCount;
        private final Map<String, LocationLevelEntity> levelCaps;
        private final HandlingUnitCapacityService capacityService;

        private WarehouseOccupancyState(
                Map<String, BigDecimal> levelWeightUsed,
                Map<String, Integer> binPalletCount,
                Map<String, LocationLevelEntity> levelCaps,
                HandlingUnitCapacityService capacityService) {
            this.levelWeightUsed = new HashMap<>(levelWeightUsed);
            this.binPalletCount = new HashMap<>(binPalletCount);
            this.levelCaps = levelCaps;
            this.capacityService = capacityService;
        }

        int binPalletCount(String locationCode) {
            return binPalletCount.getOrDefault(locationCode, 0);
        }

        boolean canAddPallet(LocationEntity location, MaterialEntity material, HandlingUnitCapacityService capacity) {
            String levelKey = capacity.rackLevelKey(location);
            BigDecimal used = levelWeightUsed.getOrDefault(levelKey, BigDecimal.ZERO);
            LocationLevelEntity levelEntity = levelCaps.get(levelKey);
            int levelNo = location.getLevelNumber() != null ? location.getLevelNumber() : 3;
            BigDecimal cap = capacity.resolveLevelBeamCapacityKg(levelEntity, levelNo);
            return capacity.canAddPalletToLevelBeam(used, cap, material);
        }

        void addPallet(LocationEntity location, MaterialEntity material, int qty) {
            String code = location.getLocationCode();
            String levelKey = capacityService.rackLevelKey(location);
            binPalletCount.merge(code, 1, Integer::sum);
            BigDecimal weight = capacityService.computeBinWeightKg(qty, material);
            if (weight.compareTo(BigDecimal.ZERO) <= 0) {
                weight = capacityService.resolvePalletWeightKg(material);
            }
            levelWeightUsed.merge(levelKey, weight, BigDecimal::add);
        }
    }

    public record PlacementLine(
            String locationCode,
            int palletCount,
            int quantityAllocated,
            String rackId,
            Integer levelNumber) {}

    public record PlacementPlan(
            int requiredPallets,
            int assignedPallets,
            int remainingPallets,
            List<PlacementLine> lines,
            List<String> notes) {}
}
