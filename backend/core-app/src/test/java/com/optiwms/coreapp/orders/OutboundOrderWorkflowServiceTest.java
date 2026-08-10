package com.optiwms.coreapp.orders;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.operations.MaterialLocationAssignmentService;
import com.optiwms.coreapp.operations.TaskOperationService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
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

        OutboundOrderWorkflowService service = new OutboundOrderWorkflowService(
                orderService,
                taskService,
                orderItemRepository,
                mock(MaterialLocationAssignmentService.class),
                mock(InventoryService.class),
                mock(MaterialService.class),
                mock(TaskOperationService.class));

        service.updateOrderStatusIfNeeded(orderId);

        var transitions = inOrder(orderService);
        transitions.verify(orderService).updateStatus(orderId, "picking");
        transitions.verify(orderService).updateStatus(orderId, "picked");
    }
}
