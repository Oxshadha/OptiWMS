package com.optiwms.coreapp.forecastspace;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.StockPlacementPlanner;
import com.optiwms.coreapp.slotting.SlottingPlanClient;
import com.optiwms.infra.forecastspace.*;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialDefaultLocationEntity;
import com.optiwms.infra.master.MaterialDefaultLocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;
import com.optiwms.infra.slotting.SlottingPlanLineRepository;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ForecastSpaceOptimizationService {
    private final SpaceOptimizationRunRepository runRepository;
    private final SpaceOptimizationLineRepository lineRepository;
    private final SpaceOptimizationScenarioRepository scenarioRepository;
    private final InventoryPolicyRecommendationRunRepository policyRunRepository;
    private final InventoryPolicyRecommendationLineRepository policyLineRepository;
    private final MaterialRepository materialRepository;
    private final InventoryItemRepository inventoryRepository;
    private final MaterialDefaultLocationRepository defaultLocationRepository;
    private final LocationRepository locationRepository;
    private final StockPlacementPlanner stockPlacementPlanner;
    private final HandlingUnitCapacityService capacityService;
    private final SlottingPlanClient slottingPlanClient;
    private final SlottingPlanRepository slottingPlanRepository;
    private final SlottingPlanLineRepository slottingPlanLineRepository;

    public ForecastSpaceOptimizationService(
            SpaceOptimizationRunRepository runRepository,
            SpaceOptimizationLineRepository lineRepository,
            SpaceOptimizationScenarioRepository scenarioRepository,
            InventoryPolicyRecommendationRunRepository policyRunRepository,
            InventoryPolicyRecommendationLineRepository policyLineRepository,
            MaterialRepository materialRepository,
            InventoryItemRepository inventoryRepository,
            MaterialDefaultLocationRepository defaultLocationRepository,
            LocationRepository locationRepository,
            StockPlacementPlanner stockPlacementPlanner,
            HandlingUnitCapacityService capacityService,
            SlottingPlanClient slottingPlanClient,
            SlottingPlanRepository slottingPlanRepository,
            SlottingPlanLineRepository slottingPlanLineRepository) {
        this.runRepository = runRepository;
        this.lineRepository = lineRepository;
        this.scenarioRepository = scenarioRepository;
        this.policyRunRepository = policyRunRepository;
        this.policyLineRepository = policyLineRepository;
        this.materialRepository = materialRepository;
        this.inventoryRepository = inventoryRepository;
        this.defaultLocationRepository = defaultLocationRepository;
        this.locationRepository = locationRepository;
        this.stockPlacementPlanner = stockPlacementPlanner;
        this.capacityService = capacityService;
        this.slottingPlanClient = slottingPlanClient;
        this.slottingPlanRepository = slottingPlanRepository;
        this.slottingPlanLineRepository = slottingPlanLineRepository;
    }

    @Transactional
    public SpaceOptimizationRunEntity createRun(CreateSpaceRunRequest request) {
        InventoryPolicyRecommendationRunEntity policyRun = policyRunRepository.findById(request.policyRunId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Policy run not found"));
        if (!"APPROVED".equals(policyRun.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Inventory policy run must be approved before space optimization");
        }

        SpaceOptimizationRunEntity run = new SpaceOptimizationRunEntity();
        run.setWarehouseId(policyRun.getWarehouseId());
        run.setPolicyRunId(policyRun.getId());
        run.setHorizonMonths(policyRun.getHorizonMonths());
        run.setAlgorithm("PENDING_OPTIMIZER");
        run.setRelocationCapPct(relocationCapPct(policyRun.getHorizonMonths()));
        run.setCreatedBy(request.createdBy());
        run.setNotes(request.notes());
        run = runRepository.save(run);

        UUID warehouseId = policyRun.getWarehouseId();
        List<InventoryPolicyRecommendationLineEntity> policyLines =
                policyLineRepository.findByRunIdOrderByMaterialCodeAsc(policyRun.getId()).stream()
                        .filter(line -> "APPROVED".equals(line.getRecommendationStatus())
                                || (Boolean.TRUE.equals(line.getManagerOverride())
                                && line.getOverrideReason() != null
                                && !line.getOverrideReason().isBlank()))
                        .toList();
        if (policyLines.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "No approved policy lines are eligible for space optimization");
        }
        Map<UUID, MaterialEntity> materials = materialRepository.findAllById(
                policyLines.stream().map(InventoryPolicyRecommendationLineEntity::getMaterialId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(MaterialEntity::getId, m -> m));
        List<ReleasedSpace> releasePool = buildReleasePool(warehouseId, policyLines);

        List<SpaceOptimizationLineEntity> savedLines = new ArrayList<>();

        for (InventoryPolicyRecommendationLineEntity policyLine : policyLines) {
            MaterialEntity material = materials.get(policyLine.getMaterialId());
            if (material == null) {
                continue;
            }
            SpaceOptimizationLineEntity line = buildLine(run.getId(), warehouseId, policyLine, material, releasePool);
            line = lineRepository.save(line);
            savedLines.add(line);
            createScenario(line);
        }

        run.setRelocationCapSkus(Math.max(1, BigDecimal.valueOf(policyLines.size())
                .multiply(run.getRelocationCapPct() != null ? run.getRelocationCapPct() : BigDecimal.valueOf(15))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR)
                .intValue()));
        OptimizerOutcome optimizerOutcome = applyPythonOptimizerIfAvailable(run, savedLines, policyLines, materials);
        savedLines = lineRepository.findByRunIdOrderByMaterialCodeAsc(run.getId());
        BigDecimal saved = BigDecimal.ZERO;
        BigDecimal needed = BigDecimal.ZERO;
        BigDecimal distance = BigDecimal.ZERO;
        int infeasible = 0;
        int highRisk = 0;
        for (SpaceOptimizationLineEntity line : savedLines) {
            saved = saved.add(nz(line.getSpaceSavedPalletPositions()));
            needed = needed.add(nz(line.getSpaceNeededPalletPositions()));
            distance = distance.add(nz(line.getDistanceSavedMeters()));
            if ("INFEASIBLE".equals(line.getRecommendationStatus())) {
                infeasible++;
            }
            if ("HIGH_RISK_REVIEW".equals(line.getRecommendationStatus())) {
                highRisk++;
            }
        }
        run.setTotalSpaceSavedPalletPositions(saved.setScale(2, RoundingMode.HALF_UP));
        run.setTotalSpaceNeededPalletPositions(needed.setScale(2, RoundingMode.HALF_UP));
        run.setTotalDistanceSavedMeters(distance.setScale(2, RoundingMode.HALF_UP));
        run.setObjectiveValue(optimizerOutcome.objectiveValue() != null
                ? optimizerOutcome.objectiveValue()
                : saved.add(distance).subtract(needed).setScale(4, RoundingMode.HALF_UP));
        run.setAlgorithm(optimizerOutcome.algorithm());
        run.setOptimizerMetadata(optimizerOutcome.metadataJson());
        run.setInfeasibleCount(infeasible);
        run.setHighRiskCount(highRisk);
        run.setStatus("PENDING_APPROVAL");
        return runRepository.save(run);
    }

    public List<SpaceOptimizationRunEntity> listRuns(UUID warehouseId) {
        return runRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId);
    }

    public SpaceOptimizationRunEntity getRun(UUID runId) {
        return runRepository.findById(runId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Space run not found"));
    }

    public List<SpaceOptimizationLineEntity> getLines(UUID runId) {
        getRun(runId);
        return lineRepository.findByRunIdOrderByMaterialCodeAsc(runId);
    }

    public List<SpaceOptimizationScenarioEntity> getScenariosForSpaceLine(UUID lineId) {
        return scenarioRepository.findBySpaceLineId(lineId);
    }

    @Transactional
    public SpaceOptimizationRunEntity approveRun(UUID runId, String approvedBy) {
        SpaceOptimizationRunEntity run = getRun(runId);
        SlottingPlanEntity draftPlan = createDraftSlottingPlan(run, approvedBy);
        run.setStatus("APPROVED");
        run.setApprovedBy(approvedBy);
        run.setApprovedAt(OffsetDateTime.now());
        run.setNotes(appendNote(run.getNotes(), "Draft slotting plan created: " + draftPlan.getPlanCode()));
        return runRepository.save(run);
    }

    private SlottingPlanEntity createDraftSlottingPlan(SpaceOptimizationRunEntity run, String createdBy) {
        List<SpaceOptimizationLineEntity> spaceLines = lineRepository.findByRunIdOrderByMaterialCodeAsc(run.getId())
                .stream()
                .filter(line -> !"INFEASIBLE".equals(line.getRecommendationStatus())
                        && !"DATA_INSUFFICIENT".equals(line.getRecommendationStatus())
                        && Boolean.TRUE.equals(line.getCompatible()))
                .toList();
        if (spaceLines.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No feasible space recommendations to convert to a slotting plan");
        }

        Set<UUID> policyLineIds = spaceLines.stream()
                .map(SpaceOptimizationLineEntity::getSourcePolicyLineId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, InventoryPolicyRecommendationLineEntity> policyById = policyLineRepository.findAllById(policyLineIds)
                .stream()
                .collect(Collectors.toMap(InventoryPolicyRecommendationLineEntity::getId, p -> p));

        LocalDate today = LocalDate.now();
        SlottingPlanEntity plan = new SlottingPlanEntity();
        plan.setWarehouseId(run.getWarehouseId());
        plan.setPlanCode(resolveSlottingPlanCode(run.getWarehouseId(), "FSO-" + today));
        plan.setValidFrom(today);
        plan.setValidTo(today.plusMonths(Math.max(1, run.getHorizonMonths() != null ? run.getHorizonMonths() : 3)));
        plan.setStatus("DRAFT");
        plan.setAlgorithm(run.getAlgorithm() != null ? run.getAlgorithm() : "JAVA_FEASIBLE_FALLBACK_V1");
        plan.setCreatedBy(createdBy);
        plan.setSourceStatsAt(OffsetDateTime.now());
        plan.setNotes("Generated from forecast-space optimization run " + run.getId());
        plan = slottingPlanRepository.save(plan);

        int moves = 0;
        int moveCap = run.getRelocationCapSkus() != null && run.getRelocationCapSkus() > 0
                ? run.getRelocationCapSkus()
                : Math.max(1, spaceLines.size());
        BigDecimal totalDistance = BigDecimal.ZERO;
        for (SpaceOptimizationLineEntity spaceLine : spaceLines.stream()
                .sorted(Comparator.comparing(this::lineObjectiveScore).reversed())
                .toList()) {
            InventoryPolicyRecommendationLineEntity policy = policyById.get(spaceLine.getSourcePolicyLineId());
            boolean relocation = spaceLine.getCurrentPrimaryLocationCode() != null
                    && spaceLine.getRecommendedPrimaryLocationCode() != null
                    && !spaceLine.getCurrentPrimaryLocationCode().equals(spaceLine.getRecommendedPrimaryLocationCode());
            boolean overMoveCap = relocation && moves >= moveCap;
            String finalLocation = overMoveCap
                    ? spaceLine.getCurrentPrimaryLocationCode()
                    : spaceLine.getRecommendedPrimaryLocationCode();

            SlottingPlanLineEntity planLine = new SlottingPlanLineEntity();
            planLine.setPlanId(plan.getId());
            planLine.setMaterialId(spaceLine.getMaterialId());
            planLine.setMaterialCode(spaceLine.getMaterialCode());
            planLine.setMaterialType(spaceLine.getMaterialType());
            planLine.setCurrentPrimaryLocationCode(spaceLine.getCurrentPrimaryLocationCode());
            planLine.setRecommendedPrimaryLocationCode(spaceLine.getRecommendedPrimaryLocationCode());
            planLine.setFinalPrimaryLocationCode(finalLocation);
            planLine.setActivePickPalletPositions(nzInt(spaceLine.getRequiredActivePickPalletPositions(), 1));
            planLine.setRequiredReservePalletPositions(nzInt(spaceLine.getRequiredReservePalletPositions(), 0));
            planLine.setMaxStockPalletPositions(maxStockPalletPositions(spaceLine));
            if (policy != null) {
                planLine.setRop(policy.getProposedReorderPoint());
                planLine.setMaxStock(policy.getProposedMaxStock());
            }
            planLine.setDistanceSavedMeters(nz(spaceLine.getDistanceSavedMeters()));
            planLine.setMoveReason(spaceLine.getRationale());
            planLine.setGainScore(nz(spaceLine.getSpaceSavedPalletPositions()).add(nz(spaceLine.getDistanceSavedMeters())));
            planLine.setRelocationFlag(relocation && !overMoveCap);
            planLine.setRelocationApplied(false);
            planLine.setObjectiveCost(planLine.getGainScore());
            planLine.setStatus(overMoveCap ? "KEPT_INCUMBENT" : "PROPOSED");
            planLine.setConstraintSnapshot(spaceLine.getConstraintSnapshot());
            slottingPlanLineRepository.save(planLine);

            if (relocation && !overMoveCap) moves++;
            if (!overMoveCap) {
                totalDistance = totalDistance.add(nz(spaceLine.getDistanceSavedMeters()));
            }
        }

        plan.setTotalMovesProposed(moves);
        plan.setRelocationMovesApplied(0);
        plan.setTotalDistanceSavedMeters(totalDistance.setScale(2, RoundingMode.HALF_UP));
        return slottingPlanRepository.save(plan);
    }

    private SpaceOptimizationLineEntity buildLine(
            UUID runId,
            UUID warehouseId,
            InventoryPolicyRecommendationLineEntity policyLine,
            MaterialEntity material,
            List<ReleasedSpace> releasePool) {
        SpaceOptimizationLineEntity line = new SpaceOptimizationLineEntity();
        line.setRunId(runId);
        line.setMaterialId(material.getId());
        line.setSourcePolicyLineId(policyLine.getId());
        line.setMaterialCode(material.getMaterialCode());
        line.setMaterialType(material.getMaterialType());

        String incumbent = currentPrimary(warehouseId, material.getId());
        line.setCurrentPrimaryLocationCode(incumbent);
        line.setRequiredActivePickPalletPositions(1);
        line.setRequiredReservePalletPositions(0);

        BigDecimal palletDelta = nz(policyLine.getPalletPositionsDelta());
        if (palletDelta.compareTo(BigDecimal.ZERO) < 0) {
            BigDecimal released = palletDelta.abs();
            line.setSpaceSavedPalletPositions(released);
            line.setSpaceNeededPalletPositions(BigDecimal.ZERO);
            line.setRecommendedPrimaryLocationCode(incumbent);
            line.setReleasedLocationCodes(releasedLocationsJson(warehouseId, material.getId(), released));
            line.setRecommendationStatus("APPLY_WITH_APPROVAL");
            line.setRationale("Forecast policy reduces stock and releases approximately "
                    + released.setScale(2, RoundingMode.HALF_UP) + " pallet positions.");
            line.setConstraintSnapshot(snapshot(material, "release_space"));
            return line;
        }

        if (palletDelta.compareTo(BigDecimal.ZERO) == 0) {
            line.setRecommendedPrimaryLocationCode(incumbent);
            line.setRecommendationStatus("SAFE_TO_APPLY");
            line.setRationale("No net space change required for this material.");
            line.setConstraintSnapshot(snapshot(material, "no_space_change"));
            return line;
        }

        int palletsNeeded = Math.max(1, palletDelta.setScale(0, RoundingMode.CEILING).intValue());
        int qtyPerPallet = capacityService.resolveUnitsPerPallet(material).setScale(0, RoundingMode.CEILING).intValue();
        List<StockPlacementPlanner.PlacementLine> recycled = allocateReleasedSpace(
                material,
                palletsNeeded,
                Math.max(1, qtyPerPallet),
                releasePool);
        int recycledPallets = recycled.stream().mapToInt(StockPlacementPlanner.PlacementLine::palletCount).sum();
        int remainingPalletsNeeded = Math.max(0, palletsNeeded - recycledPallets);
        StockPlacementPlanner.PlacementPlan placement = remainingPalletsNeeded == 0
                ? new StockPlacementPlanner.PlacementPlan(palletsNeeded, recycledPallets, 0, List.of(),
                        List.of("Forecast growth fully covered by released compatible space"))
                : stockPlacementPlanner.planPlacement(
                        warehouseId,
                        material.getId(),
                        estimateQuantityFromPalletDelta(BigDecimal.valueOf(remainingPalletsNeeded), material),
                        recycled.isEmpty() ? incumbent : recycled.get(0).locationCode(),
                        recycled.stream().map(StockPlacementPlanner.PlacementLine::locationCode).collect(Collectors.toSet()));
        List<StockPlacementPlanner.PlacementLine> combined = new ArrayList<>(recycled);
        combined.addAll(placement.lines());

        line.setSpaceNeededPalletPositions(palletDelta.setScale(2, RoundingMode.HALF_UP));
        line.setRequiredReservePalletPositions(Math.max(0, palletsNeeded - 1));
        line.setRecommendedReserveLocations(reserveJson(combined));
        if (!combined.isEmpty()) {
            line.setRecommendedPrimaryLocationCode(combined.get(0).locationCode());
        } else {
            line.setRecommendedPrimaryLocationCode(incumbent);
        }
        boolean feasible = remainingPalletsNeeded == 0 || placement.remainingPallets() <= 0;
        line.setCompatible(feasible);
        line.setRecommendationStatus(feasible ? "APPLY_WITH_APPROVAL" : "INFEASIBLE");
        String recycledText = recycledPallets > 0 ? " Reused " + recycledPallets + " released pallet position(s)." : "";
        line.setRationale(feasible
                ? "Compatible locations found for additional forecast-driven stock." + recycledText
                : "Insufficient compatible pallet positions for the proposed stock increase." + recycledText);
        line.setConstraintSnapshot(snapshot(material, feasible ? "placement_feasible" : "placement_infeasible"));
        return line;
    }

    private void createScenario(SpaceOptimizationLineEntity line) {
        SpaceOptimizationScenarioEntity scenario = new SpaceOptimizationScenarioEntity();
        scenario.setSpaceLineId(line.getId());
        scenario.setScenarioName("SPACE_COMPATIBILITY");
        scenario.setPassed(Boolean.TRUE.equals(line.getCompatible()));
        scenario.setRiskScore(Boolean.TRUE.equals(line.getCompatible()) ? BigDecimal.ZERO : BigDecimal.valueOf(85));
        scenario.setSpaceShortfallPalletPositions(Boolean.TRUE.equals(line.getCompatible())
                ? BigDecimal.ZERO : nz(line.getSpaceNeededPalletPositions()));
        scenario.setExplanation(Boolean.TRUE.equals(line.getCompatible())
                ? "Storage compatibility and capacity check passed."
                : "No compatible location capacity was found for this recommendation.");
        scenarioRepository.save(scenario);
    }

    private String currentPrimary(UUID warehouseId, UUID materialId) {
        Optional<String> configured = defaultLocationRepository.findByMaterialIdAndWarehouseId(materialId, warehouseId).stream()
                .filter(d -> d.getPriority() != null && d.getPriority() == 1)
                .map(MaterialDefaultLocationEntity::getLocationCode)
                .filter(Objects::nonNull)
                .findFirst();
        return configured.orElseGet(() -> selectInventoryPrimary(
                inventoryRepository.findByMaterialIdAndWarehouseId(materialId, warehouseId)));
    }

    static String selectInventoryPrimary(List<InventoryItemEntity> inventory) {
        if (inventory == null) {
            return null;
        }
        return inventory.stream()
                .filter(item -> item.getLocationCode() != null && !item.getLocationCode().isBlank())
                .filter(item -> item.getQuantity() != null && item.getQuantity() > 0)
                .max(Comparator.comparing(InventoryItemEntity::getQuantity))
                .map(InventoryItemEntity::getLocationCode)
                .orElse(null);
    }

    private List<ReleasedSpace> buildReleasePool(
            UUID warehouseId,
            List<InventoryPolicyRecommendationLineEntity> policyLines) {
        List<ReleasedSpace> pool = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (InventoryPolicyRecommendationLineEntity line : policyLines) {
            BigDecimal delta = nz(line.getPalletPositionsDelta());
            if (delta.compareTo(BigDecimal.ZERO) >= 0) {
                continue;
            }
            int positions = Math.max(1, delta.abs().setScale(0, RoundingMode.CEILING).intValue());
            inventoryRepository.findByMaterialIdAndWarehouseId(line.getMaterialId(), warehouseId).stream()
                    .filter(i -> i.getLocationCode() != null && i.getQuantity() != null && i.getQuantity() > 0)
                    .sorted(Comparator.comparing(InventoryItemEntity::getQuantity).reversed())
                    .limit(positions)
                    .forEach(item -> {
                        if (used.add(item.getLocationCode())) {
                            pool.add(new ReleasedSpace(item.getLocationCode(), line.getMaterialCode(), 1));
                        }
                    });
        }
        return pool;
    }

    private List<StockPlacementPlanner.PlacementLine> allocateReleasedSpace(
            MaterialEntity material,
            int palletsNeeded,
            int qtyPerPallet,
            List<ReleasedSpace> releasePool) {
        if (palletsNeeded <= 0 || releasePool == null || releasePool.isEmpty()) {
            return List.of();
        }
        List<StockPlacementPlanner.PlacementLine> allocated = new ArrayList<>();
        int remaining = palletsNeeded;
        for (ReleasedSpace released : releasePool) {
            if (remaining <= 0) {
                break;
            }
            if (released.remainingPallets <= 0) {
                continue;
            }
            LocationEntity location = locationRepository.findByLocationCode(released.locationCode).orElse(null);
            if (location == null || !Boolean.TRUE.equals(location.getIsActive())) {
                continue;
            }
            if (!capacityService.palletFitsBin(material, location)) {
                continue;
            }
            int palletsHere = Math.min(released.remainingPallets, remaining);
            released.remainingPallets -= palletsHere;
            remaining -= palletsHere;
            allocated.add(new StockPlacementPlanner.PlacementLine(
                    released.locationCode,
                    palletsHere,
                    palletsHere * qtyPerPallet,
                    capacityService.rackKey(location),
                    location.getLevelNumber()));
        }
        return allocated;
    }

    private String releasedLocationsJson(UUID warehouseId, UUID materialId, BigDecimal released) {
        List<String> codes = inventoryRepository.findByMaterialIdAndWarehouseId(materialId, warehouseId).stream()
                .filter(i -> i.getLocationCode() != null && i.getQuantity() != null && i.getQuantity() > 0)
                .sorted(Comparator.comparing(InventoryItemEntity::getQuantity).reversed())
                .limit(Math.max(1, released.setScale(0, RoundingMode.CEILING).intValue()))
                .map(InventoryItemEntity::getLocationCode)
                .toList();
        return toJsonArray(codes);
    }

    private String reserveJson(List<StockPlacementPlanner.PlacementLine> lines) {
        if (lines == null || lines.isEmpty()) {
            return "[]";
        }
        return lines.stream()
                .map(l -> String.format(Locale.ROOT,
                        "{\"location_code\":\"%s\",\"pallet_count\":%d,\"quantity_allocated\":%d}",
                        escape(l.locationCode()), l.palletCount(), l.quantityAllocated()))
                .collect(Collectors.joining(",", "[", "]"));
    }

    private String toJsonArray(List<String> values) {
        return values.stream()
                .map(v -> "\"" + escape(v) + "\"")
                .collect(Collectors.joining(",", "[", "]"));
    }

    private int estimateQuantityFromPalletDelta(BigDecimal palletDelta, MaterialEntity material) {
        BigDecimal unitsPerPallet = capacityService.resolveUnitsPerPallet(material);
        return Math.max(1, palletDelta.setScale(0, RoundingMode.CEILING).intValue())
                * Math.max(1, unitsPerPallet.setScale(0, RoundingMode.CEILING).intValue());
    }

    private String snapshot(MaterialEntity material, String status) {
        return String.format(Locale.ROOT,
                "{\"status\":\"%s\",\"storage_type\":\"%s\",\"pallet_spaces\":%s,\"weight_kg\":%s,\"volume_cm3\":%s}",
                escape(status),
                escape(material.getStorageType()),
                material.getPalletSpaces() != null ? material.getPalletSpaces() : BigDecimal.ZERO,
                material.getWeightKg() != null ? material.getWeightKg() : BigDecimal.ZERO,
                material.getVolumeCm3() != null ? material.getVolumeCm3() : BigDecimal.ZERO);
    }

    private BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private int nzInt(Integer value, int fallback) {
        return value != null ? value : fallback;
    }

    private int maxStockPalletPositions(SpaceOptimizationLineEntity line) {
        BigDecimal needed = nz(line.getSpaceNeededPalletPositions());
        BigDecimal saved = nz(line.getSpaceSavedPalletPositions());
        int computed = needed.max(saved).setScale(0, RoundingMode.CEILING).intValue();
        return Math.max(
                nzInt(line.getRequiredActivePickPalletPositions(), 1)
                        + nzInt(line.getRequiredReservePalletPositions(), 0),
                Math.max(1, computed));
    }

    private String resolveSlottingPlanCode(UUID warehouseId, String baseCode) {
        if (!slottingPlanRepository.existsByWarehouseIdAndPlanCode(warehouseId, baseCode)) {
            return baseCode;
        }
        int suffix = 2;
        while (suffix < 1000) {
            String candidate = baseCode + "-v" + suffix;
            if (!slottingPlanRepository.existsByWarehouseIdAndPlanCode(warehouseId, candidate)) {
                return candidate;
            }
            suffix++;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Could not allocate forecast-space slotting plan code");
    }

    private String appendNote(String current, String addition) {
        if (current == null || current.isBlank()) {
            return addition;
        }
        return current + "\n" + addition;
    }

    private OptimizerOutcome applyPythonOptimizerIfAvailable(
            SpaceOptimizationRunEntity run,
            List<SpaceOptimizationLineEntity> savedLines,
            List<InventoryPolicyRecommendationLineEntity> policyLines,
            Map<UUID, MaterialEntity> materials) {
        if (!slottingPlanClient.isEnabled()) {
            return fallbackOutcome(run, policyLines.size(), "slotting-service disabled");
        }
        if (!slottingPlanClient.isHealthy()) {
            return fallbackOutcome(run, policyLines.size(), "slotting-service health check failed");
        }

        SlottingPlanClient.PlanOptimizeRequest request = new SlottingPlanClient.PlanOptimizeRequest();
        request.warehouse_id = run.getWarehouseId().toString();
        request.relocation_budget_pct = run.getRelocationCapPct() != null ? run.getRelocationCapPct().doubleValue() : 30.0;
        request.use_milp_a_class = true;
        request.solver_engine = "ortools";
        request.locked_material_ids = List.of();

        Map<UUID, SpaceOptimizationLineEntity> linesByMaterial = savedLines.stream()
                .collect(Collectors.toMap(SpaceOptimizationLineEntity::getMaterialId, line -> line, (a, b) -> a));
        request.materials = new ArrayList<>();
        for (InventoryPolicyRecommendationLineEntity policyLine : policyLines) {
            MaterialEntity material = materials.get(policyLine.getMaterialId());
            SpaceOptimizationLineEntity spaceLine = linesByMaterial.get(policyLine.getMaterialId());
            if (material == null || spaceLine == null) {
                continue;
            }
            SlottingPlanClient.PlanMaterialPayload payload = new SlottingPlanClient.PlanMaterialPayload();
            payload.material_id = material.getId().toString();
            payload.material_code = material.getMaterialCode();
            payload.material_type = material.getMaterialType();
            payload.abc_class = material.getAbcClass() != null ? material.getAbcClass() : "C";
            payload.fms_class = material.getFmsClass() != null ? material.getFmsClass() : "S";
            payload.amalgamated_class = payload.abc_class + payload.fms_class;
            payload.issue_volume = policyLine.getForecastP50() != null ? policyLine.getForecastP50().doubleValue() : 0;
            payload.issue_count = 1;
            payload.weight_kg = material.getWeightKg() != null ? material.getWeightKg().doubleValue() : null;
            payload.volume_cm3 = material.getVolumeCm3() != null ? material.getVolumeCm3().doubleValue() : null;
            payload.pallet_spaces = capacityService.resolvePalletFootprintSpaces(material).doubleValue();
            BigDecimal palletWeightKg = capacityService.resolvePalletWeightKg(material);
            payload.pallet_weight_kg = palletWeightKg.compareTo(BigDecimal.ZERO) > 0
                    ? palletWeightKg.doubleValue() : null;
            payload.temperature_controlled = Boolean.TRUE.equals(material.getTemperatureControlled());
            payload.hazardous = Boolean.TRUE.equals(material.getHazardous());
            payload.fragile = Boolean.TRUE.equals(material.getFragile());
            payload.stackable = !Boolean.FALSE.equals(material.getStackable());
            payload.forecast_demand = policyLine.getForecastP50() != null
                    ? policyLine.getForecastP50().doubleValue() : null;
            payload.incumbent_primary_location_code = spaceLine.getCurrentPrimaryLocationCode();
            payload.locked = false;
            payload.required_pallets = Math.max(1, nz(policyLine.getPalletPositionsDelta()).abs().setScale(0, RoundingMode.CEILING).intValue());
            payload.demand_trend = nz(policyLine.getStockDelta()).compareTo(BigDecimal.ZERO) >= 0 ? "RISING" : "FALLING";
            payload.min_stock_units = policyLine.getProposedMinStock() != null ? policyLine.getProposedMinStock().doubleValue() : null;
            request.materials.add(payload);
        }

        request.locations = locationRepository.findByWarehouseIdAndIsActive(run.getWarehouseId(), true).stream()
                .filter(loc -> loc.getLocationCode() != null && !loc.getLocationCode().isBlank())
                .filter(loc -> isOptimizerStorageZone(loc.getZoneType()))
                .map(loc -> {
                    SlottingPlanClient.PlanLocationPayload payload = new SlottingPlanClient.PlanLocationPayload();
                    payload.location_id = loc.getId().toString();
                    payload.location_code = loc.getLocationCode();
                    payload.amalgamated_class = loc.getAmalgamatedClass();
                    payload.area = loc.getArea();
                    payload.level_number = loc.getLevelNumber() != null ? loc.getLevelNumber() : 1;
                    payload.accessibility_rating = loc.getAccessibilityRating() != null ? loc.getAccessibilityRating() : 3;
                    payload.coordinate_x = loc.getCoordinateX() != null ? loc.getCoordinateX().doubleValue() : 0;
                    payload.coordinate_y = loc.getCoordinateY() != null ? loc.getCoordinateY().doubleValue() : 0;
                    payload.max_weight_kg = loc.getMaxWeightKg() != null ? loc.getMaxWeightKg().doubleValue() : null;
                    payload.max_volume_cm3 = loc.getMaxVolumeCm3() != null ? loc.getMaxVolumeCm3().doubleValue() : null;
                    payload.capacity = loc.getCapacity() != null ? loc.getCapacity().doubleValue() : null;
                    payload.max_pallet_capacity = loc.getMaxPalletCapacity();
                    payload.current_pallet_count = loc.getCurrentPalletCount() != null ? loc.getCurrentPalletCount() : 0;
                    payload.temperature_zone = loc.getTemperatureZone();
                    payload.hazard_allowed = Boolean.TRUE.equals(loc.getHazardAllowed());
                    payload.is_active = Boolean.TRUE.equals(loc.getIsActive());
                    return payload;
                })
                .toList();

        Optional<SlottingPlanClient.PlanOptimizeResponse> response = slottingPlanClient.optimize(request);
        if (response.isEmpty()) {
            return fallbackOutcome(run, policyLines.size(), "slotting-service returned no plan");
        }

        SlottingPlanClient.PlanOptimizeResponse py = response.get();
        if (py.algorithm == null || !py.algorithm.toUpperCase(Locale.ROOT).startsWith("ORTOOLS_MILP_V")
                || py.assignments == null || py.assignments.isEmpty()) {
            return new OptimizerOutcome(
                    "JAVA_FEASIBLE_FALLBACK_V1",
                    null,
                    optimizerMetadata(run, policyLines.size(), 0, "FALLBACK", py.infeasible_reason != null ? py.infeasible_reason : "OR-Tools did not return assignments"));
        }

        Map<String, SlottingPlanClient.PlanAssignmentPayload> assignments = py.assignments.stream()
                .collect(Collectors.toMap(a -> a.material_id, a -> a, (a, b) -> a));
        List<SpaceOptimizationLineEntity> updates = new ArrayList<>();
        for (SpaceOptimizationLineEntity line : savedLines) {
            SlottingPlanClient.PlanAssignmentPayload assignment = assignments.get(line.getMaterialId().toString());
            if (assignment == null) {
                continue;
            }
            line.setRecommendedPrimaryLocationCode(assignment.final_primary_location_code != null
                    ? assignment.final_primary_location_code
                    : assignment.recommended_primary_location_code);
            line.setRequiredActivePickPalletPositions(assignment.active_pick_pallet_positions);
            line.setRequiredReservePalletPositions(assignment.required_reserve_pallet_positions);
            line.setDistanceSavedMeters(BigDecimal.valueOf(assignment.distance_saved_meters).setScale(2, RoundingMode.HALF_UP));
            line.setRecommendedReserveLocations(reserveJsonFromPython(assignment.reserve_locations));
            line.setCompatible(true);
            line.setRecommendationStatus("APPLY_WITH_APPROVAL");
            line.setRationale(assignment.move_reason != null ? assignment.move_reason : "OR-Tools MILP assignment selected by slotting-service.");
            line.setConstraintSnapshot("{\"engine\":\"" + escape(py.algorithm) + "\",\"status\":\"" + escape(py.solver_status) + "\"}");
            updates.add(line);
        }
        lineRepository.saveAll(updates);
        return new OptimizerOutcome(
                py.algorithm,
                py.objective_value != null ? BigDecimal.valueOf(py.objective_value).setScale(4, RoundingMode.HALF_UP) : null,
                optimizerMetadata(run, policyLines.size(), 0, py.solver_status, py.infeasible_reason));
    }

    static boolean isOptimizerStorageZone(String zoneType) {
        if (zoneType == null || zoneType.isBlank()) {
            return true;
        }
        return Set.of("STORAGE", "PICK_FACE", "RESERVE").contains(zoneType.trim().toUpperCase(Locale.ROOT));
    }

    private OptimizerOutcome fallbackOutcome(SpaceOptimizationRunEntity run, int skuCount, String reason) {
        return new OptimizerOutcome(
                "JAVA_FEASIBLE_FALLBACK_V1",
                null,
                optimizerMetadata(run, skuCount, 0, "FALLBACK", reason));
    }

    private String reserveJsonFromPython(List<SlottingPlanClient.PlanReservePayload> reserves) {
        if (reserves == null || reserves.isEmpty()) {
            return "[]";
        }
        return reserves.stream()
                .map(r -> String.format(Locale.ROOT,
                        "{\"locationCode\":\"%s\",\"palletPositions\":%d,\"zoneHint\":\"%s\"}",
                        escape(r.location_code),
                        Math.max(0, r.reserve_pallet_positions),
                        escape(r.reserve_zone_hint)))
                .collect(Collectors.joining(",", "[", "]"));
    }

    private BigDecimal lineObjectiveScore(SpaceOptimizationLineEntity line) {
        return nz(line.getSpaceSavedPalletPositions())
                .add(nz(line.getDistanceSavedMeters()))
                .subtract(nz(line.getSpaceNeededPalletPositions()))
                .subtract(nz(line.getMoveCostScore()));
    }

    private BigDecimal relocationCapPct(Integer horizonMonths) {
        if (horizonMonths != null && horizonMonths >= 6) {
            return BigDecimal.valueOf(30);
        }
        if (horizonMonths != null && horizonMonths >= 3) {
            return BigDecimal.valueOf(15);
        }
        return BigDecimal.valueOf(5);
    }

    private String optimizerMetadata(SpaceOptimizationRunEntity run, int skuCount, int infeasibleCount, String solverStatus, String fallbackReason) {
        String engine = "FALLBACK".equalsIgnoreCase(solverStatus) ? "JAVA_FEASIBLE_FALLBACK_V1" : "ORTOOLS_MILP_V2";
        return String.format(Locale.ROOT,
                "{\"engine\":\"%s\",\"solver_status\":\"%s\",\"fallbackReason\":\"%s\",\"objective\":\"service_gain + travel_saving + released_space_reuse - relocation_cost - holding_cost - risk_penalties\",\"relocation_cap_pct\":%s,\"relocation_cap_skus\":%d,\"candidate_skus\":%d,\"infeasible_skus\":%d,\"constraints\":[\"one_primary_pick_per_sku\",\"location_pallet_capacity\",\"rack_weight_capacity\",\"rack_volume_capacity\",\"material_zone_compatibility\",\"abc_fms_class_fit\",\"expiry_safe_max\",\"moq_order_multiple\",\"move_count_cap\"]}",
                engine,
                escape(solverStatus),
                escape(fallbackReason),
                run.getRelocationCapPct() != null ? run.getRelocationCapPct().stripTrailingZeros().toPlainString() : "0",
                run.getRelocationCapSkus() != null ? run.getRelocationCapSkus() : 0,
                skuCount,
                infeasibleCount);
    }

    private String escape(String raw) {
        return raw == null ? "" : raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static final class ReleasedSpace {
        private final String locationCode;
        private final String sourceMaterialCode;
        private int remainingPallets;

        private ReleasedSpace(String locationCode, String sourceMaterialCode, int remainingPallets) {
            this.locationCode = locationCode;
            this.sourceMaterialCode = sourceMaterialCode;
            this.remainingPallets = remainingPallets;
        }
    }

    private record OptimizerOutcome(String algorithm, BigDecimal objectiveValue, String metadataJson) {}

    public record CreateSpaceRunRequest(UUID policyRunId, String createdBy, String notes) {}
}
