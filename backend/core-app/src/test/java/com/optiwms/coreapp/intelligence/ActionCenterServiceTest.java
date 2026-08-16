package com.optiwms.coreapp.intelligence;

import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunEntity;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationLineRepository;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationLineEntity;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunRepository;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunEntity;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import com.optiwms.infra.orders.OrderRepository;
import com.optiwms.infra.intelligence.PlanningDecisionEventRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

class ActionCenterServiceTest {
    @Test
    void deferredSlottingPlanIsStillReportedWithItsDeferralDate() {
        UUID warehouse = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        var policies = org.mockito.Mockito.mock(InventoryPolicyRecommendationRunRepository.class);
        var policyLines = org.mockito.Mockito.mock(InventoryPolicyRecommendationLineRepository.class);
        var spaces = org.mockito.Mockito.mock(SpaceOptimizationRunRepository.class);
        var slotting = org.mockito.Mockito.mock(SlottingPlanRepository.class);
        var orders = org.mockito.Mockito.mock(OrderRepository.class);
        var decisions = org.mockito.Mockito.mock(PlanningDecisionEventRepository.class);

        SlottingPlanEntity draft = new SlottingPlanEntity();
        draft.setId(planId);
        draft.setStatus("DRAFT");
        draft.setSolverStatus("OPTIMAL");
        draft.setTotalMovesProposed(284);

        java.time.OffsetDateTime until = java.time.OffsetDateTime.now().plusDays(1);
        com.optiwms.infra.intelligence.PlanningDecisionEventEntity deferral =
                new com.optiwms.infra.intelligence.PlanningDecisionEventEntity();
        deferral.setAction("DEFERRED");
        deferral.setDeferredUntil(until);

        when(policies.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of());
        when(spaces.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of());
        when(slotting.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of(draft));
        when(orders.findOperationalByWarehouseId(warehouse)).thenReturn(List.of());
        when(decisions.findFirstByRecommendationIdAndRecommendationTypeOrderByCreatedAtDesc(
                planId, "APPROVE_SLOTTING_PLAN")).thenReturn(java.util.Optional.of(deferral));

        ActionCenterService.ActionCenterSummary result = new ActionCenterService(
                policies, policyLines, spaces, slotting, orders, decisions).summarize(warehouse);

        ActionCenterService.ActionItem plan = result.actionItems().stream()
                .filter(item -> "APPROVE_SLOTTING_PLAN".equals(item.type()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("deferred plan should still be reported"));
        assertEquals(until, plan.deferredUntil());
        assertEquals(284, plan.affectedCount());
        // The count that drives the KPI must still exclude it: it is not due yet.
        assertEquals(0, result.draftSlottingPlans());
    }

    @Test
    void undeferredSlottingPlanHasNoDeferralDate() {
        UUID warehouse = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        var policies = org.mockito.Mockito.mock(InventoryPolicyRecommendationRunRepository.class);
        var policyLines = org.mockito.Mockito.mock(InventoryPolicyRecommendationLineRepository.class);
        var spaces = org.mockito.Mockito.mock(SpaceOptimizationRunRepository.class);
        var slotting = org.mockito.Mockito.mock(SlottingPlanRepository.class);
        var orders = org.mockito.Mockito.mock(OrderRepository.class);
        var decisions = org.mockito.Mockito.mock(PlanningDecisionEventRepository.class);

        SlottingPlanEntity draft = new SlottingPlanEntity();
        draft.setId(planId);
        draft.setStatus("DRAFT");
        draft.setSolverStatus("OPTIMAL");
        draft.setTotalMovesProposed(284);

        when(policies.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of());
        when(spaces.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of());
        when(slotting.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of(draft));
        when(orders.findOperationalByWarehouseId(warehouse)).thenReturn(List.of());
        when(decisions.findFirstByRecommendationIdAndRecommendationTypeOrderByCreatedAtDesc(
                planId, "APPROVE_SLOTTING_PLAN")).thenReturn(java.util.Optional.empty());

        ActionCenterService.ActionCenterSummary result = new ActionCenterService(
                policies, policyLines, spaces, slotting, orders, decisions).summarize(warehouse);

        ActionCenterService.ActionItem plan = result.actionItems().stream()
                .filter(item -> "APPROVE_SLOTTING_PLAN".equals(item.type()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("draft plan should be reported"));
        assertEquals(null, plan.deferredUntil());
        assertEquals(1, result.draftSlottingPlans());
    }

    @Test
    void failedAndRolledBackRunsDoNotCountAsPendingManagerWork() {
        UUID warehouse = UUID.randomUUID();
        var policies = org.mockito.Mockito.mock(InventoryPolicyRecommendationRunRepository.class);
        var policyLines = org.mockito.Mockito.mock(InventoryPolicyRecommendationLineRepository.class);
        var spaces = org.mockito.Mockito.mock(SpaceOptimizationRunRepository.class);
        var slotting = org.mockito.Mockito.mock(SlottingPlanRepository.class);
        var orders = org.mockito.Mockito.mock(OrderRepository.class);
        var decisions = org.mockito.Mockito.mock(PlanningDecisionEventRepository.class);

        InventoryPolicyRecommendationRunEntity rolledBack = new InventoryPolicyRecommendationRunEntity();
        rolledBack.setStatus("ROLLED_BACK");
        SpaceOptimizationRunEntity failed = new SpaceOptimizationRunEntity();
        failed.setStatus("FAILED");
        SlottingPlanEntity cancelled = new SlottingPlanEntity();
        cancelled.setStatus("CANCELLED");
        when(policies.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of(rolledBack));
        when(spaces.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of(failed));
        when(slotting.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of(cancelled));
        when(orders.findOperationalByWarehouseId(warehouse)).thenReturn(List.of());

        ActionCenterService.ActionCenterSummary result = new ActionCenterService(
                policies, policyLines, spaces, slotting, orders, decisions).summarize(warehouse);
        assertEquals(0, result.pendingPolicyRuns());
        assertEquals(0, result.pendingSpaceRuns());
        assertEquals(0, result.draftSlottingPlans());
        assertEquals("NOT_STARTED", result.latestSlottingExecutionStatus());
        assertTrue(result.actionItems().stream().noneMatch(item -> item.type().startsWith("APPROVE_")));
    }

    @Test
    void reviewableRunDrivesDecisionStatusWhenNewerAuditRunWasRolledBack() {
        UUID warehouse = UUID.randomUUID();
        var policies = org.mockito.Mockito.mock(InventoryPolicyRecommendationRunRepository.class);
        var policyLines = org.mockito.Mockito.mock(InventoryPolicyRecommendationLineRepository.class);
        var spaces = org.mockito.Mockito.mock(SpaceOptimizationRunRepository.class);
        var slotting = org.mockito.Mockito.mock(SlottingPlanRepository.class);
        var orders = org.mockito.Mockito.mock(OrderRepository.class);
        var decisions = org.mockito.Mockito.mock(PlanningDecisionEventRepository.class);

        InventoryPolicyRecommendationRunEntity rolledBack = new InventoryPolicyRecommendationRunEntity();
        rolledBack.setStatus("ROLLED_BACK");
        rolledBack.setHighRiskCount(999);
        InventoryPolicyRecommendationRunEntity reviewable = new InventoryPolicyRecommendationRunEntity();
        reviewable.setId(UUID.randomUUID());
        reviewable.setStatus("READY_FOR_REVIEW");
        reviewable.setHighRiskCount(7);
        when(policies.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of(rolledBack, reviewable));
        when(spaces.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of());
        when(slotting.findByWarehouseIdOrderByCreatedAtDesc(warehouse)).thenReturn(List.of());
        when(orders.findOperationalByWarehouseId(warehouse)).thenReturn(List.of());
        InventoryPolicyRecommendationLineEntity changed = new InventoryPolicyRecommendationLineEntity();
        changed.setCurrentReorderPoint(new BigDecimal("100"));
        changed.setProposedReorderPoint(new BigDecimal("130"));
        changed.setCurrentMaxStock(new BigDecimal("200"));
        changed.setProposedMaxStock(new BigDecimal("260"));
        changed.setProposedOrderQty(new BigDecimal("80"));
        changed.setPalletPositionsDelta(new BigDecimal("2"));
        changed.setStockoutRiskScore(new BigDecimal("0.85"));
        changed.setRecommendationStatus("HIGH_RISK_REVIEW");
        when(policyLines.findByRunIdOrderByMaterialCodeAsc(reviewable.getId())).thenReturn(List.of(changed));

        ActionCenterService.ActionCenterSummary result = new ActionCenterService(
                policies, policyLines, spaces, slotting, orders, decisions).summarize(warehouse);
        assertEquals(1, result.pendingPolicyRuns());
        assertEquals("READY_FOR_REVIEW", result.latestPolicyStatus());
        assertEquals(1, result.inventoryChanges());
        assertEquals(1, result.stockoutExposure());
        assertEquals(reviewable.getId(), result.actionItems().stream()
                .filter(item -> "APPROVE_POLICY".equals(item.type()))
                .findFirst()
                .orElseThrow()
                .sourceId());
    }
}
