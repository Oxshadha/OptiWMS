package com.optiwms.coreapp.slotting;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.infra.forecast.ForecastResultEntity;
import com.optiwms.infra.forecast.ForecastResultRepository;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialDefaultLocationEntity;
import com.optiwms.infra.master.MaterialDefaultLocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.slotting.MaterialIssueStatsRollupEntity;
import com.optiwms.infra.slotting.MaterialIssueStatsRollupRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Forward-looking space targets from forecasts, MOQ, ROP, and lead-time guardrails.
 */
@Service
public class DemandSpacePlanningService {

    public static final int HORIZON_MONTHS = 6;

    public enum DemandTrend { RISING, STABLE, FALLING }

    public record DemandProfile(
            UUID materialId,
            String materialCode,
            int requiredPalletPositions,
            int activePickPalletPositions,
            DemandTrend demandTrend,
            BigDecimal forecastP50Units,
            BigDecimal forecastP90Units,
            BigDecimal minStockUnits,
            double stockoutRiskScore,
            int reclaimablePositions,
            int currentBinCount,
            int confidencePct,
            String evidenceStatus,
            String rationale) {}

    private final ForecastResultRepository forecastRepository;
    private final MaterialRepository materialRepository;
    private final MaterialIssueStatsRollupRepository rollupRepository;
    private final InventoryItemRepository inventoryRepository;
    private final MaterialDefaultLocationRepository defaultLocationRepository;
    private final HandlingUnitCapacityService capacityService;

    public DemandSpacePlanningService(
            ForecastResultRepository forecastRepository,
            MaterialRepository materialRepository,
            MaterialIssueStatsRollupRepository rollupRepository,
            InventoryItemRepository inventoryRepository,
            MaterialDefaultLocationRepository defaultLocationRepository,
            HandlingUnitCapacityService capacityService) {
        this.forecastRepository = forecastRepository;
        this.materialRepository = materialRepository;
        this.rollupRepository = rollupRepository;
        this.inventoryRepository = inventoryRepository;
        this.defaultLocationRepository = defaultLocationRepository;
        this.capacityService = capacityService;
    }

    public Map<UUID, DemandProfile> buildProfiles(UUID warehouseId, Collection<UUID> materialIds) {
        if (materialIds == null || materialIds.isEmpty()) {
            return Map.of();
        }
        LocalDate today = LocalDate.now();
        LocalDate horizonEnd = today.plusMonths(HORIZON_MONTHS);
        LocalDate pastStart = today.minusMonths(HORIZON_MONTHS);

        Map<UUID, MaterialIssueStatsRollupEntity> rollups = rollupRepository.findByWarehouseId(warehouseId).stream()
                .collect(Collectors.toMap(MaterialIssueStatsRollupEntity::getMaterialId, r -> r, (a, b) -> a));

        Map<UUID, List<ForecastResultEntity>> forecastsByMaterial =
                forecastRepository.findForecastsForWarehouse(warehouseId, today, horizonEnd).stream()
                        .collect(Collectors.groupingBy(ForecastResultEntity::getMaterialId));

        Map<UUID, Integer> binCounts = countBinsByMaterial(warehouseId, materialIds);
        Map<UUID, Integer> onHandByMaterial = sumOnHand(warehouseId, materialIds);
        Map<UUID, EffectiveStockTarget> effectiveStockTargets = effectiveStockTargets(warehouseId, materialIds);

        Map<UUID, DemandProfile> profiles = new LinkedHashMap<>();
        for (UUID materialId : materialIds) {
            MaterialEntity material = materialRepository.findById(materialId).orElse(null);
            if (material == null) {
                continue;
            }
            MaterialIssueStatsRollupEntity rollup = rollups.get(materialId);
            List<ForecastResultEntity> forecasts = dedupeMonthly(forecastsByMaterial.getOrDefault(materialId, List.of()));

            BigDecimal forecastP50 = sumP50(forecasts);
            BigDecimal forecastP90 = sumP90(forecasts, forecastP50);
            if (forecastP50.compareTo(BigDecimal.ZERO) <= 0 && rollup != null && rollup.getIssueVolume12m() != null) {
                forecastP50 = BigDecimal.valueOf(rollup.getIssueVolume12m())
                        .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
                forecastP90 = forecastP50.multiply(BigDecimal.valueOf(1.25));
            }
            if (forecastP50.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            BigDecimal safety = material.getSafetyStockLevel() != null
                    ? material.getSafetyStockLevel() : BigDecimal.ZERO;
            int leadDays = resolveLeadTimeDays(materialId, warehouseId);
            BigDecimal leadBuffer = forecastP50.multiply(BigDecimal.valueOf(leadDays))
                    .divide(BigDecimal.valueOf(180), 2, RoundingMode.HALF_UP);

            BigDecimal calculatedMinStock = safety.add(leadBuffer);
            EffectiveStockTarget effectiveTarget = effectiveStockTargets.get(materialId);
            BigDecimal minStock = effectiveTarget != null && effectiveTarget.minStock().compareTo(BigDecimal.ZERO) > 0
                    ? effectiveTarget.minStock()
                    : calculatedMinStock;
            BigDecimal averageMonthlyForecast = forecastP50.divide(
                    BigDecimal.valueOf(Math.max(1, forecasts.size())), 2, RoundingMode.HALF_UP);
            boolean usesEffectiveMaxPolicy = effectiveTarget != null
                    && effectiveTarget.maxStock().compareTo(BigDecimal.ZERO) > 0;
            BigDecimal targetStock = usesEffectiveMaxPolicy
                    ? effectiveTarget.maxStock()
                    : averageMonthlyForecast.add(minStock);
            String targetSource = usesEffectiveMaxPolicy
                    ? "effective WMS max policy"
                    : "monthly forecast plus lead-time buffer";

            int unitsPerPallet = capacityService.resolveUnitsPerPallet(material)
                    .setScale(0, RoundingMode.CEILING).intValue();
            unitsPerPallet = Math.max(unitsPerPallet, 1);

            int rawPallets = capacityService.computePalletCount(targetStock.intValue(), material);
            int moq = material.getMinOrderQuantity() != null
                    ? material.getMinOrderQuantity().setScale(0, RoundingMode.CEILING).intValue()
                    : unitsPerPallet;
            int requiredPallets = usesEffectiveMaxPolicy
                    ? Math.max(1, rawPallets)
                    : roundUpToMoqPallets(rawPallets, moq, unitsPerPallet);

            int activePick = Math.max(1, (int) Math.ceil(requiredPallets * 0.35));
            activePick = Math.min(activePick, requiredPallets);

            long pastIssues = rollup != null && rollup.getIssueVolume12m() != null
                    ? rollup.getIssueVolume12m() / 2 : 0;
            DemandTrend trend = classifyTrend(forecastP50, pastIssues);

            int currentBins = binCounts.getOrDefault(materialId, 0);
            int onHand = onHandByMaterial.getOrDefault(materialId, 0);
            double stockoutRisk = computeStockoutRisk(onHand, minStock, trend, currentBins, requiredPallets);

            int reclaimable = 0;
            if (trend == DemandTrend.FALLING && currentBins > requiredPallets) {
                int excessBins = currentBins - requiredPallets;
                int protectedPallets = capacityService.computePalletCount(minStock.intValue(), material);
                int maxReclaim = Math.max(0, currentBins - Math.max(requiredPallets, protectedPallets));
                reclaimable = Math.min(excessBins, maxReclaim);
            }

            boolean forecastBacked = !forecasts.isEmpty();
            int confidence = forecastBacked ? computeConfidence(forecasts, forecastP50, forecastP90) : 0;
            String evidenceStatus = forecastBacked
                    ? (forecasts.size() >= HORIZON_MONTHS ? "FORECAST_BACKED" : "PARTIAL_FORECAST")
                    : "HISTORICAL_FALLBACK";

            profiles.put(materialId, new DemandProfile(
                    materialId,
                    material.getMaterialCode(),
                    requiredPallets,
                    activePick,
                    trend,
                    forecastP50,
                    forecastP90,
                    minStock,
                    stockoutRisk,
                    reclaimable,
                    currentBins,
                    confidence,
                    evidenceStatus,
                    buildRationale(trend, forecastP50, minStock, targetStock, targetSource,
                            requiredPallets, unitsPerPallet)));
        }
        return profiles;
    }

    public List<DemandProfile> listInsights(UUID warehouseId) {
        List<MaterialEntity> materials = materialRepository.findAll().stream()
                .filter(m -> m.getMaterialType() != null)
                .toList();
        Set<UUID> ids = materials.stream().map(MaterialEntity::getId).collect(Collectors.toSet());
        return buildProfiles(warehouseId, ids).values().stream()
                .sorted(Comparator
                        .comparing((DemandProfile p) -> p.demandTrend() == DemandTrend.RISING ? 0
                                : p.demandTrend() == DemandTrend.FALLING ? 1 : 2)
                        .thenComparing(DemandProfile::stockoutRiskScore, Comparator.reverseOrder())
                        .thenComparing(DemandProfile::forecastP50Units, Comparator.reverseOrder()))
                .toList();
    }

    private List<ForecastResultEntity> dedupeMonthly(List<ForecastResultEntity> rows) {
        Map<LocalDate, ForecastResultEntity> best = new LinkedHashMap<>();
        for (ForecastResultEntity row : rows) {
            best.putIfAbsent(row.getForecastPeriod(), row);
        }
        return new ArrayList<>(best.values());
    }

    private BigDecimal sumP50(List<ForecastResultEntity> forecasts) {
        return forecasts.stream()
                .map(ForecastResultEntity::getForecastP50)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumP90(List<ForecastResultEntity> forecasts, BigDecimal p50Fallback) {
        BigDecimal sum = forecasts.stream()
                .map(ForecastResultEntity::getForecastP90)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.compareTo(BigDecimal.ZERO) > 0 ? sum : p50Fallback.multiply(BigDecimal.valueOf(1.2));
    }

    private int resolveLeadTimeDays(UUID materialId, UUID warehouseId) {
        return inventoryRepository.findByMaterialIdAndWarehouseId(materialId, warehouseId).stream()
                .map(InventoryItemEntity::getLeadTimeDays)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(14);
    }

    private Map<UUID, Integer> countBinsByMaterial(UUID warehouseId, Collection<UUID> materialIds) {
        Map<UUID, Set<String>> bins = new HashMap<>();
        for (MaterialDefaultLocationEntity d : defaultLocationRepository.findByWarehouseId(warehouseId)) {
            if (materialIds.contains(d.getMaterialId()) && d.getLocationCode() != null) {
                bins.computeIfAbsent(d.getMaterialId(), k -> new HashSet<>()).add(d.getLocationCode());
            }
        }
        for (InventoryItemEntity inv : inventoryRepository.findByWarehouseId(warehouseId)) {
            if (materialIds.contains(inv.getMaterialId())
                    && inv.getLocationCode() != null
                    && inv.getQuantity() != null
                    && inv.getQuantity() > 0) {
                bins.computeIfAbsent(inv.getMaterialId(), k -> new HashSet<>()).add(inv.getLocationCode());
            }
        }
        Map<UUID, Integer> counts = new HashMap<>();
        bins.forEach((k, v) -> counts.put(k, v.size()));
        return counts;
    }

    private Map<UUID, Integer> sumOnHand(UUID warehouseId, Collection<UUID> materialIds) {
        Map<UUID, Integer> totals = new HashMap<>();
        for (InventoryItemEntity inv : inventoryRepository.findByWarehouseId(warehouseId)) {
            if (materialIds.contains(inv.getMaterialId()) && inv.getQuantity() != null) {
                totals.merge(inv.getMaterialId(), inv.getQuantity(), Integer::sum);
            }
        }
        return totals;
    }

    private Map<UUID, EffectiveStockTarget> effectiveStockTargets(
            UUID warehouseId, Collection<UUID> materialIds) {
        Map<UUID, EffectiveStockTarget> targets = new HashMap<>();
        for (InventoryItemEntity inv : inventoryRepository.findByWarehouseId(warehouseId)) {
            if (!materialIds.contains(inv.getMaterialId())) {
                continue;
            }
            BigDecimal minStock = inv.getMinStock() != null ? inv.getMinStock() : BigDecimal.ZERO;
            BigDecimal maxStock = inv.getMaxStock() != null ? inv.getMaxStock() : BigDecimal.ZERO;
            targets.merge(
                    inv.getMaterialId(),
                    new EffectiveStockTarget(minStock, maxStock),
                    (left, right) -> new EffectiveStockTarget(
                            left.minStock().max(right.minStock()),
                            left.maxStock().max(right.maxStock())));
        }
        return targets;
    }

    private int roundUpToMoqPallets(int pallets, int moqUnits, int unitsPerPallet) {
        if (moqUnits <= 0 || unitsPerPallet <= 0) {
            return Math.max(1, pallets);
        }
        int totalUnits = Math.max(pallets, 1) * unitsPerPallet;
        int roundedUnits = ((totalUnits + moqUnits - 1) / moqUnits) * moqUnits;
        return Math.max(1, (int) Math.ceil(roundedUnits / (double) unitsPerPallet));
    }

    private DemandTrend classifyTrend(BigDecimal forward, long pastHalfYear) {
        double forwardVal = forward.doubleValue();
        double pastVal = Math.max(1, pastHalfYear);
        double ratio = forwardVal / pastVal;
        if (ratio >= 1.15) {
            return DemandTrend.RISING;
        }
        if (ratio <= 0.85) {
            return DemandTrend.FALLING;
        }
        return DemandTrend.STABLE;
    }

    private double computeStockoutRisk(int onHand, BigDecimal minStock, DemandTrend trend,
                                       int currentBins, int requiredBins) {
        double min = minStock.doubleValue();
        if (min <= 0) {
            return trend == DemandTrend.FALLING && currentBins > requiredBins ? 0.6 : 0.1;
        }
        double coverage = onHand / min;
        if (coverage < 1.0) {
            return 0.95;
        }
        if (trend == DemandTrend.FALLING && currentBins > requiredBins + 2) {
            return Math.min(0.85, 0.3 + (currentBins - requiredBins) * 0.08);
        }
        if (trend == DemandTrend.RISING && coverage < 1.5) {
            return 0.55;
        }
        return Math.max(0.05, 1.0 / coverage);
    }

    private int computeConfidence(List<ForecastResultEntity> forecasts, BigDecimal p50, BigDecimal p90) {
        if (forecasts.isEmpty() || p50.compareTo(BigDecimal.ZERO) <= 0) {
            return 45;
        }
        double width = p90.subtract(p50).abs().doubleValue() / Math.max(1, p50.doubleValue());
        int base = (int) Math.round(100 - width * 40);
        return Math.max(35, Math.min(95, base));
    }

    private String buildRationale(DemandTrend trend, BigDecimal forecast, BigDecimal minStock,
                                  BigDecimal targetStock, String targetSource,
                                  int pallets, int unitsPerPallet) {
        return String.format(
                "%s demand: 6m P50=%s units, min=%s, target=%s from %s, %d pallet pos @ %d u/pallet",
                trend.name().toLowerCase(),
                forecast.setScale(0, RoundingMode.HALF_UP),
                minStock.setScale(0, RoundingMode.HALF_UP),
                targetStock.setScale(0, RoundingMode.HALF_UP),
                targetSource,
                pallets,
                unitsPerPallet);
    }

    private record EffectiveStockTarget(BigDecimal minStock, BigDecimal maxStock) {}
}
