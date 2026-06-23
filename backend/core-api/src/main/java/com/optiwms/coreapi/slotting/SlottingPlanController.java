package com.optiwms.coreapi.slotting;

import com.optiwms.coreapp.slotting.SlottingPlanService;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;
import com.optiwms.infra.slotting.SlottingPlanReserveLineEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/slotting/plans")
public class SlottingPlanController {

    private final SlottingPlanService slottingPlanService;

    public SlottingPlanController(SlottingPlanService slottingPlanService) {
        this.slottingPlanService = slottingPlanService;
    }

    @GetMapping
    public List<SlottingPlanSummaryDto> listPlans(@RequestParam UUID warehouseId) {
        return slottingPlanService.listPlans(warehouseId).stream()
                .map(this::toSummary)
                .toList();
    }

    @PostMapping
    public ResponseEntity<SlottingPlanSummaryDto> createPlan(@RequestBody CreatePlanDto body) {
        SlottingPlanEntity plan = slottingPlanService.createPlan(new SlottingPlanService.CreatePlanRequest(
                UUID.fromString(body.warehouseId()),
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
    public ResponseEntity<SlottingPlanSummaryDto> getActivePlan(@RequestParam UUID warehouseId) {
        return slottingPlanService.getActivePlan(warehouseId)
                .map(p -> ResponseEntity.ok(toSummary(p)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public SlottingPlanSummaryDto getPlan(@PathVariable UUID id) {
        return toSummary(slottingPlanService.getPlan(id));
    }

    @GetMapping("/{id}/lines")
    public List<SlottingPlanLineDto> getLines(@PathVariable UUID id) {
        return slottingPlanService.getLines(id).stream().map(this::toLineDto).toList();
    }

    @PatchMapping("/{id}/lines/{lineId}")
    public SlottingPlanLineDto updateLine(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @RequestBody UpdateLineDto body) {
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
    public SlottingPlanSummaryDto reoptimize(@PathVariable UUID id, @RequestBody ReoptimizeDto body) {
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
    public SlottingPlanSummaryDto approve(@PathVariable UUID id, @RequestBody ApprovePlanDto body) {
        return toSummary(slottingPlanService.approve(
                id, new SlottingPlanService.ApprovePlanRequest(body.approvedBy())));
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

    public record ApprovePlanDto(String approvedBy) {}

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
