package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OrderStatusService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PutawayServiceTest {

    /**
     * A receipt the warehouse could only partly place. Every task that exists is complete, but
     * those tasks cover 180 of the 250 units received, so 70 units are still sitting unlocated.
     * The order must stay open: closing it here is what silently stranded stock where picking
     * could never find it.
     */
    @Test
    void orderStaysOpenWhenCompletedTasksDoNotCoverTheReceipt() {
        Fixture fixture = fixture(250, 18, 10);

        fixture.service.completePutaway(
                fixture.taskId, "A-01-01-1-A", "", 10, fixture.materialId, fixture.workerId);

        verify(fixture.orderStatusService, never()).updateStatusAfterPutaway(any());
    }

    /** The same order once the remaining pallets have somewhere to go and the work is done. */
    @Test
    void orderClosesOnceCompletedTasksCoverTheReceipt() {
        Fixture fixture = fixture(250, 25, 10);

        fixture.service.completePutaway(
                fixture.taskId, "A-01-01-1-A", "", 10, fixture.materialId, fixture.workerId);

        verify(fixture.orderStatusService).updateStatusAfterPutaway(fixture.orderId);
    }

    /**
     * @param receivedQuantity units actually received on the line
     * @param completedTasks   how many completed pallet tasks exist for it
     * @param unitsPerPallet   units each of those tasks accounts for
     */
    private Fixture fixture(int receivedQuantity, int completedTasks, int unitsPerPallet) {
        UUID taskId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID materialId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();
        UUID workerId = UUID.randomUUID();

        TaskService taskService = mock(TaskService.class);
        InventoryService inventoryService = mock(InventoryService.class);
        MaterialLocationAssignmentService materialLocationService =
                mock(MaterialLocationAssignmentService.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        OrderStatusService orderStatusService = mock(OrderStatusService.class);
        OrderService orderService = mock(OrderService.class);
        OperationEventService operationEventService = mock(OperationEventService.class);

        Task task = new Task();
        task.setId(taskId);
        task.setTaskType("putaway");
        task.setStatus("pending");
        task.setReferenceType("order_item");
        task.setReferenceId(itemId);
        task.setWarehouseId(warehouseId);
        task.setHandlingUnitSeq(1);
        task.setNotes("PUTAWAY_HU_QTY=" + unitsPerPallet);
        when(taskService.findById(taskId)).thenReturn(task);

        OrderItemEntity item = new OrderItemEntity();
        item.setId(itemId);
        item.setOrderId(orderId);
        item.setMaterialId(materialId);
        item.setPickedQuantity(receivedQuantity);
        when(orderItemRepository.findById(itemId)).thenReturn(Optional.of(item));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));

        Order order = new Order();
        order.setId(orderId);
        order.setStatus("quality_approved");
        order.setWarehouseId(warehouseId);
        when(orderService.findById(orderId)).thenReturn(order);

        // Received-but-unlocated stock the pallet is moved out of.
        InventoryItem unlocated = new InventoryItem();
        unlocated.setMaterialId(materialId);
        unlocated.setWarehouseId(warehouseId);
        unlocated.setQuantity(receivedQuantity);
        unlocated.setAvailableQuantity(receivedQuantity);
        when(inventoryService.findByMaterialAndWarehouse(materialId, warehouseId))
                .thenReturn(List.of(unlocated));
        when(materialLocationService.assignMaterialToLocation(any(), any(), any(), any()))
                .thenReturn(new InventoryItem());

        // The tasks the completion check sees afterwards: all complete, together accounting for
        // completedTasks * unitsPerPallet units.
        List<Task> siblings = new ArrayList<>();
        for (int seq = 1; seq <= completedTasks; seq++) {
            Task done = new Task();
            done.setStatus("completed");
            done.setHandlingUnitSeq(seq);
            done.setNotes("PUTAWAY_HU_QTY=" + unitsPerPallet
                    + "\nPUTAWAY_PROGRESS=" + unitsPerPallet + "/" + unitsPerPallet);
            siblings.add(done);
        }
        when(taskService.findByTaskTypeAndReference("putaway", "order_item", itemId))
                .thenReturn(siblings);

        PutawayService service = new PutawayService(
                taskService,
                inventoryService,
                materialLocationService,
                orderItemRepository,
                orderStatusService,
                orderService,
                operationEventService);

        return new Fixture(service, orderStatusService, taskId, orderId, materialId, workerId);
    }

    private record Fixture(
            PutawayService service,
            OrderStatusService orderStatusService,
            UUID taskId,
            UUID orderId,
            UUID materialId,
            UUID workerId) {}
}
