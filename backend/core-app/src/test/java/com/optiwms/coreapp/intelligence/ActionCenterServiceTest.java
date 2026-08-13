package com.optiwms.coreapp.intelligence;

import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunEntity;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunRepository;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunEntity;
import com.optiwms.infra.forecastspace.SpaceOptimizationRunRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import com.optiwms.infra.orders.OrderRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

class ActionCenterServiceTest {
    @Test
    void failedAndRolledBackRunsDoNotCountAsPendingManagerWork() {
        UUID warehouse = UUID.randomUUID();
        var policies = org.mockito.Mockito.mock(InventoryPolicyRecommendationRunRepository.class);
        var spaces = org.mockito.Mockito.mock(SpaceOptimizationRunRepository.class);
        var slotting = org.mockito.Mockito.mock(SlottingPlanRepository.class);
        var orders = org.mockito.Mockito.mock(OrderRepository.class);

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

        ActionCenterService.ActionCenterSummary result = new ActionCenterService(policies, spaces, slotting, orders).summarize(warehouse);
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
        var spaces = org.mockito.Mockito.mock(SpaceOptimizationRunRepository.class);
        var slotting = org.mockito.Mockito.mock(SlottingPlanRepository.class);
        var orders = org.mockito.Mockito.mock(OrderRepository.class);

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

        ActionCenterService.ActionCenterSummary result = new ActionCenterService(policies, spaces, slotting, orders).summarize(warehouse);
        assertEquals(1, result.pendingPolicyRuns());
        assertEquals("READY_FOR_REVIEW", result.latestPolicyStatus());
        assertEquals(7, result.stockoutExposure());
        assertEquals(reviewable.getId(), result.actionItems().stream()
                .filter(item -> "APPROVE_POLICY".equals(item.type()))
                .findFirst()
                .orElseThrow()
                .sourceId());
    }
}
