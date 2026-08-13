package com.optiwms.coreapp.intelligence;

import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunEntity;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunRepository;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunEntity;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import com.optiwms.infra.orders.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ActionCenterService {
    private final InventoryPolicyRecommendationRunRepository policyRunRepository;
    private final SpaceOptimizationRunRepository spaceRunRepository;
    private final SlottingPlanRepository slottingPlanRepository;
    private final OrderRepository orderRepository;

    public ActionCenterService(
            InventoryPolicyRecommendationRunRepository policyRunRepository,
            SpaceOptimizationRunRepository spaceRunRepository,
            SlottingPlanRepository slottingPlanRepository,
            OrderRepository orderRepository) {
        this.policyRunRepository = policyRunRepository;
        this.spaceRunRepository = spaceRunRepository;
        this.slottingPlanRepository = slottingPlanRepository;
        this.orderRepository = orderRepository;
    }

    public ActionCenterSummary summarize(UUID warehouseId) {
        List<InventoryPolicyRecommendationRunEntity> policyRuns =
                policyRunRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId);
        List<SpaceOptimizationRunEntity> spaceRuns =
                spaceRunRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId);
        List<SlottingPlanEntity> slottingPlans =
                slottingPlanRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId);

        InventoryPolicyRecommendationRunEntity latestPolicy = first(policyRuns);
        SpaceOptimizationRunEntity latestSpace = first(spaceRuns);
        SlottingPlanEntity latestSlotting = first(slottingPlans);

        Set<String> reviewable = Set.of("DRAFT", "PENDING_APPROVAL", "READY_FOR_REVIEW");
        InventoryPolicyRecommendationRunEntity actionablePolicy = policyRuns.stream()
                .filter(run -> reviewable.contains(run.getStatus()))
                .findFirst()
                .orElse(null);
        int pendingPolicies = (int) policyRuns.stream().filter(run -> reviewable.contains(run.getStatus())).count();
        int pendingSpaceRuns = (int) spaceRuns.stream().filter(run -> reviewable.contains(run.getStatus())).count();
        int draftSlottingPlans = (int) slottingPlans.stream().filter(run -> "DRAFT".equals(run.getStatus())).count();
        int draftPurchaseSuggestions = (int) orderRepository.findOperationalByWarehouseId(warehouseId).stream()
                .filter(order -> "draft".equalsIgnoreCase(order.getStatus()))
                .filter(order -> order.getNotes() != null && order.getNotes().contains("Forecast policy purchase suggestion"))
                .count();
        InventoryPolicyRecommendationRunEntity policyForDecisionView = actionablePolicy != null
                ? actionablePolicy : latestPolicy;
        int stockoutExposure = policyForDecisionView != null ? nz(policyForDecisionView.getHighRiskCount()) : 0;
        BigDecimal excessInventoryValue = policyForDecisionView != null
                && policyForDecisionView.getEstimatedHoldingCostDelta() != null
                && policyForDecisionView.getEstimatedHoldingCostDelta().signum() < 0
                ? policyForDecisionView.getEstimatedHoldingCostDelta().negate() : BigDecimal.ZERO;
        int scheduledMoves = latestSlotting != null
                && Set.of("SCHEDULED", "ACTIVE").contains(latestSlotting.getStatus())
                ? nz(latestSlotting.getTotalMovesProposed()) : 0;

        List<ActionItem> actions = new ArrayList<>();
        if (latestPolicy == null) {
            actions.add(new ActionItem(
                    null,
                    "CREATE_POLICY",
                    "Generate inventory policy",
                    "Create min/max, reorder point, and order quantity recommendations from forecast demand.",
                    "HIGH",
                    "/admin/inventory-intelligence",
                    null));
        } else if (actionablePolicy != null) {
            actions.add(new ActionItem(
                    actionablePolicy.getId(),
                    "APPROVE_POLICY",
                    "Review min/max policy",
                    "Pending forecast-driven policy run has "
                            + nz(actionablePolicy.getHighRiskCount()) + " high-risk and "
                            + nz(actionablePolicy.getDataInsufficientCount()) + " data-gap lines.",
                    actionablePolicy.getHighRiskCount() != null && actionablePolicy.getHighRiskCount() > 0 ? "HIGH" : "MEDIUM",
                    "/admin/inventory-intelligence",
                    actionablePolicy.getCreatedAt()));
        }

        if (latestPolicy != null && "APPROVED".equals(latestPolicy.getStatus()) && latestSpace == null) {
            actions.add(new ActionItem(
                    latestPolicy.getId(),
                    "CREATE_SPACE_RUN",
                    "Optimize released and needed pallet space",
                    "Approved policy exists; create the storage impact run to reuse released compatible space.",
                    "HIGH",
                    "/admin/inventory-intelligence",
                    latestPolicy.getApprovedAt()));
        } else if (latestSpace != null && reviewable.contains(latestSpace.getStatus())) {
            actions.add(new ActionItem(
                    latestSpace.getId(),
                    "APPROVE_SPACE",
                    "Create slotting draft from space impact",
                    "Space run found "
                            + nz(latestSpace.getInfeasibleCount()) + " infeasible lines and "
                            + fmt(latestSpace.getTotalSpaceSavedPalletPositions()) + " saved pallet positions.",
                    latestSpace.getInfeasibleCount() != null && latestSpace.getInfeasibleCount() > 0 ? "HIGH" : "MEDIUM",
                    "/admin/inventory-intelligence",
                    latestSpace.getCreatedAt()));
        }

        if (latestSlotting == null) {
            actions.add(new ActionItem(
                    null,
                    "CREATE_SLOTTING_PLAN",
                    "Generate location plan",
                    "Create an on-demand slotting plan for pick-face and reserve locations.",
                    "MEDIUM",
                    "/admin/inventory-intelligence",
                    null));
        } else if ("DRAFT".equals(latestSlotting.getStatus())) {
            actions.add(new ActionItem(
                    latestSlotting.getId(),
                    "APPROVE_SLOTTING_PLAN",
                    "Approve location plan",
                    "Draft plan proposes "
                            + nz(latestSlotting.getTotalMovesProposed()) + " moves under a "
                            + fmt(latestSlotting.getRelocationBudgetPct()) + "% relocation budget.",
                    latestSlotting.getTotalMovesProposed() != null && latestSlotting.getTotalMovesProposed() > 0 ? "HIGH" : "LOW",
                    "/admin/inventory-intelligence",
                    latestSlotting.getCreatedAt()));
        } else if ("APPROVED".equals(latestSlotting.getStatus())) {
            actions.add(new ActionItem(
                    latestSlotting.getId(),
                    "SCHEDULE_SLOTTING_PLAN",
                    "Schedule approved relocation work",
                    "Release the approved moves in the warehouse off-peak window so workers receive scan-based tasks.",
                    "MEDIUM",
                    "/admin/inventory-intelligence",
                    latestSlotting.getApprovedAt()));
        }

        actions.sort(Comparator.comparing(ActionItem::priorityRank).reversed());

        SolverGuidance solverGuidance = new SolverGuidance(
                "Inbound orders use deterministic capacity feasibility checks only.",
                "Forecast-to-space uses auditable stock-rule math with MOQ, lead-time, expiry, and pallet-position impact.",
                "Slotting Planner uses a deterministic MILP/knapsack optimizer with move caps for 3/6-month RM restructures.",
                "Advanced Solver Lab exposes GA parameters for admin experimentation, not daily manager operation.");

        return new ActionCenterSummary(
                warehouseId,
                pendingPolicies,
                pendingSpaceRuns,
                draftSlottingPlans,
                draftPurchaseSuggestions,
                stockoutExposure,
                excessInventoryValue,
                scheduledMoves,
                latestSlotting != null ? nz(latestSlotting.getTotalDistanceSavedMeters()) : BigDecimal.ZERO,
                latestSlotting != null ? nz(latestSlotting.getConfirmedDistanceSavedMeters()) : BigDecimal.ZERO,
                policyForDecisionView != null ? policyForDecisionView.getStatus() : "NONE",
                latestSpace != null ? latestSpace.getStatus() : "NONE",
                latestSlotting != null ? latestSlotting.getStatus() : "NONE",
                latestSlotting != null && latestSlotting.getExecutionStatus() != null
                        ? latestSlotting.getExecutionStatus() : "NOT_STARTED",
                policyForDecisionView != null ? policyForDecisionView.getTotalStockDelta() : BigDecimal.ZERO,
                policyForDecisionView != null ? policyForDecisionView.getTotalPalletPositionsDelta() : BigDecimal.ZERO,
                latestSpace != null ? latestSpace.getTotalSpaceSavedPalletPositions() : BigDecimal.ZERO,
                latestSpace != null ? latestSpace.getTotalSpaceNeededPalletPositions() : BigDecimal.ZERO,
                latestSlotting != null ? nz(latestSlotting.getTotalMovesProposed()) : 0,
                actions,
                solverGuidance);
    }

    private <T> T first(List<T> rows) {
        return rows == null || rows.isEmpty() ? null : rows.get(0);
    }

    private int nz(Integer value) {
        return value != null ? value : 0;
    }

    private BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private String fmt(BigDecimal value) {
        if (value == null) {
            return "0";
        }
        return value.stripTrailingZeros().toPlainString();
    }

    public record ActionCenterSummary(
            UUID warehouseId,
            int pendingPolicyRuns,
            int pendingSpaceRuns,
            int draftSlottingPlans,
            int draftPurchaseSuggestions,
            int stockoutExposure,
            BigDecimal excessInventoryValue,
            int scheduledMoves,
            BigDecimal estimatedTravelReductionMeters,
            BigDecimal confirmedTravelReductionMeters,
            String latestPolicyStatus,
            String latestSpaceStatus,
            String latestSlottingStatus,
            String latestSlottingExecutionStatus,
            BigDecimal totalStockDelta,
            BigDecimal totalPalletDelta,
            BigDecimal totalSpaceSavedPalletPositions,
            BigDecimal totalSpaceNeededPalletPositions,
            int totalMovesProposed,
            List<ActionItem> actionItems,
            SolverGuidance solverGuidance) {}

    public record ActionItem(
            UUID sourceId,
            String type,
            String title,
            String description,
            String priority,
            String href,
            OffsetDateTime createdAt) {
        int priorityRank() {
            return switch (priority) {
                case "HIGH" -> 3;
                case "MEDIUM" -> 2;
                default -> 1;
            };
        }
    }

    public record SolverGuidance(
            String inboundOrderMode,
            String policySpaceMode,
            String slottingPlanMode,
            String advancedSolverMode) {}
}
