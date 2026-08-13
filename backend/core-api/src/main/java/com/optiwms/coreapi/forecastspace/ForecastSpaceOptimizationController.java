package com.optiwms.coreapi.forecastspace;

import com.optiwms.coreapi.ai.AiProxyService;
import com.optiwms.coreapp.forecastspace.ForecastSpaceOptimizationService;
import com.optiwms.coreapp.forecastspace.InventoryPolicyRecommendationService;
import com.optiwms.infra.forecastspace.*;
import com.optiwms.infra.master.MaterialRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/forecast-space")
@PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER','MANAGER','SUPERVISOR')")
public class ForecastSpaceOptimizationController {
    private final InventoryPolicyRecommendationService policyService;
    private final ForecastSpaceOptimizationService spaceService;
    private final MaterialRepository materialRepository;
    private final AiProxyService aiProxyService;

    public ForecastSpaceOptimizationController(
            InventoryPolicyRecommendationService policyService,
            ForecastSpaceOptimizationService spaceService,
            MaterialRepository materialRepository,
            AiProxyService aiProxyService) {
        this.policyService = policyService;
        this.spaceService = spaceService;
        this.materialRepository = materialRepository;
        this.aiProxyService = aiProxyService;
    }

    @GetMapping("/readiness")
    public ReadinessDto getReadiness(
            Authentication authentication,
            @RequestParam UUID warehouseId,
            @RequestParam(required = false) String materialType,
            @RequestParam(required = false) Integer horizonMonths) {
        InventoryPolicyRecommendationService.ForecastSpaceReadiness readiness =
                policyService.readiness(authorizedWarehouse(authentication, warehouseId), materialType, horizonMonths);
        return new ReadinessDto(
                str(readiness.warehouseId()),
                readiness.horizonMonths(),
                readiness.materialType(),
                readiness.materialsTotalCount(),
                readiness.forecastedMaterialsCount(),
                readiness.forecastCoveragePct(),
                readiness.inventoryMaterialsCount(),
                readiness.inventoryCoveragePct(),
                readiness.missingPalletSpecsCount(),
                readiness.palletSpecCoveragePct(),
                readiness.missingMoqCount(),
                readiness.missingLeadTimeCount(),
                readiness.unapprovedForecastMaterialsCount(),
                readiness.ready(),
                readiness.blockers());
    }

    @PostMapping("/policy-runs")
    public ResponseEntity<PolicyRunDto> createPolicyRun(@RequestBody CreatePolicyRunDto body,
            Authentication authentication) {
        UUID warehouseId = authorizedWarehouse(authentication, UUID.fromString(body.warehouseId()));
        InventoryPolicyRecommendationRunEntity run = policyService.createRun(
                new InventoryPolicyRecommendationService.CreatePolicyRunRequest(
                        warehouseId,
                        body.horizonMonths(),
                        body.materialType(),
                        body.forecastModelName(),
                        body.forecastRunId(),
                        body.createdBy(),
                        body.notes()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toPolicyRun(run));
    }

    @GetMapping("/policy-runs")
    public List<PolicyRunDto> listPolicyRuns(@RequestParam UUID warehouseId, Authentication authentication) {
        return policyService.listRuns(authorizedWarehouse(authentication, warehouseId)).stream().map(this::toPolicyRun).toList();
    }

    @GetMapping("/policy-runs/{runId}")
    public PolicyRunDto getPolicyRun(@PathVariable UUID runId, Authentication authentication) {
        return toPolicyRun(authorizedPolicyRun(runId, authentication));
    }

    @GetMapping("/policy-runs/{runId}/lines")
    public List<PolicyLineDto> getPolicyLines(@PathVariable UUID runId, Authentication authentication) {
        authorizedPolicyRun(runId, authentication);
        return policyService.getLines(runId).stream().map(this::toPolicyLine).toList();
    }

    @GetMapping("/policy-runs/{runId}/simulation-evidence")
    public List<PolicySimulationEvidenceDto> getPolicySimulationEvidence(@PathVariable UUID runId,
            Authentication authentication) {
        authorizedPolicyRun(runId, authentication);
        return policyService.getSimulationEvidence(runId).stream().map(this::toSimulationEvidence).toList();
    }

    @GetMapping("/policy-lines/{lineId}/scenarios")
    public List<ScenarioDto> getPolicyLineScenarios(@PathVariable UUID lineId, Authentication authentication) {
        authorizedPolicyRun(policyService.getLine(lineId).getRunId(), authentication);
        return policyService.getScenariosForPolicyLine(lineId).stream().map(this::toScenario).toList();
    }

    @PostMapping("/policy-runs/{runId}/approve")
    public PolicyRunDto approvePolicyRun(@PathVariable UUID runId, @RequestBody ApproveRunDto body,
            Authentication authentication) {
        authorizedPolicyRun(runId, authentication);
        return toPolicyRun(policyService.approveRun(runId, body.approvedBy()));
    }

    @PostMapping("/policy-runs/{runId}/rollback")
    public PolicyRunDto rollbackPolicyRun(@PathVariable UUID runId, @RequestBody RollbackRunDto body,
            Authentication authentication) {
        authorizedPolicyRun(runId, authentication);
        return toPolicyRun(policyService.rollbackRun(runId, body.rolledBackBy()));
    }

    @PostMapping("/space-runs")
    public ResponseEntity<SpaceRunDto> createSpaceRun(@RequestBody CreateSpaceRunDto body,
            Authentication authentication) {
        UUID policyRunId = UUID.fromString(body.policyRunId());
        authorizedPolicyRun(policyRunId, authentication);
        SpaceOptimizationRunEntity run = spaceService.createRun(
                new ForecastSpaceOptimizationService.CreateSpaceRunRequest(
                        policyRunId,
                        body.createdBy(),
                        body.notes()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toSpaceRun(run));
    }

    @GetMapping("/space-runs")
    public List<SpaceRunDto> listSpaceRuns(@RequestParam UUID warehouseId, Authentication authentication) {
        return spaceService.listRuns(authorizedWarehouse(authentication, warehouseId)).stream().map(this::toSpaceRun).toList();
    }

    @GetMapping("/space-runs/{runId}")
    public SpaceRunDto getSpaceRun(@PathVariable UUID runId, Authentication authentication) {
        return toSpaceRun(authorizedSpaceRun(runId, authentication));
    }

    @GetMapping("/space-runs/{runId}/lines")
    public List<SpaceLineDto> getSpaceLines(@PathVariable UUID runId, Authentication authentication) {
        authorizedSpaceRun(runId, authentication);
        return spaceService.getLines(runId).stream().map(this::toSpaceLine).toList();
    }

    @GetMapping("/space-lines/{lineId}/scenarios")
    public List<ScenarioDto> getSpaceLineScenarios(@PathVariable UUID lineId, Authentication authentication) {
        authorizedSpaceRun(spaceService.getLine(lineId).getRunId(), authentication);
        return spaceService.getScenariosForSpaceLine(lineId).stream().map(this::toScenario).toList();
    }

    @PostMapping("/space-runs/{runId}/approve")
    public SpaceRunDto approveSpaceRun(@PathVariable UUID runId, @RequestBody ApproveRunDto body,
            Authentication authentication) {
        authorizedSpaceRun(runId, authentication);
        return toSpaceRun(spaceService.approveRun(runId, body.approvedBy()));
    }

    private InventoryPolicyRecommendationRunEntity authorizedPolicyRun(UUID runId, Authentication authentication) {
        InventoryPolicyRecommendationRunEntity run = policyService.getRun(runId);
        authorizedWarehouse(authentication, run.getWarehouseId());
        return run;
    }

    private SpaceOptimizationRunEntity authorizedSpaceRun(UUID runId, Authentication authentication) {
        SpaceOptimizationRunEntity run = spaceService.getRun(runId);
        authorizedWarehouse(authentication, run.getWarehouseId());
        return run;
    }

    private UUID authorizedWarehouse(Authentication authentication, UUID requested) {
        String scoped = aiProxyService.resolveWarehouseScope(authentication, requested != null ? requested.toString() : null);
        if (scoped == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No authorized warehouse assignment");
        UUID authorized;
        try { authorized = UUID.fromString(scoped); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid warehouse assignment"); }
        if (!authorized.equals(requested)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Warehouse is outside the signed-in user's assignment");
        }
        return authorized;
    }

    private PolicyRunDto toPolicyRun(InventoryPolicyRecommendationRunEntity run) {
        return new PolicyRunDto(
                str(run.getId()),
                str(run.getWarehouseId()),
                run.getHorizonMonths(),
                run.getStatus(),
                run.getForecastModelName(),
                run.getForecastRunId(),
                run.getCreatedBy(),
                run.getApprovedBy(),
                run.getApprovedAt() != null ? run.getApprovedAt().toString() : null,
                run.getNotes(),
                dbl(run.getTotalStockDelta()),
                dbl(run.getTotalPalletPositionsDelta()),
                dbl(run.getEstimatedHoldingCostDelta()),
                run.getHighRiskCount(),
                run.getDataInsufficientCount(),
                run.getCreatedAt() != null ? run.getCreatedAt().toString() : null);
    }

    private PolicyLineDto toPolicyLine(InventoryPolicyRecommendationLineEntity line) {
        return new PolicyLineDto(
                str(line.getId()),
                str(line.getRunId()),
                str(line.getMaterialId()),
                line.getMaterialCode(),
                materialRepository.findById(line.getMaterialId()).map(material -> material.getDescription()).orElse(line.getMaterialCode()),
                line.getMaterialType(),
                dbl(line.getCurrentStock()),
                dbl(line.getCurrentAvailableStock()),
                dbl(line.getCurrentMinStock()),
                dbl(line.getCurrentMaxStock()),
                dbl(line.getCurrentReorderPoint()),
                dbl(line.getCurrentBufferStock()),
                dbl(line.getCurrentOrderQty()),
                dbl(line.getCurrentPalletRequirement()),
                dbl(line.getTargetPalletPositions()),
                dbl(line.getForecastP10()),
                dbl(line.getForecastP50()),
                dbl(line.getForecastP90()),
                line.getLeadTimeDays(),
                dbl(line.getLeadTimeStdDays()),
                dbl(line.getMoq()),
                dbl(line.getOrderMultiple()),
                dbl(line.getUnitsPerHandlingUnit()),
                dbl(line.getUnitCost()),
                dbl(line.getExpiryLimitedMaxStock()),
                dbl(line.getProposedMinStock()),
                dbl(line.getProposedMaxStock()),
                dbl(line.getProposedReorderPoint()),
                dbl(line.getProposedTargetStock()),
                dbl(line.getProposedOrderQty()),
                dbl(line.getStockDelta()),
                dbl(line.getPalletPositionsDelta()),
                dbl(line.getHoldingCostDelta()),
                dbl(line.getStockoutRiskScore()),
                dbl(line.getExpiryRiskScore()),
                dbl(line.getConfidenceScore()),
                line.getRecommendationStatus(),
                line.getRationale(),
                line.getConstraintSnapshot(),
                line.getApprovalSnapshot(),
                line.getManagerOverride(),
                line.getOverrideReason());
    }

    private SpaceRunDto toSpaceRun(SpaceOptimizationRunEntity run) {
        return new SpaceRunDto(
                str(run.getId()),
                str(run.getWarehouseId()),
                str(run.getPolicyRunId()),
                run.getHorizonMonths(),
                run.getStatus(),
                run.getAlgorithm(),
                run.getOptimizerMetadata(),
                dbl(run.getRelocationCapPct()),
                run.getRelocationCapSkus(),
                dbl(run.getObjectiveValue()),
                run.getCreatedBy(),
                run.getApprovedBy(),
                run.getApprovedAt() != null ? run.getApprovedAt().toString() : null,
                run.getNotes(),
                dbl(run.getTotalSpaceSavedPalletPositions()),
                dbl(run.getTotalSpaceNeededPalletPositions()),
                dbl(run.getTotalDistanceSavedMeters()),
                run.getInfeasibleCount(),
                run.getHighRiskCount(),
                run.getCreatedAt() != null ? run.getCreatedAt().toString() : null);
    }

    private SpaceLineDto toSpaceLine(SpaceOptimizationLineEntity line) {
        return new SpaceLineDto(
                str(line.getId()),
                str(line.getRunId()),
                str(line.getMaterialId()),
                str(line.getSourcePolicyLineId()),
                line.getMaterialCode(),
                line.getMaterialType(),
                line.getCurrentPrimaryLocationCode(),
                line.getRecommendedPrimaryLocationCode(),
                line.getRecommendedReserveLocations(),
                line.getReleasedLocationCodes(),
                line.getRequiredActivePickPalletPositions(),
                line.getRequiredReservePalletPositions(),
                line.getCompatible(),
                dbl(line.getDistanceSavedMeters()),
                dbl(line.getSpaceSavedPalletPositions()),
                dbl(line.getSpaceNeededPalletPositions()),
                dbl(line.getMoveCostScore()),
                line.getRecommendationStatus(),
                line.getRationale(),
                line.getConstraintSnapshot(),
                line.getManagerOverride(),
                line.getOverrideReason());
    }

    private ScenarioDto toScenario(SpaceOptimizationScenarioEntity scenario) {
        return new ScenarioDto(
                str(scenario.getId()),
                str(scenario.getPolicyLineId()),
                str(scenario.getSpaceLineId()),
                scenario.getScenarioName(),
                scenario.getPassed(),
                dbl(scenario.getRiskScore()),
                dbl(scenario.getStockoutDaysEstimate()),
                dbl(scenario.getExpiryExcessUnits()),
                dbl(scenario.getSpaceShortfallPalletPositions()),
                scenario.getExplanation());
    }

    private PolicySimulationEvidenceDto toSimulationEvidence(InventoryPolicySimulationEvidenceEntity evidence) {
        return new PolicySimulationEvidenceDto(
                str(evidence.getId()),
                str(evidence.getPolicyRunId()),
                str(evidence.getMaterialId()),
                dbl(evidence.getServiceLevelTarget()),
                dbl(evidence.getSimulatedFillRate()),
                dbl(evidence.getCurrentExpectedCost()),
                dbl(evidence.getProposedExpectedCost()),
                dbl(evidence.getExpectedCostDelta()),
                evidence.getStockoutDaysCurrent(),
                evidence.getStockoutDaysProposed(),
                evidence.getCapacityFeasible(),
                evidence.getSimulationMethod(),
                evidence.getSourceLineage(),
                evidence.getCreatedAt() != null ? evidence.getCreatedAt().toString() : null);
    }

    private String str(UUID id) {
        return id != null ? id.toString() : null;
    }

    private Double dbl(BigDecimal value) {
        return value != null ? value.doubleValue() : null;
    }

    public record CreatePolicyRunDto(
            String warehouseId,
            Integer horizonMonths,
            String materialType,
            String forecastModelName,
            String forecastRunId,
            String createdBy,
            String notes) {}

    public record CreateSpaceRunDto(String policyRunId, String createdBy, String notes) {}
    public record ApproveRunDto(String approvedBy) {}
    public record RollbackRunDto(String rolledBackBy) {}

    public record ReadinessDto(
            String warehouseId,
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
            Integer unapprovedForecastMaterialsCount,
            Boolean ready,
            List<String> blockers) {}

    public record PolicyRunDto(
            String id,
            String warehouseId,
            Integer horizonMonths,
            String status,
            String forecastModelName,
            String forecastRunId,
            String createdBy,
            String approvedBy,
            String approvedAt,
            String notes,
            Double totalStockDelta,
            Double totalPalletPositionsDelta,
            Double estimatedHoldingCostDelta,
            Integer highRiskCount,
            Integer dataInsufficientCount,
            String createdAt) {}

    public record PolicyLineDto(
            String id,
            String runId,
            String materialId,
            String materialCode,
            String materialName,
            String materialType,
            Double currentStock,
            Double currentAvailableStock,
            Double currentMinStock,
            Double currentMaxStock,
            Double currentReorderPoint,
            Double currentBufferStock,
            Double currentOrderQty,
            Double currentPalletRequirement,
            Double targetPalletPositions,
            Double forecastP10,
            Double forecastP50,
            Double forecastP90,
            Integer leadTimeDays,
            Double leadTimeStdDays,
            Double moq,
            Double orderMultiple,
            Double unitsPerHandlingUnit,
            Double unitCost,
            Double expiryLimitedMaxStock,
            Double proposedMinStock,
            Double proposedMaxStock,
            Double proposedReorderPoint,
            Double proposedTargetStock,
            Double proposedOrderQty,
            Double stockDelta,
            Double palletPositionsDelta,
            Double holdingCostDelta,
            Double stockoutRiskScore,
            Double expiryRiskScore,
            Double confidenceScore,
            String recommendationStatus,
            String rationale,
            String constraintSnapshot,
            String approvalSnapshot,
            Boolean managerOverride,
            String overrideReason) {}

    public record SpaceRunDto(
            String id,
            String warehouseId,
            String policyRunId,
            Integer horizonMonths,
            String status,
            String algorithm,
            String optimizerMetadata,
            Double relocationCapPct,
            Integer relocationCapSkus,
            Double objectiveValue,
            String createdBy,
            String approvedBy,
            String approvedAt,
            String notes,
            Double totalSpaceSavedPalletPositions,
            Double totalSpaceNeededPalletPositions,
            Double totalDistanceSavedMeters,
            Integer infeasibleCount,
            Integer highRiskCount,
            String createdAt) {}

    public record SpaceLineDto(
            String id,
            String runId,
            String materialId,
            String sourcePolicyLineId,
            String materialCode,
            String materialType,
            String currentPrimaryLocationCode,
            String recommendedPrimaryLocationCode,
            String recommendedReserveLocations,
            String releasedLocationCodes,
            Integer requiredActivePickPalletPositions,
            Integer requiredReservePalletPositions,
            Boolean compatible,
            Double distanceSavedMeters,
            Double spaceSavedPalletPositions,
            Double spaceNeededPalletPositions,
            Double moveCostScore,
            String recommendationStatus,
            String rationale,
            String constraintSnapshot,
            Boolean managerOverride,
            String overrideReason) {}

    public record ScenarioDto(
            String id,
            String policyLineId,
            String spaceLineId,
            String scenarioName,
            Boolean passed,
            Double riskScore,
            Double stockoutDaysEstimate,
            Double expiryExcessUnits,
            Double spaceShortfallPalletPositions,
            String explanation) {}

    public record PolicySimulationEvidenceDto(
            String id,
            String policyRunId,
            String materialId,
            Double serviceLevelTarget,
            Double simulatedFillRate,
            Double currentExpectedCost,
            Double proposedExpectedCost,
            Double expectedCostDelta,
            Integer stockoutDaysCurrent,
            Integer stockoutDaysProposed,
            Boolean capacityFeasible,
            String simulationMethod,
            String sourceLineage,
            String createdAt) {}
}
