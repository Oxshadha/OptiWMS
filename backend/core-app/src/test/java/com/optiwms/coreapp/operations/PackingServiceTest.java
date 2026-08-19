package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.operations.PackingRecord;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.operations.PackingRecordEntity;
import com.optiwms.infra.operations.PackingRecordRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PackingServiceTest {

    @Test
    void completesNormalPickedOrderThroughValidPackingTransitions() {
        Fixture fixture = fixture("picked");

        fixture.service.create(fixture.record);

        var transitions = inOrder(fixture.orderService);
        transitions.verify(fixture.orderService).updateStatus(fixture.orderId, "packing");
        transitions.verify(fixture.orderService).updateStatus(fixture.orderId, "ready_to_ship");
        verify(fixture.orderService).updateWorkerRecord(fixture.orderId, fixture.packerId, "packed");
    }

    @Test
    void recordsLatePackingAuditWithoutReversingShippedOrder() {
        Fixture fixture = fixture("shipped");

        fixture.service.create(fixture.record);

        verify(fixture.orderService, never()).updateStatus(any(), any());
        verify(fixture.orderService).updateWorkerRecord(fixture.orderId, fixture.packerId, "packed");
        verify(fixture.repository).save(any(PackingRecordEntity.class));
    }

    /**
     * The manager gate. A record opened by picking must not become work until it is approved,
     * and approving is what raises the packer's task.
     */
    @Test
    void approvalReleasesTheJobAndRaisesThePackerTask() {
        UUID orderId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        OrderService orderService = mock(OrderService.class);
        PackingRecordRepository repository = mock(PackingRecordRepository.class);
        TaskService taskService = mock(TaskService.class);

        Order order = new Order();
        order.setId(orderId);
        order.setOrderNumber("SO-TEST-000009");
        order.setOrderType("outbound");
        order.setWarehouseId(UUID.randomUUID());
        when(orderService.findById(orderId)).thenReturn(order);
        when(taskService.findByTaskTypeAndReference("packing", "order", orderId)).thenReturn(List.of());

        PackingRecordEntity entity = new PackingRecordEntity();
        entity.setId(recordId);
        entity.setOrderId(orderId);
        entity.setOrderNumber(order.getOrderNumber());
        entity.setStatus("pending_approval");
        when(repository.findById(recordId)).thenReturn(java.util.Optional.of(entity));
        when(repository.save(any(PackingRecordEntity.class))).thenAnswer(i -> i.getArgument(0));

        PackingService service = new PackingService(
                repository, orderService, mock(OperationEventService.class), taskService);

        PackingRecord approved = service.approve(recordId, UUID.randomUUID());

        assertEquals("pending", approved.getStatus());
        ArgumentCaptor<Task> raised = ArgumentCaptor.forClass(Task.class);
        verify(taskService).create(raised.capture());
        assertEquals("packing", raised.getValue().getTaskType());
        assertEquals(orderId, raised.getValue().getReferenceId());
    }

    /** Approving twice must not raise a second task for the same order. */
    @Test
    void approvingAnAlreadyReleasedJobChangesNothing() {
        UUID recordId = UUID.randomUUID();
        PackingRecordRepository repository = mock(PackingRecordRepository.class);
        TaskService taskService = mock(TaskService.class);

        PackingRecordEntity entity = new PackingRecordEntity();
        entity.setId(recordId);
        entity.setOrderId(UUID.randomUUID());
        entity.setStatus("pending");
        when(repository.findById(recordId)).thenReturn(java.util.Optional.of(entity));

        PackingService service = new PackingService(
                repository, mock(OrderService.class), mock(OperationEventService.class), taskService);

        service.approve(recordId, null);

        verify(taskService, never()).create(any(Task.class));
        verify(repository, never()).save(any(PackingRecordEntity.class));
    }

    private Fixture fixture(String orderStatus) {
        UUID orderId = UUID.randomUUID();
        UUID packerId = UUID.randomUUID();
        OrderService orderService = mock(OrderService.class);
        PackingRecordRepository repository = mock(PackingRecordRepository.class);
        TaskService taskService = mock(TaskService.class);

        Order order = new Order();
        order.setId(orderId);
        order.setOrderNumber("SO-TEST-000001");
        order.setStatus(orderStatus);
        order.setOrderType("outbound");
        when(orderService.findById(orderId)).thenReturn(order);

        Task completedPackingTask = new Task();
        completedPackingTask.setStatus("completed");
        when(taskService.findByTaskTypeAndReference("packing", "order", orderId))
                .thenReturn(List.of(completedPackingTask));
        when(taskService.create(any(Task.class))).thenAnswer(invocation -> {
            Task created = invocation.getArgument(0);
            created.setId(UUID.randomUUID());
            return created;
        });
        when(repository.save(any(PackingRecordEntity.class)))
                .thenAnswer(invocation -> {
                    PackingRecordEntity saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });

        PackingRecord record = new PackingRecord();
        record.setOrderId(orderId);
        record.setOrderNumber(order.getOrderNumber());
        record.setPackerId(packerId);
        record.setStatus("packed");

        PackingService service = new PackingService(
                repository,
                orderService,
                mock(OperationEventService.class),
                taskService);
        return new Fixture(service, repository, orderService, record, orderId, packerId);
    }

    private record Fixture(
            PackingService service,
            PackingRecordRepository repository,
            OrderService orderService,
            PackingRecord record,
            UUID orderId,
            UUID packerId) {
    }
}
