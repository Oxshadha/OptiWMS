package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PutawayTaskServiceTest {

    @Test
    void prevalidatedDestinationCreatesTaskWithoutCallingFallbackPlanner() {
        Fixture fixture = fixture("A-01-01-1-A");

        fixture.service.createPutawayTasksForReceivedOrder(fixture.orderId, fixture.warehouseId);

        verify(fixture.locationSuggestionService, never())
                .suggestPutawayLocation(any(), any(), any(), any());
        verify(fixture.taskService).create(any(Task.class));
    }

    @Test
    void missingDestinationFailureIsRetriedInsteadOfCreatingUnsafeTask() {
        Fixture fixture = fixture(null);
        when(fixture.locationSuggestionService.suggestPutawayLocation(any(), any(), any(), any()))
                .thenThrow(new RuntimeException("capacity planner unavailable"));

        assertThrows(RuntimeException.class,
                () -> fixture.service.createPutawayTasksForReceivedOrder(fixture.orderId, fixture.warehouseId));

        verify(fixture.taskService, never()).create(any(Task.class));
    }

    private Fixture fixture(String locationCode) {
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
        item.setPickedQuantity(10);
        item.setLocationCode(locationCode);
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));
        when(taskService.findByTaskTypeAndReference("putaway", "order_item", itemId))
                .thenReturn(List.of());

        Material material = new Material();
        material.setId(materialId);
        material.setMaterialCode("RM-TEST");
        material.setMaterialType("raw_material");
        when(materialService.findById(materialId)).thenReturn(material);

        PutawayTaskService service = new PutawayTaskService(
                taskService,
                orderService,
                orderItemRepository,
                materialService,
                suggestionService);
        return new Fixture(
                service, taskService, suggestionService, orderId, warehouseId);
    }

    private record Fixture(
            PutawayTaskService service,
            TaskService taskService,
            LocationSuggestionService locationSuggestionService,
            UUID orderId,
            UUID warehouseId) {}
}
