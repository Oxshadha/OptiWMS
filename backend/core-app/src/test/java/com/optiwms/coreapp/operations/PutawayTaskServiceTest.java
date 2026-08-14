package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PutawayTaskServiceTest {

    @Test
    void prevalidatedDestinationAnchorsThePlanForThatLine() {
        Fixture fixture = fixture("A-01-01-1-A", 10, 10);
        stubPlan(fixture, allocation("A-01-01-1-A", 10));

        fixture.service.createPutawayTasksForReceivedOrder(fixture.orderId, fixture.warehouseId);

        // The prevalidated bin is honoured rather than replaced by a free search.
        verify(fixture.locationSuggestionService)
                .suggestPutawayPlan(any(), any(), any(), any(), eq("A-01-01-1-A"));
        ArgumentCaptor<Task> created = ArgumentCaptor.forClass(Task.class);
        verify(fixture.taskService).create(created.capture());
        assertEquals("A-01-01-1-A", created.getValue().getLocationCode());
    }

    @Test
    void missingDestinationFailureIsRetriedInsteadOfCreatingUnsafeTask() {
        Fixture fixture = fixture(null, 10, 10);
        when(fixture.locationSuggestionService.suggestPutawayPlan(any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("capacity planner unavailable"));

        assertThrows(RuntimeException.class,
                () -> fixture.service.createPutawayTasksForReceivedOrder(fixture.orderId, fixture.warehouseId));

        verify(fixture.taskService, never()).create(any(Task.class));
    }

    @Test
    void emptyPlanFailsInsteadOfCreatingTaskWithoutDestination() {
        Fixture fixture = fixture(null, 10, 10);
        stubPlan(fixture);

        assertThrows(IllegalStateException.class,
                () -> fixture.service.createPutawayTasksForReceivedOrder(fixture.orderId, fixture.warehouseId));

        verify(fixture.taskService, never()).create(any(Task.class));
    }

    /** The reported scenario: 243 units of a material that palletises at 10 units per pallet. */
    @Test
    void multiPalletLineCreatesOneTaskPerPallet() {
        Fixture fixture = fixture(null, 243, 10);
        // The planner spread the receipt over three bins; 243 units is 25 pallets in total.
        stubPlan(fixture,
                allocation("A-01-01-1-A", 100),
                allocation("A-01-02-1-A", 100),
                allocation("A-01-03-1-A", 43));

        fixture.service.createPutawayTasksForReceivedOrder(fixture.orderId, fixture.warehouseId);

        ArgumentCaptor<Task> created = ArgumentCaptor.forClass(Task.class);
        verify(fixture.taskService, times(25)).create(created.capture());

        List<Task> tasks = created.getAllValues();
        // Every pallet is its own job, numbered 1..25 with no gaps or repeats.
        assertEquals(
                java.util.stream.IntStream.rangeClosed(1, 25).boxed().collect(Collectors.toList()),
                tasks.stream().map(Task::getHandlingUnitSeq).collect(Collectors.toList()));
        // Whole receipt is accounted for, and no pallet exceeds the units-per-pallet limit.
        assertEquals(243, tasks.stream().mapToInt(PutawayTaskServiceTest::palletQuantity).sum());
        assertTrue(tasks.stream().allMatch(task -> palletQuantity(task) <= 10));
        // Task numbers stay unique so the idempotency index cannot collide.
        assertEquals(25, tasks.stream().map(Task::getTaskNumber).distinct().count());
        assertEquals(10, tasks.stream().filter(t -> "A-01-01-1-A".equals(t.getLocationCode())).count());
        assertEquals(5, tasks.stream().filter(t -> "A-01-03-1-A".equals(t.getLocationCode())).count());
    }

    @Test
    void rerunOnlyCreatesPalletsThatAreMissing() {
        Fixture fixture = fixture(null, 30, 10);
        stubPlan(fixture, allocation("A-01-01-1-A", 30));

        // Pallets 1 and 2 already exist from an earlier partial run.
        when(fixture.taskService.findByTaskTypeAndReference("putaway", "order_item", fixture.itemId))
                .thenReturn(List.of(existingTask(1), existingTask(2)));

        fixture.service.createPutawayTasksForReceivedOrder(fixture.orderId, fixture.warehouseId);

        ArgumentCaptor<Task> created = ArgumentCaptor.forClass(Task.class);
        verify(fixture.taskService, times(1)).create(created.capture());
        assertEquals(3, created.getValue().getHandlingUnitSeq());
    }

    private static int palletQuantity(Task task) {
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("PUTAWAY_HU_QTY=(\\d+)").matcher(task.getNotes());
        assertTrue(matcher.find(), "task notes must scope the quantity to this pallet: " + task.getNotes());
        return Integer.parseInt(matcher.group(1));
    }

    private static Task existingTask(int sequence) {
        Task task = new Task();
        task.setHandlingUnitSeq(sequence);
        return task;
    }

    private static PutawayCapacityPlanningService.SplitPlanLine allocation(String locationCode, int quantity) {
        return new PutawayCapacityPlanningService.SplitPlanLine(locationCode, quantity, "test", null);
    }

    private void stubPlan(Fixture fixture, PutawayCapacityPlanningService.SplitPlanLine... allocations) {
        List<PutawayCapacityPlanningService.SplitPlanLine> lines = List.of(allocations);
        int planned = lines.stream()
                .mapToInt(PutawayCapacityPlanningService.SplitPlanLine::allocatedQuantity)
                .sum();
        when(fixture.locationSuggestionService.suggestPutawayPlan(any(), any(), any(), any(), any()))
                .thenReturn(new PutawayCapacityPlanningService.SplitPlanResult(
                        true, planned, planned, 0, null, null, null, lines, List.of()));
    }

    private Fixture fixture(String locationCode, int receivedQuantity, int unitsPerPallet) {
        UUID orderId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        TaskService taskService = mock(TaskService.class);
        OrderService orderService = mock(OrderService.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        MaterialService materialService = mock(MaterialService.class);
        LocationSuggestionService suggestionService = mock(LocationSuggestionService.class);

        Order order = new Order();
        order.setId(orderId);
        order.setOrderNumber("PO-20260810-000001");
        order.setOrderType("inbound");
        order.setWarehouseId(warehouseId);
        order.setPriority("normal");
        when(orderService.findById(orderId)).thenReturn(order);

        OrderItemEntity item = new OrderItemEntity();
        item.setId(itemId);
        item.setOrderId(orderId);
        item.setMaterialId(materialId);
        item.setPickedQuantity(receivedQuantity);
        item.setLocationCode(locationCode);
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));
        when(taskService.findByTaskTypeAndReference("putaway", "order_item", itemId))
                .thenReturn(List.of());

        Material material = new Material();
        material.setId(materialId);
        material.setMaterialCode("RM-TEST");
        material.setMaterialType("raw_material");
        material.setUnitsPerPallet(unitsPerPallet);
        when(materialService.findById(materialId)).thenReturn(material);

        PutawayTaskService service = new PutawayTaskService(
                taskService,
                orderService,
                orderItemRepository,
                materialService,
                suggestionService,
                new HandlingUnitCapacityService());
        return new Fixture(
                service, taskService, suggestionService, orderId, warehouseId, itemId);
    }

    private record Fixture(
            PutawayTaskService service,
            TaskService taskService,
            LocationSuggestionService locationSuggestionService,
            UUID orderId,
            UUID warehouseId,
            UUID itemId) {}
}
