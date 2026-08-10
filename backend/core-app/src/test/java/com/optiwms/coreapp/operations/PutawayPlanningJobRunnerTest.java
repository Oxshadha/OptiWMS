package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PutawayPlanningJobRunnerTest {

    @Test
    void completesDurableJobAfterTaskPlanning() {
        Fixture fixture = fixture();

        fixture.runner.processAvailableJobs();

        verify(fixture.putawayTaskService)
                .createPutawayTasksForReceivedOrder(fixture.job.orderId(), fixture.job.warehouseId());
        verify(fixture.queue).markCompleted(fixture.job.id());
        verify(fixture.orderService, never()).updateStatus(fixture.job.orderId(), "destination_pending");
    }

    @Test
    void retryableFailureDoesNotChangeApprovedOrderStatus() {
        Fixture fixture = fixture();
        RuntimeException failure = new RuntimeException("planner temporarily unavailable");
        doThrow(failure).when(fixture.putawayTaskService)
                .createPutawayTasksForReceivedOrder(fixture.job.orderId(), fixture.job.warehouseId());
        when(fixture.queue.markFailed(fixture.job.id(), failure))
                .thenReturn(new PutawayPlanningJobQueue.FailureResult(false, 1, failure.getMessage()));

        fixture.runner.processAvailableJobs();

        verify(fixture.queue).markFailed(fixture.job.id(), failure);
        verify(fixture.orderService, never()).updateStatus(fixture.job.orderId(), "destination_pending");
    }

    @Test
    void exhaustedFailureMovesOrderToManualDestinationReview() {
        Fixture fixture = fixture();
        RuntimeException failure = new RuntimeException("no capacity-valid destination");
        doThrow(failure).when(fixture.putawayTaskService)
                .createPutawayTasksForReceivedOrder(fixture.job.orderId(), fixture.job.warehouseId());
        when(fixture.queue.markFailed(fixture.job.id(), failure))
                .thenReturn(new PutawayPlanningJobQueue.FailureResult(true, 5, failure.getMessage()));

        fixture.runner.processAvailableJobs();

        verify(fixture.orderService).updateStatus(fixture.job.orderId(), "destination_pending");
    }

    private Fixture fixture() {
        PutawayPlanningJobQueue queue = mock(PutawayPlanningJobQueue.class);
        PutawayTaskService putawayTaskService = mock(PutawayTaskService.class);
        OrderService orderService = mock(OrderService.class);
        var job = new PutawayPlanningJobQueue.ClaimedJob(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 1);
        when(queue.claimBatch(10)).thenReturn(List.of(job));
        PutawayPlanningJobRunner runner = new PutawayPlanningJobRunner(
                queue, putawayTaskService, orderService, 10);
        return new Fixture(runner, queue, putawayTaskService, orderService, job);
    }

    private record Fixture(
            PutawayPlanningJobRunner runner,
            PutawayPlanningJobQueue queue,
            PutawayTaskService putawayTaskService,
            OrderService orderService,
            PutawayPlanningJobQueue.ClaimedJob job) {}
}
