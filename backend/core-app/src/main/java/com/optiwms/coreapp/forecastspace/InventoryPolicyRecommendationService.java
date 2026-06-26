package com.optiwms.coreapp.forecastspace;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.infra.forecast.ForecastResultEntity;
import com.optiwms.infra.forecast.ForecastResultRepository;
import com.optiwms.infra.forecastspace.*;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.SupplierConstraintEntity;
import com.optiwms.infra.master.SupplierConstraintRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InventoryPolicyRecommendationService {
    private static final BigDecimal DEFAULT_HOLDING_COST_RATE = new BigDecimal("0.18");
    private static final BigDecimal Z_95 = new BigDecimal("1.65");
    private static final BigDecimal DAYS_PER_MONTH = new BigDecimal("30");

    private final InventoryPolicyRecommendationRunRepository runRepository;
    private final InventoryPolicyRecommendationLineRepository lineRepository;
    private final SpaceOptimizationScenarioRepository scenarioRepository;
    private final ForecastResultRepository forecastRepository;
    private final InventoryItemRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final SupplierConstraintRepository supplierConstraintRepository;
    private final HandlingUnitCapacityService capacityService;

    public InventoryPolicyRecommendationService(
            InventoryPolicyRecommendationRunRepository runRepository,
            InventoryPolicyRecommendationLineRepository lineRepository,
            SpaceOptimizationScenarioRepository scenarioRepository,
            ForecastResultRepository forecastRepository,
            InventoryItemRepository inventoryRepository,
            MaterialRepository materialRepository,
            SupplierConstraintRepository supplierConstraintRepository,
            HandlingUnitCapacityService capacityService) {
        this.runRepository = runRepository;
        this.lineRepository = lineRepository;
        this.scenarioRepository = scenarioRepository;
        this.forecastRepository = forecastRepository;
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.supplierConstraintRepository = supplierConstraintRepository;
        this.capacityService = capacityService;
    }

    @Transactional
    public InventoryPolicyRecommendationRunEntity createRun(CreatePolicyRunRequest request) {
        int horizon = normalizeHorizon(request.horizonMonths());
        UUID warehouseId = request.warehouseId();

        InventoryPolicyRecommendationRunEntity run = new InventoryPolicyRecommendationRunEntity();
        run.setWarehouseId(warehouseId);
        run.setHorizonMonths(horizon);
        run.setForecastModelName(request.forecastModelName());
        run.setForecastRunId(request.forecastRunId());
        run.setCreatedBy(request.createdBy());
        run.setNotes(request.notes());
        run = runRepository.save(run);

        LocalDate today = LocalDate.now();
        LocalDate horizonEnd = today.plusMonths(horizon);
        Map<UUID, List<ForecastResultEntity>> forecasts = forecastRepository
                .findForecastsForWarehouse(warehouseId, today, horizonEnd)
                .stream()
                .collect(Collectors.groupingBy(ForecastResultEntity::getMaterialId));

        Map<UUID, List<InventoryItemEntity>> inventory = inventoryRepository.findByWarehouseId(warehouseId)
                .stream()
                .filter(i -> i.getMaterialId() != null)
                .collect(Collectors.groupingBy(InventoryItemEntity::getMaterialId));

        List<MaterialEntity> materials = materialRepository.findAll().stream()
                .filter(m -> request.materialType() == null
                        || normalizeType(request.materialType()).equals(normalizeType(m.getMaterialType())))
                .toList();

        BigDecimal totalStockDelta = BigDecimal.ZERO;
        BigDecimal totalPalletDelta = BigDecimal.ZERO;
        BigDecimal totalCostDelta = BigDecimal.ZERO;
        int highRisk = 0;
        int dataInsufficient = 0;

        for (MaterialEntity material : materials) {
            List<InventoryItemEntity> stockRows = inventory.getOrDefault(material.getId(), List.of());
            if (stockRows.isEmpty() && !forecasts.containsKey(material.getId())) {
                continue;
            }
            InventoryPolicyRecommendationLineEntity line = buildLine(
                    run.getId(),
                    warehouseId,
                    material,
                    stockRows,
                    forecasts.getOrDefault(material.getId(), List.of()),
                    horizon);
            line = lineRepository.save(line);
            createScenarios(line);

            totalStockDelta = totalStockDelta.add(nz(line.getStockDelta()));
            totalPalletDelta = totalPalletDelta.add(nz(line.getPalletPositionsDelta()));
            totalCostDelta = totalCostDelta.add(nz(line.getHoldingCostDelta()));
            if ("HIGH_RISK_REVIEW".equals(line.getRecommendationStatus())) {
                highRisk++;
            }
            if ("DATA_INSUFFICIENT".equals(line.getRecommendationStatus())) {
                dataInsufficient++;
            }
        }

        run.setTotalStockDelta(totalStockDelta.setScale(2, RoundingMode.HALF_UP));
        run.setTotalPalletPositionsDelta(totalPalletDelta.setScale(2, RoundingMode.HALF_UP));
        run.setEstimatedHoldingCostDelta(totalCostDelta.setScale(2, RoundingMode.HALF_UP));
        run.setHighRiskCount(highRisk);
        run.setDataInsufficientCount(dataInsufficient);
        run.setStatus("PENDING_APPROVAL");
        return runRepository.save(run);
    }

    public ForecastSpaceReadiness readiness(UUID warehouseId, String materialType, Integer horizonMonths) {
        int horizon = normalizeHorizon(horizonMonths);
        LocalDate today = LocalDate.now();
        LocalDate horizonEnd = today.plusMonths(horizon);
        String requestedType = materialType != null && !materialType.isBlank() ? normalizeType(materialType) : null;

        List<MaterialEntity> materials = materialRepository.findAll().stream()
                .filter(m -> requestedType == null || requestedType.equals(normalizeType(m.getMaterialType())))
                .toList();
        Set<UUID> materialIds = materials.stream().map(MaterialEntity::getId).collect(Collectors.toSet());

        Set<UUID> forecastedMaterials = forecastRepository
                .findForecastsForWarehouse(warehouseId, today, horizonEnd)
                .stream()
                .map(ForecastResultEntity::getMaterialId)
                .filter(materialIds::contains)
                .collect(Collectors.toSet());

        Map<UUID, List<InventoryItemEntity>> inventory = inventoryRepository.findByWarehouseId(warehouseId)
                .stream()
                .filter(i -> i.getMaterialId() != null && materialIds.contains(i.getMaterialId()))
                .collect(Collectors.groupingBy(InventoryItemEntity::getMaterialId));

        int missingPalletSpecs = 0;
        int missingMoq = 0;
        int missingLeadTime = 0;
        for (MaterialEntity material : materials) {
            if (material.getPalletSpaces() == null || material.getPalletSpaces().compareTo(BigDecimal.ZERO) <= 0) {
                missingPalletSpecs++;
            }

            List<InventoryItemEntity> stockRows = inventory.getOrDefault(material.getId(), List.of());
            BigDecimal moq = material.getMinOrderQuantity() != null
                    ? material.getMinOrderQuantity()
                    : first(stockRows, InventoryItemEntity::getMoq);
            if (moq == null || moq.compareTo(BigDecimal.ZERO) <= 0) {
                missingMoq++;
            }
            boolean hasLeadTime = stockRows.stream().anyMatch(i -> i.getLeadTimeDays() != null && i.getLeadTimeDays() > 0);
            if (!hasLeadTime) {
                missingLeadTime++;
            }
        }

        int materialsTotal = materials.size();
        int forecastCoveragePct = pct(forecastedMaterials.size(), materialsTotal);
        int inventoryCoveragePct = pct(inventory.size(), materialsTotal);
        int palletSpecCoveragePct = pct(materialsTotal - missingPalletSpecs, materialsTotal);
        boolean ready = materialsTotal > 0
                && forecastCoveragePct >= 70
                && inventoryCoveragePct >= 70
                && palletSpecCoveragePct >= 80
                && missingLeadTime <= Math.max(3, materialsTotal / 4);

        List<String> blockers = new ArrayList<>();
        if (materialsTotal == 0) blockers.add("No materials found for the selected scope.");
        if (forecastCoveragePct < 70) blockers.add("Forecast coverage is below 70% for the selected horizon.");
        if (inventoryCoveragePct < 70) blockers.add("Inventory coverage is below 70% for the selected warehouse.");
        if (palletSpecCoveragePct < 80) blockers.add("Pallet-space coverage is below 80%; space impact will be unreliable.");
        if (missingLeadTime > Math.max(3, materialsTotal / 4)) blockers.add("Lead-time data is missing for too many materials.");

        return new ForecastSpaceReadiness(
                warehouseId,
                horizon,
                requestedType,
                materialsTotal,
                forecastedMaterials.size(),
                forecastCoveragePct,
                inventory.size(),
                inventoryCoveragePct,
                missingPalletSpecs,
                palletSpecCoveragePct,
                missingMoq,
                missingLeadTime,
                ready,
                blockers);
    }

    public List<InventoryPolicyRecommendationRunEntity> listRuns(UUID warehouseId) {
        return runRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId);
    }

    public InventoryPolicyRecommendationRunEntity getRun(UUID runId) {
        return runRepository.findById(runId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Policy run not found"));
    }

    public List<InventoryPolicyRecommendationLineEntity> getLines(UUID runId) {
        getRun(runId);
        return lineRepository.findByRunIdOrderByMaterialCodeAsc(runId);
    }

    public List<SpaceOptimizationScenarioEntity> getScenariosForPolicyLine(UUID lineId) {
        return scenarioRepository.findByPolicyLineId(lineId);
    }

    @Transactional
    public InventoryPolicyRecommendationRunEntity approveRun(UUID runId, String approvedBy) {
        InventoryPolicyRecommendationRunEntity run = getRun(runId);
        List<InventoryPolicyRecommendationLineEntity> lines = lineRepository.findByRunIdOrderByMaterialCodeAsc(runId);
        List<InventoryItemEntity> updatedInventory = new ArrayList<>();
        List<InventoryPolicyRecommendationLineEntity> updatedLines = new ArrayList<>();

        for (InventoryPolicyRecommendationLineEntity line : lines) {
            if (Set.of("INFEASIBLE", "DATA_INSUFFICIENT", "REJECTED").contains(line.getRecommendationStatus())) {
                continue;
            }
            List<InventoryItemEntity> stockRows = inventoryRepository.findByMaterialIdAndWarehouseId(
                    line.getMaterialId(),
                    run.getWarehouseId());
            for (InventoryItemEntity item : stockRows) {
                item.setMinStock(line.getProposedMinStock());
                item.setMaxStock(line.getProposedMaxStock());
                item.setReorderPoint(line.getProposedReorderPoint());
                item.setBufferStock(line.getProposedMinStock());
                item.setOrderQuantity(line.getProposedOrderQty());
                item.setPalletRequirement(line.getPalletPositionsDelta() != null
                        ? line.getPalletPositionsDelta().abs()
                        : item.getPalletRequirement());
                updatedInventory.add(item);
            }
            line.setRecommendationStatus("APPROVED");
            updatedLines.add(line);
        }
        inventoryRepository.saveAll(updatedInventory);
        lineRepository.saveAll(updatedLines);
        run.setStatus("APPROVED");
        run.setApprovedBy(approvedBy);
        run.setApprovedAt(OffsetDateTime.now());
        return runRepository.save(run);
    }

    private InventoryPolicyRecommendationLineEntity buildLine(
            UUID runId,
            UUID warehouseId,
            MaterialEntity material,
            List<InventoryItemEntity> stockRows,
            List<ForecastResultEntity> forecastRows,
            int horizonMonths) {
        InventoryPolicyRecommendationLineEntity line = new InventoryPolicyRecommendationLineEntity();
        line.setRunId(runId);
        line.setMaterialId(material.getId());
        line.setMaterialCode(material.getMaterialCode());
        line.setMaterialType(normalizeType(material.getMaterialType()));

        BigDecimal current = sum(stockRows, InventoryItemEntity::getQuantity);
        BigDecimal available = sum(stockRows, InventoryItemEntity::getAvailableQuantity);
        line.setCurrentStock(current);
        line.setCurrentAvailableStock(available);
        line.setCurrentMinStock(first(stockRows, InventoryItemEntity::getMinStock));
        line.setCurrentMaxStock(first(stockRows, InventoryItemEntity::getMaxStock));
        line.setCurrentReorderPoint(first(stockRows, InventoryItemEntity::getReorderPoint));

        ForecastAggregate forecast = aggregateForecasts(forecastRows);
        line.setForecastP10(forecast.p10());
        line.setForecastP50(forecast.p50());
        line.setForecastP90(forecast.p90());

        int leadTimeDays = stockRows.stream()
                .map(InventoryItemEntity::getLeadTimeDays)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(14);
        line.setLeadTimeDays(leadTimeDays);

        SupplierPolicy supplier = supplierPolicy(material, stockRows);
        line.setMoq(supplier.moq());
        line.setOrderMultiple(supplier.orderMultiple());
        line.setUnitCost(supplier.unitCost());
        line.setLeadTimeStdDays(supplier.leadTimeStdDays());

        if (forecastRows.isEmpty()) {
            line.setRecommendationStatus("DATA_INSUFFICIENT");
            line.setConfidenceScore(score(25));
            line.setStockoutRiskScore(score(50));
            line.setExpiryRiskScore(score(0));
            line.setRationale("No forecast found for this material in the selected horizon.");
            line.setConstraintSnapshot(snapshot(material, supplier, "missing_forecast"));
            return line;
        }
        if (material.getPalletSpaces() == null || material.getPalletSpaces().compareTo(BigDecimal.ZERO) <= 0) {
            line.setRecommendationStatus("DATA_INSUFFICIENT");
            line.setConfidenceScore(score(35));
            line.setStockoutRiskScore(score(40));
            line.setExpiryRiskScore(score(0));
            line.setRationale("Material is missing units-per-pallet/pallet_spaces, so pallet-space impact cannot be trusted.");
            line.setConstraintSnapshot(snapshot(material, supplier, "missing_pallet_specs"));
            return line;
        }

        BigDecimal dailyP50 = safeDivide(forecast.p50(), BigDecimal.valueOf(Math.max(horizonMonths * 30L, 1)));
        BigDecimal dailySpread = safeDivide(forecast.p90().subtract(forecast.p10()).abs(), BigDecimal.valueOf(2.56 * Math.max(horizonMonths * 30L, 1)));
        BigDecimal leadTime = BigDecimal.valueOf(leadTimeDays);
        BigDecimal leadDemand = dailyP50.multiply(leadTime);
        BigDecimal safetyStock = Z_95.multiply(sqrt(leadTime.multiply(dailySpread.pow(2))));
        if (safetyStock.compareTo(BigDecimal.ZERO) == 0 && material.getSafetyStockLevel() != null) {
            safetyStock = material.getSafetyStockLevel();
        }

        BigDecimal proposedRop = leadDemand.add(safetyStock).setScale(2, RoundingMode.HALF_UP);
        BigDecimal proposedMin = safetyStock.max(material.getSafetyStockLevel() != null ? material.getSafetyStockLevel() : BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal proposedTarget = forecast.p50().add(proposedMin).setScale(2, RoundingMode.HALF_UP);
        BigDecimal proposedMax = forecast.p90().add(proposedMin).setScale(2, RoundingMode.HALF_UP);

        BigDecimal expiryCap = expiryLimitedMax(stockRows, dailyP50);
        line.setExpiryLimitedMaxStock(expiryCap);
        if (expiryCap != null && expiryCap.compareTo(BigDecimal.ZERO) > 0) {
            proposedMax = proposedMax.min(expiryCap).max(proposedRop);
            proposedTarget = proposedTarget.min(proposedMax);
        }

        BigDecimal orderQty = proposedTarget.subtract(available).max(BigDecimal.ZERO);
        orderQty = applyMoqAndMultiple(orderQty, supplier.moq(), supplier.orderMultiple());

        BigDecimal currentTarget = line.getCurrentMaxStock() != null ? line.getCurrentMaxStock() : current;
        BigDecimal stockDelta = proposedMax.subtract(currentTarget).setScale(2, RoundingMode.HALF_UP);
        BigDecimal palletDelta = palletPositions(stockDelta, material);
        BigDecimal holdingDelta = stockDelta.multiply(supplier.unitCost()).multiply(DEFAULT_HOLDING_COST_RATE)
                .setScale(2, RoundingMode.HALF_UP);

        line.setProposedMinStock(proposedMin);
        line.setProposedMaxStock(proposedMax.setScale(2, RoundingMode.HALF_UP));
        line.setProposedReorderPoint(proposedRop);
        line.setProposedTargetStock(proposedTarget);
        line.setProposedOrderQty(orderQty.setScale(2, RoundingMode.HALF_UP));
        line.setStockDelta(stockDelta);
        line.setPalletPositionsDelta(palletDelta);
        line.setHoldingCostDelta(holdingDelta);

        BigDecimal stockoutRisk = stockoutRisk(available, proposedRop, forecast.p90(), forecast.p50());
        BigDecimal expiryRisk = expiryRisk(expiryCap, proposedMax);
        BigDecimal confidence = confidence(forecastRows, material, supplier);
        line.setStockoutRiskScore(stockoutRisk);
        line.setExpiryRiskScore(expiryRisk);
        line.setConfidenceScore(confidence);
        line.setRecommendationStatus(status(stockoutRisk, expiryRisk, confidence, stockDelta));
        line.setRationale(rationale(stockDelta, palletDelta, supplier, expiryCap, forecast));
        line.setConstraintSnapshot(snapshot(material, supplier, "ok"));
        return line;
    }

    private void createScenarios(InventoryPolicyRecommendationLineEntity line) {
        scenarioRepository.save(scenario(line.getId(), "BASE_P50", true, line.getStockoutRiskScore(),
                "Base case uses p50 demand and proposed reorder point."));
        boolean highDemandPass = nz(line.getCurrentAvailableStock()).compareTo(nz(line.getProposedReorderPoint())) >= 0
                || nz(line.getProposedOrderQty()).compareTo(BigDecimal.ZERO) > 0;
        scenarioRepository.save(scenario(line.getId(), "HIGH_DEMAND_P90", highDemandPass, line.getStockoutRiskScore(),
                highDemandPass ? "High demand scenario is covered by ROP/order recommendation."
                        : "High demand scenario may breach reorder point before replenishment."));
        boolean expiryPass = line.getExpiryRiskScore() == null || line.getExpiryRiskScore().compareTo(score(70)) < 0;
        scenarioRepository.save(scenario(line.getId(), "EXPIRY_CAP", expiryPass, line.getExpiryRiskScore(),
                expiryPass ? "Expiry cap does not create a high-risk excess." : "Proposed max stock conflicts with expiry-safe stock."));
    }

    private SpaceOptimizationScenarioEntity scenario(UUID policyLineId, String name, boolean passed, BigDecimal risk, String explanation) {
        SpaceOptimizationScenarioEntity scenario = new SpaceOptimizationScenarioEntity();
        scenario.setPolicyLineId(policyLineId);
        scenario.setScenarioName(name);
        scenario.setPassed(passed);
        scenario.setRiskScore(risk != null ? risk : BigDecimal.ZERO);
        scenario.setExplanation(explanation);
        return scenario;
    }

    private ForecastAggregate aggregateForecasts(List<ForecastResultEntity> rows) {
        BigDecimal p10 = BigDecimal.ZERO;
        BigDecimal p50 = BigDecimal.ZERO;
        BigDecimal p90 = BigDecimal.ZERO;
        Set<LocalDate> seen = new HashSet<>();
        for (ForecastResultEntity row : rows) {
            if (row.getForecastPeriod() == null || !seen.add(row.getForecastPeriod())) {
                continue;
            }
            p50 = p50.add(nz(row.getForecastP50()));
            p10 = p10.add(row.getForecastP10() != null ? row.getForecastP10() : nz(row.getForecastP50()).multiply(new BigDecimal("0.8")));
            p90 = p90.add(row.getForecastP90() != null ? row.getForecastP90() : nz(row.getForecastP50()).multiply(new BigDecimal("1.2")));
        }
        return new ForecastAggregate(p10, p50, p90);
    }

    private SupplierPolicy supplierPolicy(MaterialEntity material, List<InventoryItemEntity> stockRows) {
        List<SupplierConstraintEntity> constraints = supplierConstraintRepository.findByMaterialId(material.getId()).stream()
                .filter(c -> !Boolean.FALSE.equals(c.getIsActive()))
                .toList();
        BigDecimal moq = material.getMinOrderQuantity() != null ? material.getMinOrderQuantity() : first(stockRows, InventoryItemEntity::getMoq);
        BigDecimal unitCost = BigDecimal.ONE;
        BigDecimal leadStd = BigDecimal.ZERO;
        if (!constraints.isEmpty()) {
            SupplierConstraintEntity primary = constraints.get(0);
            if (primary.getMinOrderQty() != null) moq = BigDecimal.valueOf(primary.getMinOrderQty());
            if (primary.getUnitPrice() != null && primary.getUnitPrice() > 0) unitCost = BigDecimal.valueOf(primary.getUnitPrice());
            if (primary.getLeadTimeStdDevDays() != null) leadStd = BigDecimal.valueOf(primary.getLeadTimeStdDevDays());
        }
        if (moq == null || moq.compareTo(BigDecimal.ZERO) <= 0) moq = BigDecimal.ONE;
        return new SupplierPolicy(moq, BigDecimal.ONE, unitCost, leadStd);
    }

    private BigDecimal expiryLimitedMax(List<InventoryItemEntity> stockRows, BigDecimal dailyDemand) {
        if (dailyDemand == null || dailyDemand.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        LocalDate today = LocalDate.now();
        Optional<LocalDate> nearest = stockRows.stream()
                .map(InventoryItemEntity::getExpiryDate)
                .filter(Objects::nonNull)
                .filter(d -> !d.isBefore(today))
                .min(LocalDate::compareTo);
        if (nearest.isEmpty()) {
            return null;
        }
        long days = Math.max(0, ChronoUnit.DAYS.between(today, nearest.get()));
        return dailyDemand.multiply(BigDecimal.valueOf(days)).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal applyMoqAndMultiple(BigDecimal qty, BigDecimal moq, BigDecimal multiple) {
        if (qty.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal adjusted = qty.max(moq != null ? moq : BigDecimal.ONE);
        BigDecimal step = multiple != null && multiple.compareTo(BigDecimal.ZERO) > 0 ? multiple : BigDecimal.ONE;
        BigDecimal steps = adjusted.divide(step, 0, RoundingMode.CEILING);
        return steps.multiply(step);
    }

    private BigDecimal palletPositions(BigDecimal stockDelta, MaterialEntity material) {
        if (stockDelta == null || stockDelta.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal unitsPerPallet = capacityService.resolveUnitsPerPallet(material);
        return stockDelta.divide(unitsPerPallet, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal stockoutRisk(BigDecimal available, BigDecimal rop, BigDecimal p90, BigDecimal p50) {
        if (available == null || rop == null || rop.compareTo(BigDecimal.ZERO) <= 0) {
            return score(50);
        }
        BigDecimal gap = rop.subtract(available);
        BigDecimal uncertainty = p90.subtract(p50).abs();
        BigDecimal raw = gap.max(BigDecimal.ZERO).divide(rop, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(70))
                .add(uncertainty.divide(p50.max(BigDecimal.ONE), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(30)));
        return clamp(raw);
    }

    private BigDecimal expiryRisk(BigDecimal expiryCap, BigDecimal proposedMax) {
        if (expiryCap == null || proposedMax == null || expiryCap.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal excess = proposedMax.subtract(expiryCap).max(BigDecimal.ZERO);
        return clamp(excess.divide(expiryCap, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)));
    }

    private BigDecimal confidence(List<ForecastResultEntity> forecastRows, MaterialEntity material, SupplierPolicy supplier) {
        int score = 45;
        if (forecastRows.size() >= 3) score += 20;
        if (material.getPalletSpaces() != null && material.getPalletSpaces().compareTo(BigDecimal.ZERO) > 0) score += 15;
        if (supplier.moq().compareTo(BigDecimal.ONE) > 0) score += 5;
        if (supplier.leadTimeStdDays().compareTo(BigDecimal.ZERO) > 0) score += 5;
        if (material.getWeightKg() != null && material.getVolumeCm3() != null) score += 10;
        return score(Math.min(score, 100));
    }

    private String status(BigDecimal stockoutRisk, BigDecimal expiryRisk, BigDecimal confidence, BigDecimal stockDelta) {
        if (confidence.compareTo(score(45)) < 0) return "DATA_INSUFFICIENT";
        if (expiryRisk.compareTo(score(80)) >= 0) return "INFEASIBLE";
        if (stockoutRisk.compareTo(score(70)) >= 0 || expiryRisk.compareTo(score(60)) >= 0) return "HIGH_RISK_REVIEW";
        if (stockDelta.abs().compareTo(BigDecimal.ZERO) == 0) return "SAFE_TO_APPLY";
        return "APPLY_WITH_APPROVAL";
    }

    private String rationale(BigDecimal stockDelta, BigDecimal palletDelta, SupplierPolicy supplier,
                             BigDecimal expiryCap, ForecastAggregate forecast) {
        String direction = stockDelta.compareTo(BigDecimal.ZERO) < 0 ? "reduce buffer" : "increase/retain stock";
        String expiry = expiryCap != null ? ", expiry cap applied" : "";
        return String.format(
                "Forecast p50=%s, p90=%s; recommendation is to %s by %s units (%s pallet positions). MOQ=%s%s.",
                forecast.p50().setScale(0, RoundingMode.HALF_UP),
                forecast.p90().setScale(0, RoundingMode.HALF_UP),
                direction,
                stockDelta.abs().setScale(0, RoundingMode.HALF_UP),
                palletDelta.abs().setScale(2, RoundingMode.HALF_UP),
                supplier.moq().setScale(0, RoundingMode.HALF_UP),
                expiry);
    }

    private String snapshot(MaterialEntity material, SupplierPolicy supplier, String status) {
        return String.format(Locale.ROOT,
                "{\"status\":\"%s\",\"storage_type\":\"%s\",\"requires_pallet\":%s,\"pallet_spaces\":%s,\"moq\":%s,\"lead_time_std_days\":%s}",
                escape(status),
                escape(material.getStorageType()),
                Boolean.TRUE.equals(material.getRequiresPallet()),
                material.getPalletSpaces() != null ? material.getPalletSpaces() : BigDecimal.ZERO,
                supplier.moq(),
                supplier.leadTimeStdDays());
    }

    private int normalizeHorizon(Integer horizon) {
        if (horizon == null) return 3;
        return Set.of(1, 3, 6, 12).contains(horizon) ? horizon : 3;
    }

    private int pct(int numerator, int denominator) {
        if (denominator <= 0) return 0;
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 0, RoundingMode.HALF_UP)
                .intValue();
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) return "raw_material";
        String t = type.toLowerCase(Locale.ROOT);
        if (t.equals("packing_material") || t.equals("packaging")) return "packaging_material";
        if (t.equals("fg") || t.equals("finished_good")) return "product";
        return t;
    }

    private BigDecimal sqrt(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(Math.sqrt(value.doubleValue()));
    }

    private BigDecimal safeDivide(BigDecimal a, BigDecimal b) {
        if (a == null || b == null || b.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return a.divide(b, 8, RoundingMode.HALF_UP);
    }

    private BigDecimal clamp(BigDecimal value) {
        if (value.compareTo(BigDecimal.ZERO) < 0) return BigDecimal.ZERO;
        if (value.compareTo(BigDecimal.valueOf(100)) > 0) return BigDecimal.valueOf(100);
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal score(int value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal nz(BigDecimal value) { return value != null ? value : BigDecimal.ZERO; }

    private BigDecimal sum(List<InventoryItemEntity> rows, java.util.function.Function<InventoryItemEntity, Integer> fn) {
        return rows.stream().map(fn).filter(Objects::nonNull).map(BigDecimal::valueOf).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal first(List<InventoryItemEntity> rows, java.util.function.Function<InventoryItemEntity, BigDecimal> fn) {
        return rows.stream().map(fn).filter(Objects::nonNull).findFirst().orElse(null);
    }

    private String escape(String raw) {
        return raw == null ? "" : raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public record CreatePolicyRunRequest(
            UUID warehouseId,
            Integer horizonMonths,
            String materialType,
            String forecastModelName,
            String forecastRunId,
            String createdBy,
            String notes) {}

    public record ForecastSpaceReadiness(
            UUID warehouseId,
            Integer horizonMonths,
            String materialType,
            Integer materialsTotalCount,
            Integer forecastedMaterialsCount,
            Integer forecastCoveragePct,
            Integer inventoryMaterialsCount,
            Integer inventoryCoveragePct,
            Integer missingPalletSpecsCount,
            Integer palletSpecCoveragePct,
            Integer missingMoqCount,
            Integer missingLeadTimeCount,
            Boolean ready,
            List<String> blockers) {}

    private record ForecastAggregate(BigDecimal p10, BigDecimal p50, BigDecimal p90) {}
    private record SupplierPolicy(BigDecimal moq, BigDecimal orderMultiple, BigDecimal unitCost, BigDecimal leadTimeStdDays) {}
}
