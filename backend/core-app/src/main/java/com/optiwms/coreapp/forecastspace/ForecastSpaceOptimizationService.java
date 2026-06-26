package com.optiwms.coreapp.forecastspace;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.StockPlacementPlanner;
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
        this.slottingPlanRepository = slottingPlanRepository;
        this.slottingPlanLineRepository = slottingPlanLineRepository;
    }

    @Transactional
    public SpaceOptimizationRunEntity createRun(CreateSpaceRunRequest request) {
        InventoryPolicyRecommendationRunEntity policyRun = policyRunRepository.findById(request.policyRunId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Policy run not found"));

        SpaceOptimizationRunEntity run = new SpaceOptimizationRunEntity();
        run.setWarehouseId(policyRun.getWarehouseId());
        run.setPolicyRunId(policyRun.getId());
        run.setHorizonMonths(policyRun.getHorizonMonths());
        run.setCreatedBy(request.createdBy());
        run.setNotes(request.notes());
        run = runRepository.save(run);

        UUID warehouseId = policyRun.getWarehouseId();
        List<InventoryPolicyRecommendationLineEntity> policyLines =
                policyLineRepository.findByRunIdOrderByMaterialCodeAsc(policyRun.getId());
        Map<UUID, MaterialEntity> materials = materialRepository.findAllById(
                policyLines.stream().map(InventoryPolicyRecommendationLineEntity::getMaterialId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(MaterialEntity::getId, m -> m));
        List<ReleasedSpace> releasePool = buildReleasePool(warehouseId, policyLines);

        BigDecimal saved = BigDecimal.ZERO;
        BigDecimal needed = BigDecimal.ZERO;
        BigDecimal distance = BigDecimal.ZERO;
        int infeasible = 0;
        int highRisk = 0;

        for (InventoryPolicyRecommendationLineEntity policyLine : policyLines) {
            MaterialEntity material = materials.get(policyLine.getMaterialId());
            if (material == null) {
                continue;
            }
            SpaceOptimizationLineEntity line = buildLine(run.getId(), warehouseId, policyLine, material, releasePool);
            line = lineRepository.save(line);
            createScenario(line);

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
        plan.setAlgorithm("FORECAST_SPACE_HEURISTIC_V1");
        plan.setCreatedBy(createdBy);
        plan.setSourceStatsAt(OffsetDateTime.now());
        plan.setNotes("Generated from forecast-space optimization run " + run.getId());
        plan = slottingPlanRepository.save(plan);

        int moves = 0;
        BigDecimal totalDistance = BigDecimal.ZERO;
        for (SpaceOptimizationLineEntity spaceLine : spaceLines) {
            InventoryPolicyRecommendationLineEntity policy = policyById.get(spaceLine.getSourcePolicyLineId());
            SlottingPlanLineEntity planLine = new SlottingPlanLineEntity();
            planLine.setPlanId(plan.getId());
            planLine.setMaterialId(spaceLine.getMaterialId());
            planLine.setMaterialCode(spaceLine.getMaterialCode());
            planLine.setMaterialType(spaceLine.getMaterialType());
            planLine.setCurrentPrimaryLocationCode(spaceLine.getCurrentPrimaryLocationCode());
            planLine.setRecommendedPrimaryLocationCode(spaceLine.getRecommendedPrimaryLocationCode());
            planLine.setFinalPrimaryLocationCode(spaceLine.getRecommendedPrimaryLocationCode());
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
            boolean relocation = spaceLine.getCurrentPrimaryLocationCode() != null
                    && spaceLine.getRecommendedPrimaryLocationCode() != null
                    && !spaceLine.getCurrentPrimaryLocationCode().equals(spaceLine.getRecommendedPrimaryLocationCode());
            planLine.setRelocationFlag(relocation);
            planLine.setRelocationApplied(false);
            planLine.setObjectiveCost(planLine.getGainScore());
            planLine.setStatus("PROPOSED");
            planLine.setConstraintSnapshot(spaceLine.getConstraintSnapshot());
            slottingPlanLineRepository.save(planLine);

            if (relocation) moves++;
            totalDistance = totalDistance.add(nz(spaceLine.getDistanceSavedMeters()));
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
        return defaultLocationRepository.findByMaterialIdAndWarehouseId(materialId, warehouseId).stream()
                .filter(d -> d.getPriority() != null && d.getPriority() == 1)
                .map(MaterialDefaultLocationEntity::getLocationCode)
                .filter(Objects::nonNull)
                .findFirst()
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

    public record CreateSpaceRunRequest(UUID policyRunId, String createdBy, String notes) {}
}
