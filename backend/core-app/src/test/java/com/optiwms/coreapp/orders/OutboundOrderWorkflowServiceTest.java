package com.optiwms.coreapp.orders;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.operations.MaterialLocationAssignmentService;
import com.optiwms.coreapp.operations.TaskOperationService;
import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.coreapp.operations.PackingService;
import com.optiwms.domain.operations.PackingRecord;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.inOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OutboundOrderWorkflowServiceTest {

    @Test
    void advancesAllocatedOrderThroughPickingBeforePicked() {
        UUID orderId = UUID.randomUUID();
        OrderService orderService = mock(OrderService.class);
        TaskService taskService = mock(TaskService.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);

        Order order = new Order();
        order.setId(orderId);
        order.setOrderType("outbound");
        order.setStatus("allocated");

        OrderItemEntity item = new OrderItemEntity();
        item.setQuantity(50);
        item.setPickedQuantity(50);

        Task task = new Task();
        task.setTaskType("picking");
        task.setReferenceType("order");
        task.setReferenceId(orderId);
        task.setStatus("completed");

        when(orderService.findById(orderId)).thenReturn(order);
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));
        when(taskService.findByType("picking")).thenReturn(List.of(task));
        PackingService packingService = mock(PackingService.class);
        when(packingService.findByOrderId(orderId)).thenReturn(List.of());

        OutboundOrderWorkflowService service = new OutboundOrderWorkflowService(
                orderService,
                taskService,
                orderItemRepository,
                mock(MaterialLocationAssignmentService.class),
                mock(InventoryService.class),
                mock(MaterialService.class),
                mock(TaskOperationService.class),
                packingService,
                mock(NotificationService.class));

        service.updateOrderStatusIfNeeded(orderId);

        var transitions = inOrder(orderService);
        transitions.verify(orderService).updateStatus(orderId, "picking");
        transitions.verify(orderService).updateStatus(orderId, "picked");

        // Reaching "picked" is what makes the order ready to pack. Without a record here the
        // packing queue stays empty and the order can never be shipped either.
        org.mockito.ArgumentCaptor<PackingRecord> opened =
                org.mockito.ArgumentCaptor.forClass(PackingRecord.class);
        verify(packingService).create(opened.capture());
        assertEquals(orderId, opened.getValue().getOrderId());
        // Opens at the manager gate, not ready-to-work: nothing reaches a packer unapproved.
        assertEquals("pending_approval", opened.getValue().getStatus());
    }
}
