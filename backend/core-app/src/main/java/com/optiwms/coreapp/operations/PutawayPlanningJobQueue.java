package com.optiwms.coreapp.operations;

import com.optiwms.infra.operations.PutawayPlanningJobEntity;
import com.optiwms.infra.operations.PutawayPlanningJobRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PutawayPlanningJobQueue {

    private final PutawayPlanningJobRepository repository;
    private final int maxAttempts;
    private final long staleLockSeconds;

    public PutawayPlanningJobQueue(
            PutawayPlanningJobRepository repository,
            @Value("${putaway.planning.max-attempts:5}") int maxAttempts,
            @Value("${putaway.planning.stale-lock-seconds:300}") long staleLockSeconds) {
        this.repository = repository;
        this.maxAttempts = Math.max(maxAttempts, 1);
        this.staleLockSeconds = Math.max(staleLockSeconds, 30L);
    }

    /** Called inside the quality approval transaction. */
    @Transactional
    public boolean enqueue(UUID orderId, UUID warehouseId) {
        if (orderId == null || warehouseId == null) {
            throw new IllegalArgumentException("Order and warehouse are required for putaway planning");
        }
        LocalDateTime now = LocalDateTime.now();
        return repository.enqueueIfAbsent(UUID.randomUUID(), orderId, warehouseId, now) == 1;
    }

    /**
     * Claims work while holding row locks, then commits before any planning is
     * performed. SKIP LOCKED makes this safe across multiple application nodes.
     */
    @Transactional
    public List<ClaimedJob> claimBatch(int requestedBatchSize) {
        int batchSize = Math.max(1, Math.min(requestedBatchSize, 100));
        LocalDateTime now = LocalDateTime.now();
        List<PutawayPlanningJobEntity> jobs = repository.findClaimable(
                now,
                now.minusSeconds(staleLockSeconds),
                batchSize);

        for (PutawayPlanningJobEntity job : jobs) {
            job.setStatus("PROCESSING");
            job.setAttemptCount(job.getAttemptCount() + 1);
            job.setLockedAt(now);
            job.setLastError(null);
        }
        repository.saveAll(jobs);
        repository.flush();

        return jobs.stream()
                .map(job -> new ClaimedJob(
                        job.getId(),
                        job.getOrderId(),
                        job.getWarehouseId(),
                        job.getAttemptCount()))
                .toList();
    }

    @Transactional
    public void markCompleted(UUID jobId) {
        PutawayPlanningJobEntity job = find(jobId);
        LocalDateTime now = LocalDateTime.now();
        job.setStatus("COMPLETED");
        job.setCompletedAt(now);
        job.setLockedAt(null);
        job.setLastError(null);
        job.setNextAttemptAt(now);
        repository.save(job);
    }

    @Transactional
    public FailureResult markFailed(UUID jobId, Throwable failure) {
        PutawayPlanningJobEntity job = find(jobId);
        String message = safeError(failure);
        boolean terminal = job.getAttemptCount() >= maxAttempts;
        job.setStatus(terminal ? "DESTINATION_PENDING" : "RETRY");
        job.setLockedAt(null);
        job.setLastError(message);
        job.setNextAttemptAt(LocalDateTime.now().plusSeconds(backoffSeconds(job.getAttemptCount())));
        repository.save(job);
        return new FailureResult(terminal, job.getAttemptCount(), message);
    }

    private PutawayPlanningJobEntity find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalStateException("Putaway planning job not found: " + id));
    }

    private long backoffSeconds(int attempt) {
        int exponent = Math.max(0, Math.min(attempt - 1, 6));
        return Math.min(300L, 5L * (1L << exponent));
    }

    private String safeError(Throwable failure) {
        String message = failure != null ? failure.getMessage() : null;
        if (message == null || message.isBlank()) {
            message = failure != null ? failure.getClass().getSimpleName() : "Unknown planning error";
        }
        return message.length() <= 2000 ? message : message.substring(0, 2000);
    }

    public record ClaimedJob(UUID id, UUID orderId, UUID warehouseId, int attempt) {}

    public record FailureResult(boolean terminal, int attempts, String error) {}
}
