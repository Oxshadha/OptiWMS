package com.optiwms.coreapp.quality;

import com.optiwms.coreapp.operations.GrnService;
import com.optiwms.coreapp.operations.OperationEventService;
import com.optiwms.coreapp.operations.PutawayPlanningJobQueue;
import com.optiwms.coreapp.operations.ReturnService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.domain.orders.Order;
import com.optiwms.infra.operations.GrnEntity;
import com.optiwms.infra.quality.QualityCheckEntity;
import com.optiwms.infra.quality.QualityCheckRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QualityCheckServiceTest {

    @Test
    void finalApprovalCommitsWorkflowStateAndOnlyEnqueuesPutawayPlanning() {
        UUID qualityId = UUID.randomUUID();
        UUID grnId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();

        QualityCheckRepository repository = mock(QualityCheckRepository.class);
        OrderService orderService = mock(OrderService.class);
        PutawayPlanningJobQueue queue = mock(PutawayPlanningJobQueue.class);
        GrnService grnService = mock(GrnService.class);

        QualityCheckEntity check = new QualityCheckEntity();
        check.setId(qualityId);
        check.setGrnId(grnId);
        check.setQtyReceived(BigDecimal.TEN);
        check.setQtyPassed(BigDecimal.ZERO);
        check.setQtyRejected(BigDecimal.ZERO);
        check.setApprovalStatus("PENDING");
        when(repository.findById(qualityId)).thenReturn(java.util.Optional.of(check));
        when(repository.save(check)).thenReturn(check);
        when(repository.findByGrnId(grnId)).thenReturn(List.of(check));

        GrnEntity grn = new GrnEntity();
        grn.setId(grnId);
        grn.setPoId(orderId);
        when(grnService.findById(grnId)).thenReturn(grn);

        Order order = new Order();
        order.setId(orderId);
        order.setWarehouseId(warehouseId);
        when(orderService.findById(orderId)).thenReturn(order);

        QualityCheckService service = new QualityCheckService(
                repository,
                orderService,
                queue,
                mock(ReturnService.class),
                grnService,
                mock(OperationEventService.class));

        var approved = service.approve(qualityId, null);

        assertEquals("APPROVED", approved.getApprovalStatus());
        verify(orderService).updateStatus(orderId, "quality_approved");
        verify(grnService).updateStatus(grnId, "COMPLETED");
        verify(queue).enqueue(orderId, warehouseId);
    }
}
