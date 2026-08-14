package com.optiwms.coreapp.slotting;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import com.optiwms.coreapp.master.StockPlacementPlanner;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.MaterialDefaultLocationEntity;
import com.optiwms.infra.master.MaterialDefaultLocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.intelligence.PlanningCycleEntity;
import com.optiwms.infra.intelligence.PlanningCycleRepository;
import com.optiwms.infra.slotting.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SlottingPlanService {

    private final SlottingPlanRepository planRepository;
    private final SlottingPlanLineRepository lineRepository;
    private final SlottingPlanReserveLineRepository reserveLineRepository;
    private final MaterialIssueStatsService issueStatsService;
    private final MaterialIssueStatsRollupRepository rollupRepository;
    private final MaterialRepository materialRepository;
    private final LocationRepository locationRepository;
    private final MaterialDefaultLocationRepository defaultLocationRepository;
    private final MaterialDefaultLocationService defaultLocationService;
    private final SlottingPlanClient slottingPlanClient;
    private final SlottingReadinessService readinessService;
    private final HandlingUnitCapacityService handlingUnitCapacityService;
    private final StockPlacementPlanner stockPlacementPlanner;
    private final DemandSpacePlanningService demandSpacePlanningService;
    private final SlottingPlanExecutionService executionService;
    private final PlanningCycleRepository planningCycleRepository;

    public SlottingPlanService(
            SlottingPlanRepository planRepository,
            SlottingPlanLineRepository lineRepository,
            SlottingPlanReserveLineRepository reserveLineRepository,
            MaterialIssueStatsService issueStatsService,
            MaterialIssueStatsRollupRepository rollupRepository,
            MaterialRepository materialRepository,
            LocationRepository locationRepository,
            MaterialDefaultLocationRepository defaultLocationRepository,
            MaterialDefaultLocationService defaultLocationService,
            SlottingPlanClient slottingPlanClient,
            SlottingReadinessService readinessService,
            HandlingUnitCapacityService handlingUnitCapacityService,
            StockPlacementPlanner stockPlacementPlanner,
            DemandSpacePlanningService demandSpacePlanningService,
            SlottingPlanExecutionService executionService,
            PlanningCycleRepository planningCycleRepository) {
        this.planRepository = planRepository;
        this.lineRepository = lineRepository;
        this.reserveLineRepository = reserveLineRepository;
        this.issueStatsService = issueStatsService;
        this.rollupRepository = rollupRepository;
        this.materialRepository = materialRepository;
        this.locationRepository = locationRepository;
        this.defaultLocationRepository = defaultLocationRepository;
        this.defaultLocationService = defaultLocationService;
        this.slottingPlanClient = slottingPlanClient;
        this.readinessService = readinessService;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
        this.stockPlacementPlanner = stockPlacementPlanner;
        this.demandSpacePlanningService = demandSpacePlanningService;
        this.executionService = executionService;
        this.planningCycleRepository = planningCycleRepository;
    }

    @Transactional
    public SlottingPlanEntity createPlan(CreatePlanRequest request) {
        UUID warehouseId = request.warehouseId();
        readinessService.assertReady(warehouseId);
        OffsetDateTime statsAt = issueStatsService.refreshIfStale(warehouseId, Duration.ofHours(24));

        int months = request.validMonths() != null ? request.validMonths() : 6;
        LocalDate validFrom = request.validFrom() != null ? request.validFrom() : LocalDate.now();
        LocalDate validTo = validFrom.plusMonths(months);

        String planCode = request.planCode() != null
                ? request.planCode()
                : "SLOT-" + validFrom.getYear() + "-H" + ((validFrom.getMonthValue() - 1) / 6 + 1);

        planCode = resolveUniquePlanCode(warehouseId, planCode);

        PlanningCycleEntity cycle = new PlanningCycleEntity();
        cycle.setWarehouseId(warehouseId);
        cycle.setCreatedBy(request.createdBy());
        cycle.setCadence(months >= 3 ? "MAJOR_RESTRUCTURE" : "MONTHLY_SLOTTING");
        cycle.setLifecycleStatus("CALCULATING");
        cycle = planningCycleRepository.save(cycle);

        SlottingPlanEntity plan = new SlottingPlanEntity();
        plan.setWarehouseId(warehouseId);
        plan.setPlanningCycleId(cycle.getId());
        plan.setPlanCode(planCode);
        plan.setValidFrom(validFrom);
        plan.setValidTo(validTo);
        plan.setStatus("DRAFT");
        plan.setVersion(1);
        plan.setAlgorithm("HEURISTIC_MILP_V1");
        plan.setSolverStatus("NOT_RUN");
        plan.setRelocationBudgetPct(
                request.relocationBudgetPct() != null ? request.relocationBudgetPct() : new BigDecimal("30"));
        plan.setCreatedBy(request.createdBy());
        plan.setSourceStatsAt(statsAt);
        plan.setNotes(request.notes());
        plan = planRepository.save(plan);

        runOptimization(plan, Collections.emptySet(), Collections.emptyList(),
                request.useMilpAClass() == null || request.useMilpAClass());
        cycle.setLifecycleStatus("READY_FOR_REVIEW");
        planningCycleRepository.save(cycle);
        return planRepository.findById(plan.getId()).orElse(plan);
    }

    public SlottingPlanEntity getPlan(UUID planId) {
        return planRepository.findById(planId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan not found"));
    }

    public Optional<SlottingPlanEntity> getActivePlan(UUID warehouseId) {
        return planRepository.findFirstByWarehouseIdAndStatusOrderByApprovedAtDesc(warehouseId, "ACTIVE");
    }

    public List<SlottingPlanEntity> listPlans(UUID warehouseId) {
        return planRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId);
    }

    public List<SlottingPlanLineEntity> getLines(UUID planId) {
        getPlan(planId);
        return lineRepository.findByPlanIdOrderByMaterialCodeAsc(planId);
    }

    public List<SlottingPlanReserveLineEntity> getReserveLines(UUID planLineId) {
        return reserveLineRepository.findByPlanLineIdOrderBySequenceNoAsc(planLineId);
    }

    @Transactional
    public SlottingPlanLineEntity updateLine(UUID planId, UUID lineId, UpdateLineRequest request) {
        SlottingPlanEntity plan = getPlan(planId);
        assertEditable(plan, "PATCH lines");

        if (request.expectedVersion() != null && !request.expectedVersion().equals(plan.getVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan version mismatch");
        }

        SlottingPlanLineEntity line = lineRepository.findById(lineId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Line not found"));
        if (!line.getPlanId().equals(planId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Line does not belong to plan");
        }

        if (request.finalPrimaryLocationCode() != null) {
            line.setFinalPrimaryLocationCode(request.finalPrimaryLocationCode());
            line.setRecommendedPrimaryLocationCode(request.finalPrimaryLocationCode());
            line.setManagerOverride(true);
            line.setOverrideReason(request.overrideReason());
            line.setStatus("OVERRIDDEN");
        }
        if (request.locked() != null) {
            line.setLocked(request.locked());
        }
        return lineRepository.save(line);
    }

    @Transactional
    public SlottingPlanEntity reoptimize(UUID planId, ReoptimizeRequest request) {
        SlottingPlanEntity plan = getPlan(planId);
        if ("OPTIMIZING".equals(plan.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan is already optimizing");
        }
        if (request.expectedVersion() != null && !request.expectedVersion().equals(plan.getVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan version mismatch");
        }
        if (!Set.of("DRAFT", "PENDING_APPROVAL").contains(plan.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reoptimize plan in status " + plan.getStatus());
        }

        plan.setStatus("OPTIMIZING");
        planRepository.save(plan);

        Set<UUID> locked = new HashSet<>();
        if (request.lockedLineIds() != null) {
            locked.addAll(request.lockedLineIds());
        }
        List<SlottingPlanLineEntity> existing = lineRepository.findByPlanIdOrderByMaterialCodeAsc(planId);
        for (SlottingPlanLineEntity line : existing) {
            if (Boolean.TRUE.equals(line.getLocked())) {
                locked.add(line.getMaterialId());
            }
        }

        runOptimization(plan, locked, existing, true);

        plan.setStatus("DRAFT");
        plan.setVersion(plan.getVersion() + 1);
        return planRepository.save(plan);
    }

    @Transactional
    public SlottingPlanEntity approve(UUID planId, ApprovePlanRequest request) {
        SlottingPlanEntity plan = getPlan(planId);
        if ("OPTIMIZING".equals(plan.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot approve while optimizing");
        }
        if (!Set.of("DRAFT", "PENDING_APPROVAL").contains(plan.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot approve plan in status " + plan.getStatus());
        }
        if (!Set.of("OPTIMAL", "FEASIBLE").contains(plan.getSolverStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only OPTIMAL or manager-accepted FEASIBLE solver results can be approved");
        }

        boolean directApply = Boolean.TRUE.equals(request.directApply());
        if (directApply) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Direct apply is disabled. Approved moves must be released as scan-confirmed worker transfers.");
        }
        plan.setStatus("APPROVED");
        plan.setApprovedBy(request.approvedBy());
        plan.setApprovedAt(OffsetDateTime.now());
        plan.setExecutionStatus("PENDING_SCHEDULE");
        plan = planRepository.save(plan);
        updatePlanningCycle(plan, "APPROVED", null);
        return plan;
    }

    @Transactional
    public SlottingPlanEntity schedule(UUID planId, OffsetDateTime scheduledFor) {
        SlottingPlanEntity plan = getPlan(planId);
        if (!Set.of("APPROVED", "SCHEDULED").contains(plan.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only an approved plan can be scheduled");
        }
        plan.setScheduledFor(scheduledFor != null ? scheduledFor : OffsetDateTime.now());
        plan.setStatus("SCHEDULED");
        plan.setExecutionStatus("SCHEDULED");
        plan = planRepository.save(plan);
        updatePlanningCycle(plan, "SCHEDULED", plan.getScheduledFor());
        if (!plan.getScheduledFor().isAfter(OffsetDateTime.now())) {
            return releaseScheduledPlan(plan.getId());
        }
        return plan;
    }

    @Transactional
    public SlottingPlanEntity releaseScheduledPlan(UUID planId) {
        SlottingPlanEntity plan = getPlan(planId);
        if (!"SCHEDULED".equals(plan.getStatus())) return plan;
        List<SlottingPlanLineEntity> lines = lineRepository.findByPlanIdOrderByMaterialCodeAsc(planId);
        SlottingPlanExecutionService.ExecutionResult execution = executionService.executeApprovedPlan(plan, lines);
        UUID currentPlanId = plan.getId();
        planRepository.findFirstByWarehouseIdAndStatusOrderByApprovedAtDesc(plan.getWarehouseId(), "ACTIVE")
                .filter(active -> !active.getId().equals(currentPlanId))
                .ifPresent(active -> {
                    active.setStatus("SUPERSEDED");
                    planRepository.save(active);
                });
        plan.setStatus("ACTIVE");
        plan.setExecutionStatus(execution.executionStatus());
        plan.setExecutionTransferId(execution.transferId());
        plan.setTransfersCreated(execution.transfersCreated());
        plan = planRepository.save(plan);
        updatePlanningCycle(plan, "COMPLETED".equals(execution.executionStatus()) ? "COMPLETED" : "IN_EXECUTION", null);
        return plan;
    }

    private void updatePlanningCycle(SlottingPlanEntity plan, String status, OffsetDateTime scheduledFor) {
        if (plan.getPlanningCycleId() == null) return;
        planningCycleRepository.findById(plan.getPlanningCycleId()).ifPresent(cycle -> {
            cycle.setLifecycleStatus(status);
            if (scheduledFor != null) cycle.setScheduledFor(scheduledFor);
            if ("IN_EXECUTION".equals(status) && cycle.getStartedAt() == null) cycle.setStartedAt(OffsetDateTime.now());
            if ("COMPLETED".equals(status)) cycle.setCompletedAt(OffsetDateTime.now());
            planningCycleRepository.save(cycle);
        });
    }

    private String resolveUniquePlanCode(UUID warehouseId, String baseCode) {
        if (!planRepository.existsByWarehouseIdAndPlanCode(warehouseId, baseCode)) {
            return baseCode;
        }
        String stem = baseCode.replaceFirst("-v\\d+$", "");
        int version = 2;
        while (version < 100) {
            String candidate = stem + "-v" + version;
            if (!planRepository.existsByWarehouseIdAndPlanCode(warehouseId, candidate)) {
                return candidate;
            }
            version++;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Could not allocate unique plan code for: " + baseCode);
    }

    private void runOptimization(
            SlottingPlanEntity plan,
            Set<UUID> lockedMaterialIds,
            List<SlottingPlanLineEntity> existingLines,
            boolean useMilpAClass) {

        UUID warehouseId = plan.getWarehouseId();
        List<LocationEntity> locations = locationRepository.findByWarehouseIdAndIsActive(warehouseId, true);
        Map<String, LocationEntity> locationIndex = locations.stream()
                .collect(Collectors.toMap(LocationEntity::getLocationCode, l -> l, (a, b) -> a));

        double[] anchor = computeDispatchAnchor(locations);
        Map<UUID, String> incumbent = loadIncumbentPrimary(warehouseId);

        List<MaterialIssueStatsRollupEntity> rollups = rollupRepository.findByWarehouseId(warehouseId);
        Map<UUID, MaterialIssueStatsRollupEntity> rollupByMaterial = rollups.stream()
                .collect(Collectors.toMap(MaterialIssueStatsRollupEntity::getMaterialId, r -> r, (a, b) -> a));

        List<MaterialEntity> materials = materialRepository.findByDataQualityTierIn(
                        List.of("PROJECT_OPERATIONAL_SIMULATION",
                                "GENERATED_OPERATIONAL_BASELINE", "OPERATIONAL_ENTRY")).stream()
                .filter(m -> isSlottingType(m.getMaterialType()))
                .toList();

        Set<UUID> materialIds = materials.stream().map(MaterialEntity::getId).collect(Collectors.toSet());
        Map<UUID, DemandSpacePlanningService.DemandProfile> demandProfiles =
                demandSpacePlanningService.buildProfiles(warehouseId, materialIds);

        SlottingPlanOptimizer optimizer = new SlottingPlanOptimizer(handlingUnitCapacityService, stockPlacementPlanner);
        List<SlottingPlanOptimizer.OptimizedLine> allOptimized = new ArrayList<>();
        List<SlottingPlanOptimizer.MaterialCandidate> allCandidates = new ArrayList<>();

        for (String typeFilter : List.of("raw_material", "packaging_material", "product")) {
            List<SlottingPlanOptimizer.MaterialCandidate> candidates = materials.stream()
                    .filter(m -> normalizeType(m.getMaterialType()).equals(typeFilter))
                    .map(m -> toCandidate(m, rollupByMaterial.get(m.getId())))
                    .toList();
            if (candidates.isEmpty()) {
                continue;
            }
            allCandidates.addAll(candidates);
            SlottingPlanOptimizer.OptimizerInput input = new SlottingPlanOptimizer.OptimizerInput(
                    typeFilter,
                    candidates,
                    locations,
                    locationIndex,
                    incumbent,
                    lockedMaterialIds,
                    existingLines,
                    plan.getRelocationBudgetPct(),
                    anchor,
                    warehouseId,
                    demandProfiles);
            allOptimized.addAll(optimizer.optimize(input).lines());
        }

        if (slottingPlanClient.isEnabled() && slottingPlanClient.isHealthy() && useMilpAClass) {
            List<SlottingPlanOptimizer.OptimizedLine> javaBaseline = new ArrayList<>(allOptimized);
            SlottingPlanClient.PlanOptimizeRequest pyReq = SlottingPlanClient.buildRequest(
                    warehouseId,
                    plan.getRelocationBudgetPct(),
                    true,
                    allCandidates,
                    locations,
                    incumbent,
                    lockedMaterialIds,
                    demandProfiles);
            Optional<SlottingPlanClient.PlanOptimizeResponse> response = slottingPlanClient.optimize(pyReq);
            if (response.isPresent()) {
                SlottingPlanClient.PlanOptimizeResponse pyRes = response.get();
                plan.setSolverStatus(pyRes.solver_status != null ? pyRes.solver_status : "UNKNOWN");
                plan.setObjectiveValue(pyRes.objective_value != null
                        ? BigDecimal.valueOf(pyRes.objective_value) : null);
                plan.setInfeasibleReason(pyRes.infeasible_reason);
                plan.setConstraintEvidence(pyRes.constraints_used != null
                        ? String.join(",", pyRes.constraints_used) : null);
                boolean solved = Set.of("OPTIMAL", "FEASIBLE").contains(plan.getSolverStatus())
                        && pyRes.assignments != null && !pyRes.assignments.isEmpty();
                if (solved) {
                    allOptimized.clear();
                    allOptimized.addAll(slottingPlanClient.mergePythonAssignments(javaBaseline, pyRes));
                    plan.setAlgorithm(pyRes.algorithm != null ? pyRes.algorithm : "ORTOOLS_MILP_V2");
                } else {
                    plan.setAlgorithm("HEURISTIC_FALLBACK_V1");
                }
            } else {
                plan.setAlgorithm("HEURISTIC_FALLBACK_V1");
                plan.setSolverStatus("FALLBACK");
                plan.setInfeasibleReason("Slotting service timed out or returned no usable solver result");
            }
        } else if (!useMilpAClass) {
            plan.setAlgorithm("HEURISTIC_V1");
            plan.setSolverStatus("NOT_REQUESTED");
        }

        persistOptimizedLines(plan, allOptimized, lockedMaterialIds, existingLines, demandProfiles);
    }

    private void persistOptimizedLines(
            SlottingPlanEntity plan,
            List<SlottingPlanOptimizer.OptimizedLine> optimized,
            Set<UUID> lockedMaterialIds,
            List<SlottingPlanLineEntity> existingLines,
            Map<UUID, DemandSpacePlanningService.DemandProfile> demandProfiles) {

        Map<UUID, SlottingPlanLineEntity> existingByMaterial = existingLines.stream()
                .collect(Collectors.toMap(SlottingPlanLineEntity::getMaterialId, l -> l, (a, b) -> a));

        List<SlottingPlanLineEntity> toRemove = existingLines.stream()
                .filter(l -> !lockedMaterialIds.contains(l.getMaterialId()))
                .toList();
        if (!toRemove.isEmpty()) {
            List<UUID> removeIds = toRemove.stream().map(SlottingPlanLineEntity::getId).toList();
            reserveLineRepository.deleteByPlanLineIdIn(removeIds);
            lineRepository.deleteAll(toRemove);
        }

        int movesProposed = 0;
        BigDecimal totalDistance = BigDecimal.ZERO;

        for (SlottingPlanOptimizer.OptimizedLine opt : optimized) {
            if (lockedMaterialIds.contains(opt.material().materialId())
                    && existingByMaterial.containsKey(opt.material().materialId())) {
                SlottingPlanLineEntity kept = existingByMaterial.get(opt.material().materialId());
                kept.setPlanId(plan.getId());
                lineRepository.save(kept);
                continue;
            }

            SlottingPlanLineEntity line = new SlottingPlanLineEntity();
            line.setPlanId(plan.getId());
            line.setMaterialId(opt.material().materialId());
            line.setMaterialCode(opt.material().materialCode());
            line.setMaterialType(opt.material().materialType());
            line.setCurrentPrimaryLocationCode(opt.currentPrimary());
            line.setRecommendedPrimaryLocationCode(opt.recommendedPrimary());
            line.setRecommendedPrimaryLocationId(opt.recommendedPrimaryLocationId());
            line.setFinalPrimaryLocationCode(opt.finalPrimary());
            line.setActivePickPalletPositions(opt.activePickPp());
            line.setRequiredReservePalletPositions(opt.requiredReservePp());
            line.setMaxStockPalletPositions(opt.maxStockPp());
            line.setDistanceSavedMeters(opt.distanceSavedMeters());
            line.setZoneUpgrade(opt.zoneUpgrade());
            line.setMoveReason(opt.moveReason());
            line.setGainScore(opt.gainScore());
            // The optimizer selects a move; it is not physically applied until a
            // worker completes the linked transfer line.
            line.setRelocationApplied(false);
            line.setRelocationFlag(opt.relocationFlag());
            line.setObjectiveCost(opt.gainScore());
            line.setStatus(opt.status());
            line.setConstraintSnapshot(buildSnapshot(
                    opt.material(),
                    demandProfiles.get(opt.material().materialId())));

            if (opt.relocationFlag()) {
                movesProposed++;
            }
            if (opt.relocationFlag()) {
                totalDistance = totalDistance.add(
                        opt.distanceSavedMeters() != null ? opt.distanceSavedMeters() : BigDecimal.ZERO);
            }

            line = lineRepository.save(line);

            int seq = 1;
            for (SlottingPlanOptimizer.ReserveSlot reserve : opt.reserveSlots()) {
                SlottingPlanReserveLineEntity r = new SlottingPlanReserveLineEntity();
                r.setPlanLineId(line.getId());
                r.setRecommendedReserveLocationCode(reserve.locationCode());
                r.setFinalReserveLocationCode(reserve.locationCode());
                r.setReservePalletPositions(reserve.palletPositions());
                r.setReserveZoneHint(reserve.zoneHint());
                r.setSequenceNo(seq++);
                reserveLineRepository.save(r);
            }
        }

        plan.setTotalMovesProposed(movesProposed);
        plan.setRelocationMovesApplied(0);
        plan.setTotalDistanceSavedMeters(totalDistance.setScale(2, RoundingMode.HALF_UP));
        planRepository.save(plan);
    }

    private SlottingPlanOptimizer.MaterialCandidate toCandidate(
            MaterialEntity m, MaterialIssueStatsRollupEntity rollup) {
        String amalgamated = rollup != null && rollup.getAmalgamatedClass() != null
                ? rollup.getAmalgamatedClass() : "CS";
        String abc = rollup != null ? rollup.getAbcClass() : "C";
        String fms = rollup != null ? rollup.getFmsClass() : "S";
        long vol = rollup != null && rollup.getIssueVolume12m() != null ? rollup.getIssueVolume12m() : 0;
        int cnt = rollup != null && rollup.getIssueCount12m() != null ? rollup.getIssueCount12m() : 0;
        return new SlottingPlanOptimizer.MaterialCandidate(
                m.getId(),
                m.getMaterialCode(),
                normalizeType(m.getMaterialType()),
                amalgamated,
                abc,
                fms,
                vol,
                cnt,
                m.getWeightKg(),
                m.getVolumeCm3(),
                m.getPalletSpaces(),
                m.getUnitsPerPallet(),
                m.getMaxPalletWeightKg(),
                null,
                Boolean.TRUE.equals(m.getTemperatureControlled()),
                Boolean.TRUE.equals(m.getHazardous()),
                Boolean.TRUE.equals(m.getFragile()),
                !Boolean.FALSE.equals(m.getStackable()));
    }

    private Map<UUID, String> loadIncumbentPrimary(UUID warehouseId) {
        Map<UUID, String> map = new HashMap<>();
        for (MaterialDefaultLocationEntity d : defaultLocationRepository.findByWarehouseId(warehouseId)) {
            if (d.getPriority() != null && d.getPriority() == 1) {
                map.put(d.getMaterialId(), d.getLocationCode());
            }
        }
        return map;
    }

    private double[] computeDispatchAnchor(List<LocationEntity> locations) {
        double minX = locations.stream()
                .map(l -> l.getCoordinateX() != null ? l.getCoordinateX().doubleValue() : 0)
                .min(Double::compare).orElse(0.0);
        double minY = locations.stream()
                .map(l -> l.getCoordinateY() != null ? l.getCoordinateY().doubleValue() : 0)
                .min(Double::compare).orElse(0.0);
        return new double[]{minX, minY};
    }

    private String buildSnapshot(SlottingPlanOptimizer.MaterialCandidate m,
                                 DemandSpacePlanningService.DemandProfile profile) {
        if (profile != null) {
            return String.format(
                    "{\"abc_class\":\"%s\",\"fms_class\":\"%s\",\"amalgamated_class\":\"%s\",\"issue_volume\":%d,\"issue_frequency\":%d,"
                            + "\"demand_trend\":\"%s\",\"forecast_p50\":%s,\"required_pallets\":%d,\"stockout_risk\":%.2f}",
                    m.abcClass(), m.fmsClass(), m.amalgamatedClass(), m.issueVolume(), m.issueCount(),
                    profile.demandTrend().name(),
                    profile.forecastP50Units().setScale(0, RoundingMode.HALF_UP),
                    profile.requiredPalletPositions(),
                    profile.stockoutRiskScore());
        }
        return String.format(
                "{\"abc_class\":\"%s\",\"fms_class\":\"%s\",\"amalgamated_class\":\"%s\",\"issue_volume\":%d,\"issue_frequency\":%d}",
                m.abcClass(), m.fmsClass(), m.amalgamatedClass(), m.issueVolume(), m.issueCount());
    }

    private void assertEditable(SlottingPlanEntity plan, String action) {
        if ("OPTIMIZING".equals(plan.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot " + action + " while plan is OPTIMIZING");
        }
    }

    private boolean isSlottingType(String materialType) {
        String t = normalizeType(materialType);
        return Set.of("raw_material", "packaging_material", "product").contains(t);
    }

    private String normalizeType(String materialType) {
        if (materialType == null || materialType.isBlank()) {
            return "raw_material";
        }
        String t = materialType.toLowerCase();
        if (t.equals("packing_material") || t.equals("packaging")) {
            return "packaging_material";
        }
        if (t.equals("product") || t.equals("fg")) {
            return "product";
        }
        return "raw_material";
    }

    public record CreatePlanRequest(
            UUID warehouseId,
            Integer validMonths,
            LocalDate validFrom,
            String planCode,
            BigDecimal relocationBudgetPct,
            String createdBy,
            String notes,
            Boolean useMilpAClass) {}

    public record UpdateLineRequest(
            Integer expectedVersion,
            String finalPrimaryLocationCode,
            String overrideReason,
            Boolean locked) {}

    public record ReoptimizeRequest(Integer expectedVersion, List<UUID> lockedLineIds) {}

    public record ApprovePlanRequest(String approvedBy, Boolean directApply) {}
}
