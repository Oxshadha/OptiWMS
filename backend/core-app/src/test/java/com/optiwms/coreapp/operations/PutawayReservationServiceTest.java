package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.operations.InboundPutawayAllocationEntity;
import com.optiwms.infra.operations.InboundPutawayAllocationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PutawayReservationServiceTest {

    private final UUID warehouseId = UUID.randomUUID();

    /**
     * Space is claimed by two different things before stock physically lands: a planned allocation
     * and an open putaway task. Both must count, or a bin already spoken for gets offered again.
     */
    @Test
    void countsBothPlannedAllocationsAndOpenTasks() {
        Fixture fixture = fixture();
        when(fixture.allocations.findLiveByWarehouse(warehouseId))
                .thenReturn(List.of(allocation("A-01-01-1-A", 1)));
        when(fixture.tasks.findByWarehouseAndTypeAndStatus(warehouseId, "putaway", "pending"))
                .thenReturn(List.of(task("A-01-02-1-A")));
        when(fixture.tasks.findByWarehouseAndTypeAndStatus(warehouseId, "putaway", "in_progress"))
                .thenReturn(List.of(task("A-01-03-1-A")));

        Map<String, Integer> reserved = fixture.service.reservedPalletsByLocation(warehouseId);

        assertEquals(1, reserved.get("A-01-01-1-A"));
        assertEquals(1, reserved.get("A-01-02-1-A"));
        assertEquals(1, reserved.get("A-01-03-1-A"));
    }

    /**
     * Once a line's tasks exist the tasks hold the space, so the allocation must stop counting.
     * Counting both would reserve every pallet twice and shrink the warehouse on paper.
     */
    @Test
    void doesNotDoubleCountALineThatHasBecomeTasks() {
        Fixture fixture = fixture();
        // findLiveByWarehouse only returns 'planned' rows, so a tasked line contributes nothing.
        when(fixture.allocations.findLiveByWarehouse(warehouseId)).thenReturn(List.of());
        when(fixture.tasks.findByWarehouseAndTypeAndStatus(warehouseId, "putaway", "pending"))
                .thenReturn(List.of(task("A-01-01-1-A")));
        when(fixture.tasks.findByWarehouseAndTypeAndStatus(warehouseId, "putaway", "in_progress"))
                .thenReturn(List.of());

        Map<String, Integer> reserved = fixture.service.reservedPalletsByLocation(warehouseId);

        assertEquals(1, reserved.get("A-01-01-1-A"), "the task holds the space exactly once");
    }

    /** Completed and cancelled tasks are not carrying anything, so they hold no space. */
    @Test
    void ignoresTasksThatAreNoLongerOpen() {
        Fixture fixture = fixture();
        when(fixture.allocations.findLiveByWarehouse(warehouseId)).thenReturn(List.of());
        when(fixture.tasks.findByWarehouseAndTypeAndStatus(any(), any(), any())).thenReturn(List.of());

        assertTrue(fixture.service.reservedPalletsByLocation(warehouseId).isEmpty());
    }

    /** Cancelling an order must free its racking; otherwise a receipt that never comes holds bins forever. */
    @Test
    void releasingAnOrderFreesItsClaims() {
        Fixture fixture = fixture();
        UUID orderId = UUID.randomUUID();
        when(fixture.allocations.releaseForOrder(orderId)).thenReturn(3);

        fixture.service.releaseForOrder(orderId);

        verify(fixture.allocations).releaseForOrder(orderId);
    }

    /** Re-planning a line replaces its claim rather than stacking a second one on top. */
    @Test
    void reservingALineReplacesItsPreviousClaim() {
        Fixture fixture = fixture();
        UUID orderId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        fixture.service.reserve(orderId, itemId, warehouseId, UUID.randomUUID(), BigDecimal.valueOf(100),
                List.of(new PutawayCapacityPlanningService.SplitPlanLine("A-01-01-1-A", 100, "test", null),
                        new PutawayCapacityPlanningService.SplitPlanLine("A-01-02-1-A", 50, "test", null)));

        verify(fixture.allocations).updateStatusForItem(
                eq(itemId), eq(InboundPutawayAllocationEntity.STATUS_RELEASED));

        ArgumentCaptor<InboundPutawayAllocationEntity> saved =
                ArgumentCaptor.forClass(InboundPutawayAllocationEntity.class);
        verify(fixture.allocations, org.mockito.Mockito.times(2)).save(saved.capture());

        assertEquals(1, saved.getAllValues().get(0).getPallets());
        assertEquals(100, saved.getAllValues().get(0).getQuantity());
        // 50 units of a 100/pallet SKU still occupies a whole pallet slot.
        assertEquals(1, saved.getAllValues().get(1).getPallets());
    }

    private InboundPutawayAllocationEntity allocation(String locationCode, int pallets) {
        InboundPutawayAllocationEntity entity = new InboundPutawayAllocationEntity();
        entity.setLocationCode(locationCode);
        entity.setPallets(pallets);
        entity.setStatus(InboundPutawayAllocationEntity.STATUS_PLANNED);
        return entity;
    }

    private Task task(String locationCode) {
        Task task = new Task();
        task.setTaskType("putaway");
        task.setLocationCode(locationCode);
        return task;
    }

    private Fixture fixture() {
        InboundPutawayAllocationRepository allocations = mock(InboundPutawayAllocationRepository.class);
        TaskService tasks = mock(TaskService.class);
        when(tasks.findByWarehouseAndTypeAndStatus(any(), any(), any())).thenReturn(List.of());
        return new Fixture(
                new PutawayReservationService(allocations, tasks, new HandlingUnitCapacityService()),
                allocations,
                tasks);
    }

    private record Fixture(
            PutawayReservationService service,
            InboundPutawayAllocationRepository allocations,
            TaskService tasks) {}
}
