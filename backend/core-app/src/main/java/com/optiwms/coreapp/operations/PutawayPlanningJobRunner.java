package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PutawayPlanningJobRunner {

    private static final Logger log = LoggerFactory.getLogger(PutawayPlanningJobRunner.class);

    private final PutawayPlanningJobQueue queue;
    private final PutawayTaskService putawayTaskService;
    private final OrderService orderService;
    private final int batchSize;

    public PutawayPlanningJobRunner(
            PutawayPlanningJobQueue queue,
            PutawayTaskService putawayTaskService,
            OrderService orderService,
            @Value("${putaway.planning.batch-size:10}") int batchSize) {
        this.queue = queue;
        this.putawayTaskService = putawayTaskService;
        this.orderService = orderService;
        this.batchSize = Math.max(1, Math.min(batchSize, 100));
    }

    @Scheduled(fixedDelayString = "${putaway.planning.poll-delay-ms:1000}")
    public void processAvailableJobs() {
        List<PutawayPlanningJobQueue.ClaimedJob> jobs = queue.claimBatch(batchSize);
        for (PutawayPlanningJobQueue.ClaimedJob job : jobs) {
            process(job);
        }
    }

    private void process(PutawayPlanningJobQueue.ClaimedJob job) {
        try {
            // Deliberately outside a surrounding transaction. Repository reads and
            // each task insert use their own short-lived connections.
            putawayTaskService.createPutawayTasksForReceivedOrder(job.orderId(), job.warehouseId());
            queue.markCompleted(job.id());
            log.info("Putaway planning completed for order {} on attempt {}", job.orderId(), job.attempt());
        } catch (Exception failure) {
            PutawayPlanningJobQueue.FailureResult result = queue.markFailed(job.id(), failure);
            if (result.terminal()) {
                markOrderDestinationPending(job, result);
            } else {
                log.warn("Putaway planning will retry for order {} after attempt {}: {}",
                        job.orderId(), result.attempts(), result.error());
            }
        }
    }

    private void markOrderDestinationPending(
            PutawayPlanningJobQueue.ClaimedJob job,
            PutawayPlanningJobQueue.FailureResult result) {
        try {
            orderService.updateStatus(job.orderId(), "destination_pending");
        } catch (Exception statusFailure) {
            log.error("Could not mark order {} destination_pending", job.orderId(), statusFailure);
        }
        log.error("Putaway planning needs manual destination review for order {} after {} attempts: {}",
                job.orderId(), result.attempts(), result.error());
    }
}
