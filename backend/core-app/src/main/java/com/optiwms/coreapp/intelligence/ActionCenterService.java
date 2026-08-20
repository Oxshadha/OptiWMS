package com.optiwms.coreapp.intelligence;

import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunEntity;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunRepository;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationLineEntity;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationLineRepository;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunEntity;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunRepository;
import com.optiwms.infra.intelligence.PlanningDecisionEventEntity;
import com.optiwms.infra.intelligence.PlanningDecisionEventRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import com.optiwms.infra.orders.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class ActionCenterService {
    private final InventoryPolicyRecommendationRunRepository policyRunRepository;
    private final InventoryPolicyRecommendationLineRepository policyLineRepository;
    private final SpaceOptimizationRunRepository spaceRunRepository;
    private final SlottingPlanRepository slottingPlanRepository;
    private final OrderRepository orderRepository;
    private final PlanningDecisionEventRepository decisionEventRepository;

    public ActionCenterService(
            InventoryPolicyRecommendationRunRepository policyRunRepository,
            InventoryPolicyRecommendationLineRepository policyLineRepository,
            SpaceOptimizationRunRepository spaceRunRepository,
            SlottingPlanRepository slottingPlanRepository,
            OrderRepository orderRepository,
            PlanningDecisionEventRepository decisionEventRepository) {
        this.policyRunRepository = policyRunRepository;
        this.policyLineRepository = policyLineRepository;
        this.spaceRunRepository = spaceRunRepository;
        this.slottingPlanRepository = slottingPlanRepository;
        this.orderRepository = orderRepository;
        this.decisionEventRepository = decisionEventRepository;
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
                .filter(run -> !temporarilyDeferred(run.getId(), "APPROVE_POLICY"))
                .findFirst()
                .orElse(null);
        int pendingPolicies = (int) policyRuns.stream()
                .filter(run -> reviewable.contains(run.getStatus()))
                .filter(run -> !temporarilyDeferred(run.getId(), "APPROVE_POLICY"))
                .count();
        int pendingSpaceRuns = (int) spaceRuns.stream()
                .filter(run -> reviewable.contains(run.getStatus()))
                .filter(run -> !temporarilyDeferred(run.getId(), "APPROVE_SPACE"))
                .count();
        int draftSlottingPlans = (int) slottingPlans.stream()
                .filter(run -> "DRAFT".equals(run.getStatus()))
                .filter(run -> !temporarilyDeferred(run.getId(), "APPROVE_SLOTTING_PLAN"))
                .count();
        int draftPurchaseSuggestions = (int) orderRepository.findOperationalByWarehouseId(warehouseId).stream()
                .filter(order -> "draft".equalsIgnoreCase(order.getStatus()))
                .filter(order -> order.getNotes() != null && order.getNotes().contains("Forecast policy purchase suggestion"))
                .count();
        InventoryPolicyRecommendationRunEntity policyForDecisionView = actionablePolicy;
        List<InventoryPolicyRecommendationLineEntity> actionableLines = actionablePolicy == null
                ? List.of()
                : policyLineRepository.findByRunIdOrderByMaterialCodeAsc(actionablePolicy.getId()).stream()
                        .filter(this::meaningfulChange)
                        .toList();
        int inventoryChanges = actionableLines.size();
        int stockoutExposure = (int) actionableLines.stream()
                .filter(line -> nz(line.getStockoutRiskScore()).compareTo(new BigDecimal("0.70")) >= 0)
                .count();
        int suggestedPurchases = (int) actionableLines.stream()
                .filter(line -> nz(line.getProposedOrderQty()).signum() > 0)
                .count();
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
                    null, "NOT_STARTED", true, null, 0));
        } else if (actionablePolicy != null) {
            actions.add(new ActionItem(
                    actionablePolicy.getId(),
                    "APPROVE_POLICY",
                    "Review " + inventoryChanges + " inventory policy changes",
                    suggestedPurchases + " products need a draft replenishment. The remaining rows adjust stock protection or storage capacity; unchanged products are excluded.",
                    suggestedPurchases > 0 ? "HIGH" : "MEDIUM",
                    "/admin/inventory-intelligence",
                    actionablePolicy.getCreatedAt(),
                    actionablePolicy.getStatus(),
                    true,
                    null,
                    inventoryChanges));
        }

        if (latestPolicy != null && "APPROVED".equals(latestPolicy.getStatus()) && latestSpace == null) {
            actions.add(new ActionItem(
                    latestPolicy.getId(),
                    "CREATE_SPACE_RUN",
                    "Optimize released and needed pallet space",
                    "Approved policy exists; create the storage impact run to reuse released compatible space.",
                    "HIGH",
                    "/admin/inventory-intelligence",
                    latestPolicy.getApprovedAt(), latestPolicy.getStatus(), true, null, 0));
        } else if (latestSpace != null && reviewable.contains(latestSpace.getStatus())
                && !temporarilyDeferred(latestSpace.getId(), "APPROVE_SPACE")) {
            actions.add(new ActionItem(
                    latestSpace.getId(),
                    "APPROVE_SPACE",
                    "Create slotting draft from space impact",
                    "Space run found "
                            + nz(latestSpace.getInfeasibleCount()) + " infeasible lines and "
                            + fmt(latestSpace.getTotalSpaceSavedPalletPositions()) + " saved pallet positions.",
                    latestSpace.getInfeasibleCount() != null && latestSpace.getInfeasibleCount() > 0 ? "HIGH" : "MEDIUM",
                    "/admin/inventory-intelligence",
                    latestSpace.getCreatedAt(), latestSpace.getStatus(), true, null,
                    nz(latestSpace.getHighRiskCount())));
        }

        if (latestSlotting == null) {
            actions.add(new ActionItem(
                    null,
                    "CREATE_SLOTTING_PLAN",
                    "Generate location plan",
                    "Create an on-demand slotting plan for pick-face and reserve locations.",
                    "MEDIUM",
                    "/admin/inventory-intelligence",
                    null, "NOT_STARTED", true, null, 0));
        } else if ("DRAFT".equals(latestSlotting.getStatus())) {
            // A deferred plan is still reported, carrying the date it was snoozed
            // to, so the UI can say why it is quiet and offer to review it early.
            OffsetDateTime slottingDeferredUntil =
                    deferredUntil(latestSlotting.getId(), "APPROVE_SLOTTING_PLAN");
            boolean eligible = Set.of("OPTIMAL", "FEASIBLE").contains(latestSlotting.getSolverStatus());
            actions.add(new ActionItem(
                    latestSlotting.getId(),
                    "APPROVE_SLOTTING_PLAN",
                    "Review " + nz(latestSlotting.getTotalMovesProposed()) + " proposed relocations",
                    "The six-month slotting plan proposes "
                            + nz(latestSlotting.getTotalMovesProposed()) + " moves under a "
                            + fmt(latestSlotting.getRelocationBudgetPct()) + "% relocation budget.",
                    latestSlotting.getTotalMovesProposed() != null && latestSlotting.getTotalMovesProposed() > 0 ? "HIGH" : "LOW",
                    "/admin/inventory-intelligence",
                    latestSlotting.getCreatedAt(),
                    latestSlotting.getStatus(),
                    eligible,
                    eligible ? null : "The optimizer result is " + Objects.toString(latestSlotting.getSolverStatus(), "not available")
                            + ". Recalculate the plan before approval.",
                    nz(latestSlotting.getTotalMovesProposed()),
                    slottingDeferredUntil));
        } else if ("APPROVED".equals(latestSlotting.getStatus())) {
            actions.add(new ActionItem(
                    latestSlotting.getId(),
                    "SCHEDULE_SLOTTING_PLAN",
                    "Schedule approved relocation work",
                    "Release the approved moves in the warehouse off-peak window so workers receive scan-based tasks.",
                    "MEDIUM",
                    "/admin/inventory-intelligence",
                    latestSlotting.getApprovedAt(), latestSlotting.getStatus(), true, null,
                    nz(latestSlotting.getTotalMovesProposed())));
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
                inventoryChanges,
                suggestedPurchases,
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

    private boolean temporarilyDeferred(UUID recommendationId, String type) {
        return deferredUntil(recommendationId, type) != null;
    }

    /** When this recommendation was snoozed to, or null when it is due now. */
    private OffsetDateTime deferredUntil(UUID recommendationId, String type) {
        if (recommendationId == null) return null;
        return decisionEventRepository
                .findFirstByRecommendationIdAndRecommendationTypeOrderByCreatedAtDesc(recommendationId, type)
                .filter(event -> "DEFERRED".equals(event.getAction()))
                .map(PlanningDecisionEventEntity::getDeferredUntil)
                .filter(until -> until.isAfter(OffsetDateTime.now()))
                .orElse(null);
    }

    private boolean meaningfulChange(InventoryPolicyRecommendationLineEntity line) {
        if (Set.of("DATA_INSUFFICIENT", "INFEASIBLE", "REJECTED").contains(line.getRecommendationStatus())) {
            return false;
        }
        return materiallyDifferent(line.getCurrentReorderPoint(), line.getProposedReorderPoint())
                || materiallyDifferent(line.getCurrentMaxStock(), line.getProposedMaxStock())
                || nz(line.getProposedOrderQty()).signum() > 0
                || nz(line.getPalletPositionsDelta()).abs().compareTo(BigDecimal.ONE) >= 0;
    }

    private boolean materiallyDifferent(BigDecimal current, BigDecimal proposed) {
        BigDecimal before = nz(current);
        BigDecimal after = nz(proposed);
        BigDecimal threshold = before.abs().multiply(new BigDecimal("0.02")).max(BigDecimal.ONE);
        return after.subtract(before).abs().compareTo(threshold) >= 0;
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
            int inventoryChanges,
            int suggestedPurchases,
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
            OffsetDateTime createdAt,
            String sourceStatus,
            boolean canApprove,
            String blockedReason,
            int affectedCount,
            OffsetDateTime deferredUntil) {

        /** An action that is due now; the common case. */
        public ActionItem(UUID sourceId, String type, String title, String description, String priority,
                String href, OffsetDateTime createdAt, String sourceStatus, boolean canApprove,
                String blockedReason, int affectedCount) {
            this(sourceId, type, title, description, priority, href, createdAt, sourceStatus,
                    canApprove, blockedReason, affectedCount, null);
        }

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
