package com.optiwms.coreapi.slotting;

import com.optiwms.coreapi.ai.AiProxyService;
import com.optiwms.coreapp.slotting.SlottingPlanService;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;
import com.optiwms.infra.slotting.SlottingPlanReserveLineEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/slotting/plans")
@PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER','MANAGER','SUPERVISOR')")
public class SlottingPlanController {

    private final SlottingPlanService slottingPlanService;
    private final AiProxyService aiProxyService;
    private final com.optiwms.coreapp.slotting.SlottingProgressTracker progressTracker;

    public SlottingPlanController(SlottingPlanService slottingPlanService, AiProxyService aiProxyService,
            com.optiwms.coreapp.slotting.SlottingProgressTracker progressTracker) {
        this.slottingPlanService = slottingPlanService;
        this.aiProxyService = aiProxyService;
        this.progressTracker = progressTracker;
    }

    /**
     * Polled while an optimization is running. Kept separate from the blocking
     * reoptimize call, which cannot report anything until it returns.
     */
    @GetMapping("/{id}/progress")
    public com.optiwms.coreapp.slotting.SlottingProgressTracker.Progress progress(@PathVariable UUID id,
            Authentication authentication) {
        authorizedPlan(id, authentication);
        return progressTracker.get(id);
    }

    @GetMapping
    public List<SlottingPlanSummaryDto> listPlans(@RequestParam UUID warehouseId, Authentication authentication) {
        return slottingPlanService.listPlans(authorizedWarehouse(authentication, warehouseId)).stream()
                .map(this::toSummary)
                .toList();
    }

    @PostMapping
    public ResponseEntity<SlottingPlanSummaryDto> createPlan(@RequestBody CreatePlanDto body, Authentication authentication) {
        UUID warehouseId = authorizedWarehouse(authentication, UUID.fromString(body.warehouseId()));
        SlottingPlanEntity plan = slottingPlanService.createPlan(new SlottingPlanService.CreatePlanRequest(
                warehouseId,
                body.validMonths(),
                body.validFrom() != null ? LocalDate.parse(body.validFrom()) : null,
                body.planCode(),
                body.relocationBudgetPct() != null ? BigDecimal.valueOf(body.relocationBudgetPct()) : null,
                body.createdBy(),
                body.notes(),
                body.useMilpAClass()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toSummary(plan));
    }

    @GetMapping("/active")
    public ResponseEntity<SlottingPlanSummaryDto> getActivePlan(@RequestParam UUID warehouseId, Authentication authentication) {
        return slottingPlanService.getActivePlan(authorizedWarehouse(authentication, warehouseId))
                .map(p -> ResponseEntity.ok(toSummary(p)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public SlottingPlanSummaryDto getPlan(@PathVariable UUID id, Authentication authentication) {
        return toSummary(authorizedPlan(id, authentication));
    }

    @GetMapping("/{id}/lines")
    public List<SlottingPlanLineDto> getLines(@PathVariable UUID id, Authentication authentication) {
        authorizedPlan(id, authentication);
        return slottingPlanService.getLines(id).stream().map(this::toLineDto).toList();
    }

    @PatchMapping("/{id}/lines/{lineId}")
    public SlottingPlanLineDto updateLine(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @RequestBody UpdateLineDto body,
            Authentication authentication) {
        authorizedPlan(id, authentication);
        SlottingPlanLineEntity line = slottingPlanService.updateLine(
                id,
                lineId,
                new SlottingPlanService.UpdateLineRequest(
                        body.expectedVersion(),
                        body.finalPrimaryLocationCode(),
                        body.overrideReason(),
                        body.locked()));
        return toLineDto(line);
    }

    @PostMapping("/{id}/reoptimize")
    public SlottingPlanSummaryDto reoptimize(@PathVariable UUID id, @RequestBody ReoptimizeDto body,
            Authentication authentication) {
        authorizedPlan(id, authentication);
        SlottingPlanEntity plan = slottingPlanService.reoptimize(
                id,
                new SlottingPlanService.ReoptimizeRequest(
                        body.expectedVersion(),
                        body.lockedLineIds() != null
                                ? body.lockedLineIds().stream().map(UUID::fromString).toList()
                                : List.of()));
        return toSummary(plan);
    }

    @PostMapping("/{id}/approve")
    public SlottingPlanSummaryDto approve(
            @PathVariable UUID id,
            @RequestBody ApprovePlanDto body,
            Authentication authentication) {
        authorizedPlan(id, authentication);
        return toSummary(slottingPlanService.approve(
                id, new SlottingPlanService.ApprovePlanRequest(body.approvedBy(), body.directApply())));
    }

    @PostMapping("/{id}/schedule")
    public SlottingPlanSummaryDto schedule(@PathVariable UUID id, @RequestBody SchedulePlanDto body,
            Authentication authentication) {
        authorizedPlan(id, authentication);
        return toSummary(slottingPlanService.schedule(id,
                body.scheduledFor() != null ? java.time.OffsetDateTime.parse(body.scheduledFor()) : null));
    }

    private SlottingPlanEntity authorizedPlan(UUID id, Authentication authentication) {
        SlottingPlanEntity plan = slottingPlanService.getPlan(id);
        authorizedWarehouse(authentication, plan.getWarehouseId());
        return plan;
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

    private SlottingPlanSummaryDto toSummary(SlottingPlanEntity plan) {
        return new SlottingPlanSummaryDto(
                plan.getId().toString(),
                plan.getWarehouseId().toString(),
                plan.getPlanCode(),
                plan.getValidFrom().toString(),
                plan.getValidTo().toString(),
                plan.getStatus(),
                plan.getVersion(),
                plan.getAlgorithm(),
                plan.getRelocationBudgetPct() != null ? plan.getRelocationBudgetPct().doubleValue() : null,
                plan.getRelocationMovesApplied(),
                plan.getTotalMovesProposed(),
                plan.getTotalDistanceSavedMeters() != null
                        ? plan.getTotalDistanceSavedMeters().doubleValue() : null,
                plan.getCreatedBy(),
                plan.getApprovedBy(),
                plan.getApprovedAt() != null ? plan.getApprovedAt().toString() : null,
                plan.getSourceStatsAt() != null ? plan.getSourceStatsAt().toString() : null,
                plan.getNotes(),
                plan.getSolverStatus(),
                plan.getObjectiveValue() != null ? plan.getObjectiveValue().doubleValue() : null,
                plan.getInfeasibleReason(),
                plan.getConstraintEvidence(),
                plan.getExecutionStatus(),
                plan.getExecutionTransferId() != null ? plan.getExecutionTransferId().toString() : null,
                plan.getTransfersCreated());
    }

    private SlottingPlanLineDto toLineDto(SlottingPlanLineEntity line) {
        List<SlottingPlanReserveLineEntity> reserves =
                slottingPlanService.getReserveLines(line.getId());
        List<ReserveLocationDto> reserveDtos = reserves.stream()
                .map(r -> new ReserveLocationDto(
                        r.getRecommendedReserveLocationCode(),
                        r.getFinalReserveLocationCode(),
                        r.getReservePalletPositions(),
                        r.getReserveZoneHint()))
                .toList();
        List<PlacementLineDto> placementLines = reserves.stream()
                .map(r -> new PlacementLineDto(
                        r.getFinalReserveLocationCode() != null
                                ? r.getFinalReserveLocationCode()
                                : r.getRecommendedReserveLocationCode(),
                        r.getReservePalletPositions() != null ? r.getReservePalletPositions() : 1,
                        0,
                        null,
                        null))
                .toList();

        return new SlottingPlanLineDto(
                line.getId().toString(),
                line.getMaterialId().toString(),
                line.getMaterialCode(),
                line.getMaterialType(),
                line.getCurrentPrimaryLocationCode(),
                line.getRecommendedPrimaryLocationCode(),
                line.getFinalPrimaryLocationCode(),
                line.getActivePickPalletPositions(),
                line.getRequiredReservePalletPositions(),
                line.getMaxStockPalletPositions(),
                reserveDtos,
                placementLines,
                line.getDistanceSavedMeters() != null ? line.getDistanceSavedMeters().doubleValue() : null,
                line.getZoneUpgrade(),
                line.getMoveReason(),
                line.getGainScore() != null ? line.getGainScore().doubleValue() : null,
                line.getRelocationApplied(),
                line.getRelocationFlag(),
                line.getLocked(),
                line.getManagerOverride(),
                line.getStatus());
    }

    public record CreatePlanDto(
            String warehouseId,
            Integer validMonths,
            String validFrom,
            String planCode,
            Double relocationBudgetPct,
            String createdBy,
            String notes,
            Boolean useMilpAClass) {}

    public record UpdateLineDto(
            Integer expectedVersion,
            String finalPrimaryLocationCode,
            String overrideReason,
            Boolean locked) {}

    public record ReoptimizeDto(Integer expectedVersion, List<String> lockedLineIds) {}

    public record ApprovePlanDto(String approvedBy, Boolean directApply) {}
    public record SchedulePlanDto(String scheduledFor) {}

    public record SlottingPlanSummaryDto(
            String id,
            String warehouseId,
            String planCode,
            String validFrom,
            String validTo,
            String status,
            Integer version,
            String algorithm,
            Double relocationBudgetPct,
            Integer relocationMovesApplied,
            Integer totalMovesProposed,
            Double totalDistanceSavedMeters,
            String createdBy,
            String approvedBy,
            String approvedAt,
            String sourceStatsAt,
            String notes,
            String solverStatus,
            Double objectiveValue,
            String infeasibleReason,
            String constraintEvidence,
            String executionStatus,
            String executionTransferId,
            Integer transfersCreated) {}

    public record ReserveLocationDto(
            String locationCode,
            String finalLocationCode,
            Integer palletPositions,
            String zoneHint) {}

    public record PlacementLineDto(
            String locationCode,
            int palletCount,
            int quantityAllocated,
            String rackId,
            Integer levelNumber) {}

    public record SlottingPlanLineDto(
            String id,
            String materialId,
            String materialCode,
            String materialType,
            String currentPrimaryLocation,
            String recommendedPrimaryLocation,
            String finalPrimaryLocation,
            Integer activePickPalletPositions,
            Integer requiredReservePalletPositions,
            Integer maxStockPalletPositions,
            List<ReserveLocationDto> reserveLocations,
            List<PlacementLineDto> placementLines,
            Double distanceSavedMeters,
            String zoneUpgrade,
            String moveReason,
            Double gainScore,
            Boolean relocationApplied,
            Boolean relocationFlag,
            Boolean locked,
            Boolean managerOverride,
            String status) {}
}
