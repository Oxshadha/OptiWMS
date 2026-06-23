package com.optiwms.coreapp.master;

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

    public PlacementPlan planPlacement(
            UUID warehouseId,
            UUID materialId,
            int totalQuantity,
            String preferredLocationCode,
            Set<String> excludeLocationCodes) {
        if (totalQuantity <= 0) {
            return new PlacementPlan(0, 0, 0, List.of(), List.of("Quantity must be positive"));
        }

        MaterialEntity material = materialRepository.findById(materialId)
                .orElseThrow(() -> new RuntimeException("Material not found: " + materialId));

        BigDecimal unitsPerPallet = capacityService.resolveUnitsPerPallet(material);
        int requiredPallets = capacityService.computePalletCount(totalQuantity, material);
        int qtyPerPallet = unitsPerPallet.setScale(0, RoundingMode.CEILING).intValue();

        List<LocationEntity> candidates = locationRepository.findByWarehouseId(warehouseId).stream()
                .filter(loc -> "STORAGE".equals(loc.getZoneType()))
                .filter(loc -> Boolean.TRUE.equals(loc.getIsActive()))
                .filter(loc -> loc.getLocationCode() != null && !loc.getLocationCode().isBlank())
                .filter(loc -> excludeLocationCodes == null || !excludeLocationCodes.contains(loc.getLocationCode()))
                .filter(loc -> isRackAvailable(loc))
                .sorted(Comparator
                        .comparingInt((LocationEntity loc) -> proximityToPreferred(loc, preferredLocationCode, warehouseId))
                        .thenComparingInt(loc -> loc.getLevelNumber() != null ? loc.getLevelNumber() : 3))
                .toList();

        WarehouseOccupancyState state = buildOccupancyState(warehouseId, candidates, excludeLocationCodes);
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

    private int proximityToPreferred(LocationEntity loc, String preferredLocationCode, UUID warehouseId) {
        if (preferredLocationCode == null || preferredLocationCode.isBlank()) {
            return 0;
        }
        LocationEntity preferred = locationRepository.findByLocationCode(preferredLocationCode).orElse(null);
        if (preferred == null || !warehouseId.equals(preferred.getWarehouseId())) {
            return 0;
        }
        return capacityService.proximityScore(loc, preferred);
    }

    private WarehouseOccupancyState buildOccupancyState(
            UUID warehouseId,
            List<LocationEntity> candidates,
            Set<String> excludeLocationCodes) {
        Set<String> codes = candidates.stream().map(LocationEntity::getLocationCode).collect(Collectors.toSet());
        List<InventoryItemEntity> inventory = inventoryRepository.findByWarehouseId(warehouseId).stream()
                .filter(item -> item.getLocationCode() != null && codes.contains(item.getLocationCode()))
                .filter(item -> excludeLocationCodes == null || !excludeLocationCodes.contains(item.getLocationCode()))
                .toList();

        Set<UUID> materialIds = inventory.stream()
                .map(InventoryItemEntity::getMaterialId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, MaterialEntity> materials = materialRepository.findAllById(materialIds).stream()
                .collect(Collectors.toMap(MaterialEntity::getId, m -> m));

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

        Map<String, LocationLevelEntity> levelCaps = loadLevelCaps(candidates);
        return new WarehouseOccupancyState(levelWeight, binPallets, levelCaps, capacityService);
    }

    private Map<String, LocationLevelEntity> loadLevelCaps(List<LocationEntity> candidates) {
        Map<String, UUID> rep = new HashMap<>();
        for (LocationEntity loc : candidates) {
            String pos = loc.getBinPosition() != null ? loc.getBinPosition().toUpperCase() : "A";
            if ("A".equals(pos)) {
                rep.putIfAbsent(capacityService.rackLevelKey(loc), loc.getId());
            }
        }
        Map<UUID, LocationLevelEntity> byLoc = locationLevelRepository.findByLocationIdIn(rep.values()).stream()
                .collect(Collectors.toMap(LocationLevelEntity::getLocationId, l -> l, (a, b) -> a));
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
