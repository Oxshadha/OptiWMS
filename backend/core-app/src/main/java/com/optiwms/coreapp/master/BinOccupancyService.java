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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BinOccupancyService {

    private final LocationRepository locationRepository;
    private final InventoryItemRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final LocationLevelRepository locationLevelRepository;
    private final HandlingUnitCapacityService capacityService;

    public BinOccupancyService(
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

    public List<BinOccupancyDto> getWarehouseRackOccupancy(UUID warehouseId) {
        List<LocationEntity> storageLocations = locationRepository.findByWarehouseId(warehouseId).stream()
                .filter(loc -> "STORAGE".equals(loc.getZoneType()))
                .toList();

        List<InventoryItemEntity> inventory = inventoryRepository.findByWarehouseId(warehouseId);
        Map<String, InventoryItemEntity> inventoryByCode = inventory.stream()
                .filter(item -> item.getLocationCode() != null && !item.getLocationCode().isBlank())
                .filter(item -> item.getQuantity() != null && item.getQuantity() > 0)
                .collect(Collectors.toMap(
                        InventoryItemEntity::getLocationCode,
                        item -> item,
                        (a, b) -> a));

        Set<UUID> materialIds = inventory.stream()
                .map(InventoryItemEntity::getMaterialId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, MaterialEntity> materials = materialRepository.findAllById(materialIds).stream()
                .collect(Collectors.toMap(MaterialEntity::getId, m -> m));

        Map<String, LocationLevelEntity> levelByRackLevel = loadLevelBeamCaps(storageLocations);

        Map<String, BigDecimal> levelWeightUsed = new HashMap<>();
        Map<String, Integer> levelPalletUsed = new HashMap<>();
        List<BinOccupancyDto> bins = new ArrayList<>();

        for (LocationEntity location : storageLocations) {
            InventoryItemEntity item = inventoryByCode.get(location.getLocationCode());
            MaterialEntity material = item != null ? materials.get(item.getMaterialId()) : null;
            int quantity = item != null && item.getQuantity() != null ? item.getQuantity() : 0;
            int palletCount = capacityService.computePalletCount(quantity, material);
            BigDecimal binWeightKg = capacityService.computeBinWeightKg(quantity, material);
            BigDecimal palletWeightKg = material != null ? capacityService.resolvePalletWeightKg(material) : BigDecimal.ZERO;
            BigDecimal unitsPerPallet = material != null ? capacityService.resolveUnitsPerPallet(material) : BigDecimal.ONE;

            String rackLevelKey = capacityService.rackLevelKey(location);
            if (palletCount > 0) {
                levelWeightUsed.merge(rackLevelKey, binWeightKg, BigDecimal::add);
                levelPalletUsed.merge(rackLevelKey, palletCount, Integer::sum);
            }

            bins.add(new BinOccupancyDto(
                    location.getId(),
                    location.getLocationCode(),
                    capacityService.rackKey(location),
                    location.getArea(),
                    location.getRowNumber(),
                    location.getBayNumber(),
                    location.getLevelNumber(),
                    location.getBinPosition(),
                    quantity,
                    material != null ? material.getMaterialCode() : null,
                    unitsPerPallet,
                    palletCount,
                    binWeightKg.setScale(2, RoundingMode.HALF_UP),
                    palletWeightKg.setScale(2, RoundingMode.HALF_UP),
                    capacityService.resolveMaxPalletCapacity(location),
                    location.getMaxWeightKg(),
                    null,
                    null,
                    null));
        }

        Map<String, BinOccupancyDto> enriched = new LinkedHashMap<>();
        for (BinOccupancyDto bin : bins) {
            String rackLevelKey = capacityService.rackLevelKey(
                    bin.area(), bin.rowNumber(), bin.bayNumber(),
                    bin.levelNumber() != null ? bin.levelNumber() : 1);
            LocationLevelEntity levelEntity = levelByRackLevel.get(rackLevelKey);
            BigDecimal levelCap = capacityService.resolveLevelBeamCapacityKg(
                    levelEntity, bin.levelNumber() != null ? bin.levelNumber() : 1);
            BigDecimal levelUsed = levelWeightUsed.getOrDefault(rackLevelKey, BigDecimal.ZERO)
                    .setScale(2, RoundingMode.HALF_UP);
            int levelPallets = levelPalletUsed.getOrDefault(rackLevelKey, 0);
            Integer levelPalletCap = levelEntity != null ? levelEntity.getPalletCapacity() : null;

            enriched.put(bin.locationCode(), new BinOccupancyDto(
                    bin.locationId(),
                    bin.locationCode(),
                    bin.rackId(),
                    bin.area(),
                    bin.rowNumber(),
                    bin.bayNumber(),
                    bin.levelNumber(),
                    bin.binPosition(),
                    bin.quantity(),
                    bin.materialCode(),
                    bin.unitsPerPallet(),
                    bin.palletCount(),
                    bin.binWeightKg(),
                    bin.palletWeightKg(),
                    bin.maxPalletCapacity(),
                    bin.maxWeightKg(),
                    levelCap.setScale(2, RoundingMode.HALF_UP),
                    levelUsed,
                    levelPalletCap != null ? levelPalletCap : levelPallets));
        }

        return new ArrayList<>(enriched.values());
    }

    @Transactional
    public int reconcileWarehouseLevelUsage(UUID warehouseId) {
        List<BinOccupancyDto> occupancy = getWarehouseRackOccupancy(warehouseId);
        List<LocationEntity> storageLocations = locationRepository.findByWarehouseId(warehouseId).stream()
                .filter(loc -> "STORAGE".equals(loc.getZoneType()))
                .toList();
        Map<String, LocationLevelEntity> levelByRackLevel = loadLevelBeamCaps(storageLocations);

        Map<String, BigDecimal> levelWeightUsed = new HashMap<>();
        Map<String, Integer> levelPalletUsed = new HashMap<>();
        for (BinOccupancyDto bin : occupancy) {
            String rackLevelKey = capacityService.rackLevelKey(
                    bin.area(), bin.rowNumber(), bin.bayNumber(),
                    bin.levelNumber() != null ? bin.levelNumber() : 1);
            if (bin.palletCount() > 0) {
                levelWeightUsed.merge(rackLevelKey, bin.binWeightKg(), BigDecimal::add);
                levelPalletUsed.merge(rackLevelKey, bin.palletCount(), Integer::sum);
            }
        }

        int updated = 0;
        for (Map.Entry<String, LocationLevelEntity> entry : levelByRackLevel.entrySet()) {
            LocationLevelEntity level = entry.getValue();
            BigDecimal used = levelWeightUsed.getOrDefault(entry.getKey(), BigDecimal.ZERO);
            int pallets = levelPalletUsed.getOrDefault(entry.getKey(), 0);
            level.setCurrentWeightKg(used.setScale(2, RoundingMode.HALF_UP));
            level.setCurrentPalletCount(pallets);
            locationLevelRepository.save(level);
            updated++;
        }

        for (LocationEntity location : storageLocations) {
            BinOccupancyDto bin = occupancy.stream()
                    .filter(o -> o.locationCode().equals(location.getLocationCode()))
                    .findFirst()
                    .orElse(null);
            if (bin != null) {
                location.setCurrentPalletCount(bin.palletCount());
            } else {
                location.setCurrentPalletCount(0);
            }
            locationRepository.save(location);
            updated++;
        }

        alignLevelBeamCaps(warehouseId);
        return updated;
    }

    @Transactional
    public int alignLevelBeamCaps(UUID warehouseId) {
        List<LocationEntity> storageLocations = locationRepository.findByWarehouseId(warehouseId).stream()
                .filter(loc -> "STORAGE".equals(loc.getZoneType()))
                .toList();
        Map<String, LocationLevelEntity> levelByRackLevel = loadLevelBeamCaps(storageLocations);
        int updated = 0;

        for (LocationLevelEntity level : levelByRackLevel.values()) {
            int levelNumber = level.getLevelNumber() != null ? level.getLevelNumber() : 3;
            BigDecimal targetCap = capacityService.defaultLevelBeamCapacityKg(levelNumber);
            if (level.getWeightCapacityKg() == null
                    || level.getWeightCapacityKg().compareTo(targetCap) != 0) {
                level.setWeightCapacityKg(targetCap);
                updated++;
            }
            if (level.getPalletCapacity() == null || level.getPalletCapacity() < 2) {
                level.setPalletCapacity(2);
                updated++;
            }
            locationLevelRepository.save(level);
        }

        for (LocationEntity location : storageLocations) {
            int level = location.getLevelNumber() != null ? location.getLevelNumber() : 3;
            BigDecimal beamCap = capacityService.defaultLevelBeamCapacityKg(level);
            boolean changed = false;
            if (location.getMaxPalletCapacity() == null || location.getMaxPalletCapacity() != 1) {
                location.setMaxPalletCapacity(1);
                changed = true;
            }
            if (location.getMaxWeightKg() == null
                    || location.getMaxWeightKg().compareTo(beamCap) > 0) {
                location.setMaxWeightKg(beamCap);
                changed = true;
            }
            if (changed) {
                locationRepository.save(location);
                updated++;
            }
        }
        return updated;
    }

    private Map<String, LocationLevelEntity> loadLevelBeamCaps(List<LocationEntity> storageLocations) {
        Map<String, UUID> representativeBinA = new HashMap<>();
        for (LocationEntity location : storageLocations) {
            String pos = location.getBinPosition() != null ? location.getBinPosition().toUpperCase() : "A";
            if (!"A".equals(pos)) {
                continue;
            }
            String key = capacityService.rackLevelKey(location);
            representativeBinA.putIfAbsent(key, location.getId());
        }

        List<UUID> ids = new ArrayList<>(representativeBinA.values());
        Map<UUID, LocationLevelEntity> byLocationId = locationLevelRepository.findByLocationIdIn(ids).stream()
                .collect(Collectors.toMap(LocationLevelEntity::getLocationId, l -> l, (a, b) -> a));

        Map<String, LocationLevelEntity> result = new HashMap<>();
        for (Map.Entry<String, UUID> entry : representativeBinA.entrySet()) {
            LocationLevelEntity level = byLocationId.get(entry.getValue());
            if (level != null) {
                result.put(entry.getKey(), level);
            }
        }
        return result;
    }

    public record BinOccupancyDto(
            UUID locationId,
            String locationCode,
            String rackId,
            String area,
            String rowNumber,
            String bayNumber,
            Integer levelNumber,
            String binPosition,
            int quantity,
            String materialCode,
            BigDecimal unitsPerPallet,
            int palletCount,
            BigDecimal binWeightKg,
            BigDecimal palletWeightKg,
            int maxPalletCapacity,
            BigDecimal maxWeightKg,
            BigDecimal levelWeightCapacityKg,
            BigDecimal levelWeightUsedKg,
            Integer levelPalletCapacity) {}
}
