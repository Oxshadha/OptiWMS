package com.optiwms.coreapp.intelligence;

import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunEntity;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunRepository;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunEntity;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class ActionCenterService {
    private final InventoryPolicyRecommendationRunRepository policyRunRepository;
    private final SpaceOptimizationRunRepository spaceRunRepository;
    private final SlottingPlanRepository slottingPlanRepository;

    public ActionCenterService(
            InventoryPolicyRecommendationRunRepository policyRunRepository,
            SpaceOptimizationRunRepository spaceRunRepository,
            SlottingPlanRepository slottingPlanRepository) {
        this.policyRunRepository = policyRunRepository;
        this.spaceRunRepository = spaceRunRepository;
        this.slottingPlanRepository = slottingPlanRepository;
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

        int pendingPolicies = (int) policyRuns.stream().filter(run -> !"APPROVED".equals(run.getStatus())).count();
        int pendingSpaceRuns = (int) spaceRuns.stream().filter(run -> !"APPROVED".equals(run.getStatus())).count();
        int draftSlottingPlans = (int) slottingPlans.stream().filter(run -> "DRAFT".equals(run.getStatus())).count();

        List<ActionItem> actions = new ArrayList<>();
        if (latestPolicy == null) {
            actions.add(new ActionItem(
                    "CREATE_POLICY",
                    "Generate inventory policy",
                    "Create min/max, reorder point, and order quantity recommendations from forecast demand.",
                    "HIGH",
                    "/admin/replenishment/forecast-space",
                    null));
        } else if (!"APPROVED".equals(latestPolicy.getStatus())) {
            actions.add(new ActionItem(
                    "APPROVE_POLICY",
                    "Review min/max policy",
                    "Pending forecast-driven policy run has "
                            + nz(latestPolicy.getHighRiskCount()) + " high-risk and "
                            + nz(latestPolicy.getDataInsufficientCount()) + " data-gap lines.",
                    latestPolicy.getHighRiskCount() != null && latestPolicy.getHighRiskCount() > 0 ? "HIGH" : "MEDIUM",
                    "/admin/replenishment/forecast-space",
                    latestPolicy.getCreatedAt()));
        }

        if (latestPolicy != null && "APPROVED".equals(latestPolicy.getStatus()) && latestSpace == null) {
            actions.add(new ActionItem(
                    "CREATE_SPACE_RUN",
                    "Optimize released and needed pallet space",
                    "Approved policy exists; create the storage impact run to reuse released compatible space.",
                    "HIGH",
                    "/admin/replenishment/forecast-space",
                    latestPolicy.getApprovedAt()));
        } else if (latestSpace != null && !"APPROVED".equals(latestSpace.getStatus())) {
            actions.add(new ActionItem(
                    "APPROVE_SPACE",
                    "Create slotting draft from space impact",
                    "Space run found "
                            + nz(latestSpace.getInfeasibleCount()) + " infeasible lines and "
                            + fmt(latestSpace.getTotalSpaceSavedPalletPositions()) + " saved pallet positions.",
                    latestSpace.getInfeasibleCount() != null && latestSpace.getInfeasibleCount() > 0 ? "HIGH" : "MEDIUM",
                    "/admin/replenishment/forecast-space",
                    latestSpace.getCreatedAt()));
        }

        if (latestSlotting == null) {
            actions.add(new ActionItem(
                    "CREATE_SLOTTING_PLAN",
                    "Generate location plan",
                    "Create an on-demand slotting plan for pick-face and reserve locations.",
                    "MEDIUM",
                    "/admin/slotting-plans",
                    null));
        } else if ("DRAFT".equals(latestSlotting.getStatus())) {
            actions.add(new ActionItem(
                    "APPROVE_SLOTTING_PLAN",
                    "Approve location plan",
                    "Draft plan proposes "
                            + nz(latestSlotting.getTotalMovesProposed()) + " moves under a "
                            + fmt(latestSlotting.getRelocationBudgetPct()) + "% relocation budget.",
                    latestSlotting.getTotalMovesProposed() != null && latestSlotting.getTotalMovesProposed() > 0 ? "HIGH" : "LOW",
                    "/admin/slotting-plans",
                    latestSlotting.getCreatedAt()));
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
                latestPolicy != null ? latestPolicy.getStatus() : "NONE",
                latestSpace != null ? latestSpace.getStatus() : "NONE",
                latestSlotting != null ? latestSlotting.getStatus() : "NONE",
                latestPolicy != null ? latestPolicy.getTotalStockDelta() : BigDecimal.ZERO,
                latestPolicy != null ? latestPolicy.getTotalPalletPositionsDelta() : BigDecimal.ZERO,
                latestSpace != null ? latestSpace.getTotalSpaceSavedPalletPositions() : BigDecimal.ZERO,
                latestSpace != null ? latestSpace.getTotalSpaceNeededPalletPositions() : BigDecimal.ZERO,
                latestSlotting != null ? latestSlotting.getTotalMovesProposed() : 0,
                actions,
                solverGuidance);
    }

    private <T> T first(List<T> rows) {
        return rows == null || rows.isEmpty() ? null : rows.get(0);
    }

    private int nz(Integer value) {
        return value != null ? value : 0;
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
            String latestPolicyStatus,
            String latestSpaceStatus,
            String latestSlottingStatus,
            BigDecimal totalStockDelta,
            BigDecimal totalPalletDelta,
            BigDecimal totalSpaceSavedPalletPositions,
            BigDecimal totalSpaceNeededPalletPositions,
            int totalMovesProposed,
            List<ActionItem> actionItems,
            SolverGuidance solverGuidance) {}

    public record ActionItem(
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
