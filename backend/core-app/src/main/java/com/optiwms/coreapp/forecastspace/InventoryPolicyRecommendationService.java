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
import com.optiwms.infra.master.SupplierMaterialEntity;
import com.optiwms.infra.master.SupplierMaterialRepository;
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
    private final SupplierMaterialRepository supplierMaterialRepository;
    private final HandlingUnitCapacityService capacityService;

    public InventoryPolicyRecommendationService(
            InventoryPolicyRecommendationRunRepository runRepository,
            InventoryPolicyRecommendationLineRepository lineRepository,
            SpaceOptimizationScenarioRepository scenarioRepository,
            ForecastResultRepository forecastRepository,
            InventoryItemRepository inventoryRepository,
            MaterialRepository materialRepository,
            SupplierConstraintRepository supplierConstraintRepository,
            SupplierMaterialRepository supplierMaterialRepository,
            HandlingUnitCapacityService capacityService) {
        this.runRepository = runRepository;
        this.lineRepository = lineRepository;
        this.scenarioRepository = scenarioRepository;
        this.forecastRepository = forecastRepository;
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.supplierConstraintRepository = supplierConstraintRepository;
        this.supplierMaterialRepository = supplierMaterialRepository;
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

        Map<UUID, List<InventoryItemEntity>> inventory = summarizedInventoryByMaterial(warehouseId);

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

        Map<UUID, List<InventoryItemEntity>> inventory = summarizedInventoryByMaterial(warehouseId)
                .entrySet()
                .stream()
                .filter(entry -> materialIds.contains(entry.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        int missingPalletSpecs = 0;
        int missingMoq = 0;
        int missingLeadTime = 0;
        for (MaterialEntity material : materials) {
            if (material.getPalletSpaces() == null || material.getPalletSpaces().compareTo(BigDecimal.ZERO) <= 0) {
                missingPalletSpecs++;
            }

            List<InventoryItemEntity> stockRows = inventory.getOrDefault(material.getId(), List.of());
            SupplierPolicy supplier = supplierPolicy(material, stockRows);
            if (!supplier.hasMoqInput()) {
                missingMoq++;
            }
            if (!supplier.hasLeadTimeInput()) {
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
        if ("APPROVED".equals(run.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Policy run is already approved");
        }
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
            if (line.getApprovalSnapshot() == null || line.getApprovalSnapshot().isBlank()) {
                line.setApprovalSnapshot(approvalSnapshot(stockRows));
            }
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

    @Transactional
    public InventoryPolicyRecommendationRunEntity rollbackRun(UUID runId, String rolledBackBy) {
        InventoryPolicyRecommendationRunEntity run = getRun(runId);
        if (!"APPROVED".equals(run.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only approved policy runs can be rolled back");
        }
        List<InventoryPolicyRecommendationLineEntity> lines = lineRepository.findByRunIdOrderByMaterialCodeAsc(runId);
        List<InventoryItemEntity> updatedInventory = new ArrayList<>();
        List<InventoryPolicyRecommendationLineEntity> updatedLines = new ArrayList<>();
        for (InventoryPolicyRecommendationLineEntity line : lines) {
            if (!"APPROVED".equals(line.getRecommendationStatus())) {
                continue;
            }
            List<InventoryItemEntity> stockRows = inventoryRepository.findByMaterialIdAndWarehouseId(
                    line.getMaterialId(),
                    run.getWarehouseId());
            for (InventoryItemEntity item : stockRows) {
                item.setMinStock(line.getCurrentMinStock());
                item.setMaxStock(line.getCurrentMaxStock());
                item.setReorderPoint(line.getCurrentReorderPoint());
                item.setBufferStock(line.getCurrentBufferStock());
                item.setOrderQuantity(line.getCurrentOrderQty());
                item.setPalletRequirement(line.getCurrentPalletRequirement());
                updatedInventory.add(item);
            }
            line.setRecommendationStatus("APPLY_WITH_APPROVAL");
            updatedLines.add(line);
        }
        inventoryRepository.saveAll(updatedInventory);
        lineRepository.saveAll(updatedLines);
        run.setStatus("ROLLED_BACK");
        run.setApprovedBy(rolledBackBy);
        run.setNotes(appendNote(run.getNotes(), "Rolled back approved stock rules by " + rolledBackBy));
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
        line.setCurrentBufferStock(first(stockRows, InventoryItemEntity::getBufferStock));
        line.setCurrentOrderQty(first(stockRows, InventoryItemEntity::getOrderQuantity));
        line.setCurrentPalletRequirement(first(stockRows, InventoryItemEntity::getPalletRequirement));

        ForecastAggregate forecast = aggregateForecasts(forecastRows);
        line.setForecastP10(forecast.p10());
        line.setForecastP50(forecast.p50());
        line.setForecastP90(forecast.p90());

        SupplierPolicy supplier = supplierPolicy(material, stockRows);
        int leadTimeDays = supplier.leadTimeDays() != null && supplier.leadTimeDays() > 0
                ? supplier.leadTimeDays()
                : 14;
        line.setLeadTimeDays(leadTimeDays);

        line.setMoq(supplier.moq());
        line.setOrderMultiple(supplier.orderMultiple());
        line.setUnitsPerHandlingUnit(supplier.unitsPerHandlingUnit());
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

        BigDecimal horizonDays = BigDecimal.valueOf(Math.max(horizonMonths * 30L, 1));
        BigDecimal dailyP50 = safeDivide(forecast.p50(), horizonDays);
        BigDecimal dailySpread = safeDivide(forecast.p90().subtract(forecast.p10()).abs(), BigDecimal.valueOf(2 * 1.2816).multiply(horizonDays));
        BigDecimal leadTime = BigDecimal.valueOf(leadTimeDays);
        BigDecimal leadDemand = dailyP50.multiply(leadTime);
        BigDecimal leadTimeVariance = supplier.leadTimeStdDays().pow(2).multiply(dailyP50.pow(2));
        BigDecimal demandVariance = leadTime.multiply(dailySpread.pow(2));
        BigDecimal safetyStock = Z_95.multiply(sqrt(demandVariance.add(leadTimeVariance)));
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
        BigDecimal confidence = confidence(forecastRows, material, supplier, stockoutRisk, expiryRisk);
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
        SupplierMaterialEntity supplierRule = supplierMaterialRepository.findByMaterialId(material.getId()).stream()
                .sorted(Comparator
                        .comparing((SupplierMaterialEntity link) -> Boolean.TRUE.equals(link.getPreferred())).reversed()
                        .thenComparing(SupplierMaterialEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(SupplierMaterialEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .findFirst()
                .orElse(null);

        BigDecimal inventoryMoq = first(stockRows, InventoryItemEntity::getMoq);
        Integer inventoryLeadTime = stockRows.stream()
                .map(InventoryItemEntity::getLeadTimeDays)
                .filter(Objects::nonNull)
                .filter(days -> days > 0)
                .findFirst()
                .orElse(null);

        BigDecimal providedMoq = firstPositiveOrNull(
                supplierRule != null ? supplierRule.getMinimumOrderQuantity() : null,
                !constraints.isEmpty() && constraints.get(0).getMinOrderQty() != null ? BigDecimal.valueOf(constraints.get(0).getMinOrderQty()) : null,
                material.getMinOrderQuantity(),
                inventoryMoq);
        BigDecimal providedUnitsPerHandlingUnit = firstPositiveOrNull(
                supplierRule != null ? supplierRule.getUnitsPerHandlingUnit() : null,
                material.getUnitsPerHandlingUnit());
        BigDecimal providedOrderMultiple = firstPositiveOrNull(
                supplierRule != null ? supplierRule.getOrderMultiple() : null,
                material.getOrderMultiple(),
                providedUnitsPerHandlingUnit);
        Integer leadTimeDays = firstPositiveInteger(
                supplierRule != null ? supplierRule.getLeadTimeDays() : null,
                inventoryLeadTime);
        BigDecimal moq = providedMoq != null ? providedMoq : BigDecimal.ONE;
        BigDecimal unitsPerHandlingUnit = providedUnitsPerHandlingUnit != null ? providedUnitsPerHandlingUnit : BigDecimal.ONE;
        BigDecimal orderMultiple = providedOrderMultiple != null ? providedOrderMultiple : unitsPerHandlingUnit;
        String source = supplierRule != null
                ? Boolean.TRUE.equals(supplierRule.getPreferred()) ? "preferred_supplier_material" : "supplier_material"
                : "material_inventory";
        BigDecimal unitCost = BigDecimal.ONE;
        BigDecimal leadStd = BigDecimal.ZERO;
        if (!constraints.isEmpty()) {
            SupplierConstraintEntity primary = constraints.get(0);
            if (primary.getUnitPrice() != null && primary.getUnitPrice() > 0) unitCost = BigDecimal.valueOf(primary.getUnitPrice());
            if (primary.getLeadTimeStdDevDays() != null) leadStd = BigDecimal.valueOf(primary.getLeadTimeStdDevDays());
            if (supplierRule == null) {
                source = "supplier_constraint_material_inventory";
            }
        }
        return new SupplierPolicy(
                moq,
                orderMultiple,
                unitsPerHandlingUnit,
                leadTimeDays,
                unitCost,
                leadStd,
                source,
                providedMoq != null,
                leadTimeDays != null);
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

    private BigDecimal confidence(
            List<ForecastResultEntity> forecastRows,
            MaterialEntity material,
            SupplierPolicy supplier,
            BigDecimal stockoutRisk,
            BigDecimal expiryRisk) {
        BigDecimal forecastBacktest = BigDecimal.valueOf(Math.min(100, 45 + forecastRows.size() * 12L));
        BigDecimal intervalCoverage = forecastRows.stream().anyMatch(row -> row.getForecastP10() != null && row.getForecastP90() != null)
                ? BigDecimal.valueOf(90)
                : BigDecimal.valueOf(60);
        BigDecimal dataCompleteness = BigDecimal.ZERO;
        if (material.getPalletSpaces() != null && material.getPalletSpaces().compareTo(BigDecimal.ZERO) > 0) dataCompleteness = dataCompleteness.add(BigDecimal.valueOf(25));
        if (supplier.hasMoqInput()) dataCompleteness = dataCompleteness.add(BigDecimal.valueOf(20));
        if (supplier.hasLeadTimeInput()) dataCompleteness = dataCompleteness.add(BigDecimal.valueOf(20));
        if (supplier.leadTimeStdDays().compareTo(BigDecimal.ZERO) > 0) dataCompleteness = dataCompleteness.add(BigDecimal.valueOf(10));
        if (material.getWeightKg() != null) dataCompleteness = dataCompleteness.add(BigDecimal.valueOf(10));
        if (material.getVolumeCm3() != null) dataCompleteness = dataCompleteness.add(BigDecimal.valueOf(10));
        if (material.getStorageType() != null && !material.getStorageType().isBlank()) dataCompleteness = dataCompleteness.add(BigDecimal.valueOf(5));
        BigDecimal feasibility = BigDecimal.valueOf(100).subtract(expiryRisk.multiply(new BigDecimal("0.8"))).max(BigDecimal.ZERO);
        BigDecimal stability = BigDecimal.valueOf(100).subtract(stockoutRisk.multiply(new BigDecimal("0.5"))).max(BigDecimal.ZERO);
        BigDecimal recency = BigDecimal.valueOf(95);
        return forecastBacktest.multiply(new BigDecimal("0.35"))
                .add(intervalCoverage.multiply(new BigDecimal("0.20")))
                .add(dataCompleteness.min(BigDecimal.valueOf(100)).multiply(new BigDecimal("0.15")))
                .add(feasibility.multiply(new BigDecimal("0.15")))
                .add(stability.multiply(new BigDecimal("0.10")))
                .add(recency.multiply(new BigDecimal("0.05")))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private String status(BigDecimal stockoutRisk, BigDecimal expiryRisk, BigDecimal confidence, BigDecimal stockDelta) {
        if (confidence.compareTo(score(45)) < 0) return "DATA_INSUFFICIENT";
        if (expiryRisk.compareTo(score(80)) >= 0) return "INFEASIBLE";
        if (stockoutRisk.compareTo(score(70)) >= 0 || expiryRisk.compareTo(score(60)) >= 0) return "HIGH_RISK_REVIEW";
        if (stockDelta.abs().compareTo(BigDecimal.ZERO) == 0 && confidence.compareTo(score(90)) >= 0) return "SAFE_TO_APPLY";
        if (confidence.compareTo(score(90)) < 0) return "HIGH_RISK_REVIEW";
        return "APPLY_WITH_APPROVAL";
    }

    private String rationale(BigDecimal stockDelta, BigDecimal palletDelta, SupplierPolicy supplier,
                             BigDecimal expiryCap, ForecastAggregate forecast) {
        String direction = stockDelta.compareTo(BigDecimal.ZERO) < 0 ? "reduce buffer" : "increase/retain stock";
        String expiry = expiryCap != null ? ", expiry cap applied" : "";
        return String.format(
                "Forecast p50=%s, p90=%s; recommendation is to %s by %s units (%s pallet positions). MOQ=%s, multiple=%s, units/HU=%s, lead time=%s days%s.",
                forecast.p50().setScale(0, RoundingMode.HALF_UP),
                forecast.p90().setScale(0, RoundingMode.HALF_UP),
                direction,
                stockDelta.abs().setScale(0, RoundingMode.HALF_UP),
                palletDelta.abs().setScale(2, RoundingMode.HALF_UP),
                supplier.moq().setScale(0, RoundingMode.HALF_UP),
                supplier.orderMultiple().setScale(0, RoundingMode.HALF_UP),
                supplier.unitsPerHandlingUnit().setScale(0, RoundingMode.HALF_UP),
                supplier.leadTimeDays() != null ? supplier.leadTimeDays() : 14,
                expiry);
    }

    private String snapshot(MaterialEntity material, SupplierPolicy supplier, String status) {
        return String.format(Locale.ROOT,
                "{\"status\":\"%s\",\"storage_type\":\"%s\",\"requires_pallet\":%s,\"pallet_spaces\":%s,\"moq\":%s,\"order_multiple\":%s,\"units_per_handling_unit\":%s,\"lead_time_days\":%s,\"lead_time_std_days\":%s,\"rule_source\":\"%s\"}",
                escape(status),
                escape(material.getStorageType()),
                Boolean.TRUE.equals(material.getRequiresPallet()),
                material.getPalletSpaces() != null ? material.getPalletSpaces() : BigDecimal.ZERO,
                supplier.moq(),
                supplier.orderMultiple(),
                supplier.unitsPerHandlingUnit(),
                supplier.leadTimeDays() != null ? supplier.leadTimeDays() : 14,
                supplier.leadTimeStdDays(),
                escape(supplier.source()));
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

    private Map<UUID, List<InventoryItemEntity>> summarizedInventoryByMaterial(UUID warehouseId) {
        return inventoryRepository.summarizeByWarehouseId(warehouseId)
                .stream()
                .collect(Collectors.toMap(
                        InventoryItemRepository.InventoryMaterialSummary::getMaterialId,
                        summary -> List.of(toSummaryInventoryRow(warehouseId, summary)),
                        (left, right) -> left));
    }

    private InventoryItemEntity toSummaryInventoryRow(
            UUID warehouseId,
            InventoryItemRepository.InventoryMaterialSummary summary) {
        InventoryItemEntity row = new InventoryItemEntity();
        row.setWarehouseId(warehouseId);
        row.setMaterialId(summary.getMaterialId());
        row.setQuantity(toInt(summary.getQuantity()));
        row.setAvailableQuantity(toInt(summary.getAvailableQuantity()));
        row.setMinStock(summary.getMinStock());
        row.setMaxStock(summary.getMaxStock());
        row.setReorderPoint(summary.getReorderPoint());
        row.setBufferStock(summary.getBufferStock());
        row.setMoq(summary.getMoq());
        row.setLeadTimeDays(summary.getLeadTimeDays());
        row.setOrderQuantity(summary.getOrderQuantity());
        row.setPalletRequirement(summary.getPalletRequirement());
        row.setExpiryDate(summary.getExpiryDate());
        return row;
    }

    private String approvalSnapshot(List<InventoryItemEntity> stockRows) {
        if (stockRows == null || stockRows.isEmpty()) {
            return "[]";
        }
        return stockRows.stream()
                .map(row -> String.format(Locale.ROOT,
                        "{\"inventory_id\":\"%s\",\"location_code\":\"%s\",\"min_stock\":%s,\"max_stock\":%s,\"reorder_point\":%s,\"buffer_stock\":%s,\"order_quantity\":%s,\"pallet_requirement\":%s}",
                        row.getId(),
                        escape(row.getLocationCode()),
                        jsonNumber(row.getMinStock()),
                        jsonNumber(row.getMaxStock()),
                        jsonNumber(row.getReorderPoint()),
                        jsonNumber(row.getBufferStock()),
                        jsonNumber(row.getOrderQuantity()),
                        jsonNumber(row.getPalletRequirement())))
                .collect(Collectors.joining(",", "[", "]"));
    }

    private String jsonNumber(BigDecimal value) {
        return value != null ? value.stripTrailingZeros().toPlainString() : "null";
    }

    private String appendNote(String current, String addition) {
        if (current == null || current.isBlank()) {
            return addition;
        }
        return current + "\n" + addition;
    }

    private int toInt(BigDecimal value) {
        if (value == null) {
            return 0;
        }
        return value.setScale(0, RoundingMode.HALF_UP).intValue();
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

    private boolean isPositive(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0;
    }

    private BigDecimal firstPositive(BigDecimal... values) {
        BigDecimal value = firstPositiveOrNull(values);
        return value != null ? value : BigDecimal.ONE;
    }

    private BigDecimal firstPositiveOrNull(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (isPositive(value)) {
                return value;
            }
        }
        return null;
    }

    private Integer firstPositiveInteger(Integer... values) {
        for (Integer value : values) {
            if (value != null && value > 0) {
                return value;
            }
        }
        return null;
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
    private record SupplierPolicy(
            BigDecimal moq,
            BigDecimal orderMultiple,
            BigDecimal unitsPerHandlingUnit,
            Integer leadTimeDays,
            BigDecimal unitCost,
            BigDecimal leadTimeStdDays,
            String source,
            boolean hasMoqInput,
            boolean hasLeadTimeInput) {}
}
