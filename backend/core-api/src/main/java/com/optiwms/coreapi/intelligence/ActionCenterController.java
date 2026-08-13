package com.optiwms.coreapi.intelligence;

import com.optiwms.coreapp.intelligence.ActionCenterService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/intelligence")
public class ActionCenterController {
    private final ActionCenterService actionCenterService;

    public ActionCenterController(ActionCenterService actionCenterService) {
        this.actionCenterService = actionCenterService;
    }

    @GetMapping("/action-center")
    public ActionCenterSummaryDto getActionCenter(@RequestParam UUID warehouseId) {
        ActionCenterService.ActionCenterSummary summary = actionCenterService.summarize(warehouseId);
        return new ActionCenterSummaryDto(
                summary.warehouseId().toString(),
                summary.pendingPolicyRuns(),
                summary.pendingSpaceRuns(),
                summary.draftSlottingPlans(),
                summary.latestPolicyStatus(),
                summary.latestSpaceStatus(),
                summary.latestSlottingStatus(),
                dbl(summary.totalStockDelta()),
                dbl(summary.totalPalletDelta()),
                dbl(summary.totalSpaceSavedPalletPositions()),
                dbl(summary.totalSpaceNeededPalletPositions()),
                summary.totalMovesProposed(),
                summary.actionItems().stream().map(this::toActionItem).toList(),
                new SolverGuidanceDto(
                        summary.solverGuidance().inboundOrderMode(),
                        summary.solverGuidance().policySpaceMode(),
                        summary.solverGuidance().slottingPlanMode(),
                        summary.solverGuidance().advancedSolverMode()));
    }

    private ActionItemDto toActionItem(ActionCenterService.ActionItem item) {
        return new ActionItemDto(
                item.type(),
                item.title(),
                item.description(),
                item.priority(),
                item.href(),
                item.createdAt() != null ? item.createdAt().toString() : null);
    }

    private double dbl(BigDecimal value) {
        return value != null ? value.doubleValue() : 0.0;
    }

    public record ActionCenterSummaryDto(
            String warehouseId,
            int pendingPolicyRuns,
            int pendingSpaceRuns,
            int draftSlottingPlans,
            String latestPolicyStatus,
            String latestSpaceStatus,
            String latestSlottingStatus,
            double totalStockDelta,
            double totalPalletDelta,
            double totalSpaceSavedPalletPositions,
            double totalSpaceNeededPalletPositions,
            int totalMovesProposed,
            List<ActionItemDto> actionItems,
            SolverGuidanceDto solverGuidance) {}

    public record ActionItemDto(
            String type,
            String title,
            String description,
            String priority,
            String href,
            String createdAt) {}

    public record SolverGuidanceDto(
            String inboundOrderMode,
            String policySpaceMode,
            String slottingPlanMode,
            String advancedSolverMode) {}
}
