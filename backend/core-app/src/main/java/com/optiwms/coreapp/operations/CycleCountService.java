package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.anomalies.AnomalyService;
import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.cyclecount.CycleCountAuditLogEntity;
import com.optiwms.infra.cyclecount.CycleCountAuditLogRepository;
import com.optiwms.infra.cyclecount.CycleCountEntity;
import com.optiwms.infra.cyclecount.CycleCountRecountEntity;
import com.optiwms.infra.cyclecount.CycleCountRecountRepository;
import com.optiwms.infra.cyclecount.CycleCountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CycleCountService {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final CycleCountRepository repository;
    private final CycleCountRecountRepository recountRepository;
    private final CycleCountAuditLogRepository auditLogRepository;
    private final InventoryService inventoryService;
    private final AnomalyService anomalyService;
    private final OperationEventService operationEventService;
    private final TaskService taskService;

    public CycleCountService(CycleCountRepository repository,
                            CycleCountRecountRepository recountRepository,
                            CycleCountAuditLogRepository auditLogRepository,
                            InventoryService inventoryService,
                            AnomalyService anomalyService,
                            OperationEventService operationEventService,
                            TaskService taskService) {
        this.repository = repository;
        this.recountRepository = recountRepository;
        this.auditLogRepository = auditLogRepository;
        this.inventoryService = inventoryService;
        this.anomalyService = anomalyService;
        this.operationEventService = operationEventService;
        this.taskService = taskService;
    }

    public List<CycleCount> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<CycleCount> findByStatus(String status) {
        return repository.findByStatus(status).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public CycleCount findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Cycle count not found: " + id));
    }

    @Transactional
    public CycleCount create(CycleCount cycleCount) {
        CycleCountEntity entity = new CycleCountEntity();
        entity.setCountNumber(
                cycleCount.getCountNumber() != null && !cycleCount.getCountNumber().isBlank()
                        ? cycleCount.getCountNumber()
                        : generateCountNumber()
        );
        entity.setWarehouseId(cycleCount.getWarehouseId());
        entity.setLocationCode(cycleCount.getLocationCode());
        entity.setScheduledDate(cycleCount.getScheduledDate());
        entity.setAssignedWorkers(cycleCount.getAssignedWorkers());
        entity.setStatus(cycleCount.getStatus() != null ? cycleCount.getStatus() : "scheduled");
        entity.setNotes(cycleCount.getNotes());

        CycleCountEntity saved = repository.save(entity);
        syncWorkerTasks(saved);
        return toDomain(saved);
    }

    @Transactional
    public CycleCount update(UUID id, java.time.LocalDate scheduledDate, UUID[] assignedWorkers, String status, String notes) {
        CycleCountEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cycle count not found: " + id));

        if (scheduledDate != null) {
            entity.setScheduledDate(scheduledDate);
        }
        if (assignedWorkers != null) {
            entity.setAssignedWorkers(assignedWorkers.length == 0 ? null : assignedWorkers);
        }
        if (status != null && !status.isBlank()) {
            entity.setStatus(status);
        }
        if (notes != null) {
            entity.setNotes(notes);
        }

        CycleCountEntity saved = repository.save(entity);
        syncWorkerTasks(saved);
        return toDomain(saved);
    }

    @Transactional
    public CycleCountResult recordCount(UUID id, UUID materialId, BigDecimal countedQuantity, UUID countedBy) {
        CycleCountEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cycle count not found: " + id));

        if ("completed".equals(entity.getStatus()) || "cancelled".equals(entity.getStatus())) {
            throw new RuntimeException("Cycle count is already in terminal status: " + entity.getStatus());
        }

        // Find inventory at location
        List<InventoryItem> inventory = inventoryService.findByWarehouse(entity.getWarehouseId());
        InventoryItem item = inventory.stream()
                .filter(inv -> inv.getMaterialId().equals(materialId)
                        && matchesCountScope(entity.getLocationCode(), inv.getLocationCode()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Inventory not found for material at location"));

        // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
        Integer countedQtyInteger = (int) Math.ceil(countedQuantity.doubleValue());
        Integer systemQuantity = item.getQuantity() != null ? item.getQuantity() : 0;
        Integer variance = countedQtyInteger - systemQuantity;
        BigDecimal varianceDecimal = new BigDecimal(variance);
        BigDecimal expectedQuantityDecimal = BigDecimal.valueOf(systemQuantity.longValue());
        BigDecimal countedQuantityDecimal = BigDecimal.valueOf(countedQtyInteger.longValue());
        BigDecimal variancePercentage = calculateVariancePercentage(systemQuantity, variance);
        String anomalyLevel = calculateAnomalyLevel(varianceDecimal, entity.getVarianceThreshold());
        boolean anomalyDetected = "major".equals(anomalyLevel) || "critical".equals(anomalyLevel);
        String previousStatus = entity.getStatus();

        entity.setMaterialId(materialId);
        entity.setExpectedQuantity(expectedQuantityDecimal);
        entity.setCountedQuantity(countedQuantityDecimal);
        entity.setVariance(varianceDecimal);
        entity.setVariancePercentage(variancePercentage);
        entity.setAnomalyLevel(anomalyLevel);
        entity.setAnomalyDetected(anomalyDetected);
        entity.setCountedBy(countedBy);
        entity.setCountedAt(LocalDateTime.now());

        operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                "CYCLE_COUNT",
                countedBy,
                null,
                null,
                null,
                entity.getWarehouseId(),
                materialId,
                countedQtyInteger,
                null,
                LocalDateTime.now(),
                "status=" + entity.getStatus() + ";anomaly=" + anomalyDetected
        ));

        // Get variance threshold (default 5 units if not set)
        BigDecimal threshold = entity.getVarianceThreshold() != null ? 
            entity.getVarianceThreshold() : new BigDecimal("5.0");

        // Check if recount is required (variance exceeds threshold)
        if (varianceDecimal.abs().compareTo(threshold) >= 0 && !Boolean.TRUE.equals(entity.getRecountRequired())) {
            // First count with large variance - require recount
            entity.setRecountRequired(true);
            entity.setApprovalRequired(false);
            entity.setPreviousVariance(varianceDecimal);
            entity.setStatus("recount_required"); // New status
            repository.save(entity);
            syncWorkerTaskAfterCount(entity, countedBy, false);
            ensureManagerReviewTaskClosed(entity);

            saveCycleCountAudit(
                    entity.getId(),
                    "COUNT_RECORDED_RECOUNT_REQUIRED",
                    countedBy,
                    previousStatus,
                    entity.getStatus(),
                    expectedQuantityDecimal,
                    countedQuantityDecimal,
                    varianceDecimal,
                    "Variance exceeded threshold; recount required"
            );

            // Record this count in recount history
            saveRecountHistory(id, 1, countedQuantity, varianceDecimal, countedBy, 
                "Initial count - variance exceeds threshold");

            return new CycleCountResult(
                false, 
                String.format("Large variance detected (%.0f units, threshold: %.0f). Please recount.", 
                    varianceDecimal.doubleValue(), threshold.doubleValue()),
                varianceDecimal,
                true,
                false
            );
        }

        // If recount was required and this is a recount
        if (Boolean.TRUE.equals(entity.getRecountRequired())) {
            Integer currentRecountCount = entity.getRecountCount() != null ? entity.getRecountCount() : 0;
            currentRecountCount++;
            entity.setRecountCount(currentRecountCount);

            // Record this recount in history
            saveRecountHistory(id, currentRecountCount + 1, countedQuantity, varianceDecimal, countedBy, 
                String.format("Recount #%d", currentRecountCount));

            // If recount resolves variance, complete immediately.
            if (variance == 0) {
                entity.setRecountRequired(false);
                entity.setApprovalRequired(false);
                entity.setFinalVariance(varianceDecimal);
                entity.setStatus("completed");
                repository.save(entity);
                syncWorkerTaskAfterCount(entity, countedBy, true);
                ensureManagerReviewTaskClosed(entity);
                saveCycleCountAudit(
                        entity.getId(),
                        "RECOUNT_RESOLVED",
                        countedBy,
                        previousStatus,
                        entity.getStatus(),
                        expectedQuantityDecimal,
                        countedQuantityDecimal,
                        varianceDecimal,
                        String.format("Recount #%d resolved variance to zero", currentRecountCount)
                );
                return new CycleCountResult(
                    true,
                    String.format("Recount #%d matched system quantity. Count completed.", currentRecountCount),
                    varianceDecimal,
                    false,
                    false
                );
            }

            // Any discrepancy >= threshold after recount requires manager decision.
            if (varianceDecimal.abs().compareTo(threshold) >= 0) {
                entity.setRecountRequired(false);
                entity.setApprovalRequired(true);
                entity.setFinalVariance(varianceDecimal);
                entity.setStatus("pending_approval");
                repository.save(entity);
                syncWorkerTaskAfterCount(entity, countedBy, true);
                ensureManagerReviewTaskOpen(entity);
                maybeCreateAnomaly(entity);
                saveCycleCountAudit(
                        entity.getId(),
                        "RECOUNT_PENDING_APPROVAL",
                        countedBy,
                        previousStatus,
                        entity.getStatus(),
                        expectedQuantityDecimal,
                        countedQuantityDecimal,
                        varianceDecimal,
                        String.format("Recount #%d variance >= threshold; manager decision required", currentRecountCount)
                );
                return new CycleCountResult(
                    true,
                    String.format("Recount #%d recorded. Variance >= threshold. Awaiting manager decision.", currentRecountCount),
                    varianceDecimal,
                    false,
                    true
                );
            }

            // After 2 recounts (3 total counts), accept below-threshold variance
            if (currentRecountCount >= 2) {
                entity.setRecountRequired(false);
                entity.setFinalVariance(varianceDecimal);
                if (variance == 0) {
                    entity.setApprovalRequired(false);
                    entity.setStatus("completed");
                    repository.save(entity);
                    syncWorkerTaskAfterCount(entity, countedBy, true);
                    ensureManagerReviewTaskClosed(entity);
                    saveCycleCountAudit(
                            entity.getId(),
                            "COUNT_RECORDED",
                            countedBy,
                            previousStatus,
                            entity.getStatus(),
                            expectedQuantityDecimal,
                            countedQuantityDecimal,
                            varianceDecimal,
                            "Recount completed with zero variance"
                    );
                } else {
                    entity.setApprovalRequired(true);
                    entity.setStatus("pending_approval");
                    repository.save(entity);
                    syncWorkerTaskAfterCount(entity, countedBy, true);
                    ensureManagerReviewTaskOpen(entity);
                    maybeCreateAnomaly(entity);
                    saveCycleCountAudit(
                            entity.getId(),
                            "COUNT_RECORDED_PENDING_APPROVAL",
                            countedBy,
                            previousStatus,
                            entity.getStatus(),
                            expectedQuantityDecimal,
                            countedQuantityDecimal,
                            varianceDecimal,
                            "Recount finalized with non-zero variance; manager approval required"
                    );
                }
                return new CycleCountResult(
                    true, 
                    String.format("Count completed after %d recounts. Final variance: %.0f units.", 
                        currentRecountCount, varianceDecimal.doubleValue()),
                    varianceDecimal,
                    false,
                    entity.getApprovalRequired() != null && entity.getApprovalRequired()
                );
            } else {
                // Below threshold but still non-zero before max recounts: keep recount flow.
                entity.setApprovalRequired(false);
                repository.save(entity);
                syncWorkerTaskAfterCount(entity, countedBy, false);
                ensureManagerReviewTaskClosed(entity);
                saveCycleCountAudit(
                        entity.getId(),
                        "RECOUNT_RECORDED",
                        countedBy,
                        previousStatus,
                        entity.getStatus(),
                        expectedQuantityDecimal,
                        countedQuantityDecimal,
                        varianceDecimal,
                        String.format("Recount #%d recorded", currentRecountCount)
                );
                return new CycleCountResult(
                    false, 
                    String.format("Recount #%d recorded. Variance: %.0f units. Please recount again.", 
                        currentRecountCount, varianceDecimal.doubleValue()),
                    varianceDecimal,
                    true,
                    false
                );
            }
        }

        // Normal flow: Small variance, accept immediately
        entity.setFinalVariance(varianceDecimal);
        if (variance == 0) {
            entity.setApprovalRequired(false);
            entity.setStatus("completed");
            repository.save(entity);
            syncWorkerTaskAfterCount(entity, countedBy, true);
            ensureManagerReviewTaskClosed(entity);
            saveCycleCountAudit(
                    entity.getId(),
                    "COUNT_RECORDED",
                    countedBy,
                    previousStatus,
                    entity.getStatus(),
                    expectedQuantityDecimal,
                    countedQuantityDecimal,
                    varianceDecimal,
                    "Cycle count matched system quantity"
            );
        } else {
            entity.setApprovalRequired(true);
            entity.setStatus("pending_approval");
            repository.save(entity);
            syncWorkerTaskAfterCount(entity, countedBy, true);
            ensureManagerReviewTaskOpen(entity);
            maybeCreateAnomaly(entity);
            saveCycleCountAudit(
                    entity.getId(),
                    "COUNT_RECORDED_PENDING_APPROVAL",
                    countedBy,
                    previousStatus,
                    entity.getStatus(),
                    expectedQuantityDecimal,
                    countedQuantityDecimal,
                    varianceDecimal,
                    "Variance detected; manager approval required"
            );
        }

        return new CycleCountResult(
            true, 
            "Count recorded successfully", 
            varianceDecimal,
            false,
            entity.getApprovalRequired() != null && entity.getApprovalRequired()
        );
    }

    @Transactional
    public CycleCount approveAdjustment(UUID id, UUID approvedBy, String notes) {
        CycleCountEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cycle count not found: " + id));

        if (!Boolean.TRUE.equals(entity.getApprovalRequired())) {
            throw new RuntimeException("Cycle count does not require approval");
        }
        if (!"pending_approval".equals(entity.getStatus())) {
            throw new RuntimeException("Cycle count is not in pending_approval status");
        }
        if (entity.getMaterialId() == null || entity.getCountedQuantity() == null) {
            throw new RuntimeException("Cycle count is missing counted material/quantity details");
        }

        UUID materialId = entity.getMaterialId();
        String locationCode = entity.getLocationCode();
        List<InventoryItem> inventory = inventoryService.findByWarehouse(entity.getWarehouseId());
        InventoryItem item = inventory.stream()
                .filter(inv -> inv.getMaterialId().equals(materialId) &&
                        matchesCountScope(locationCode, inv.getLocationCode()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Inventory not found for cycle count adjustment"));

        Integer adjustedQuantity = entity.getCountedQuantity().intValue();
        item.setQuantity(adjustedQuantity);
        item.setAvailableQuantity(adjustedQuantity - (item.getReservedQuantity() != null ? item.getReservedQuantity() : 0));
        inventoryService.createOrUpdate(item);

        String previousStatus = entity.getStatus();
        entity.setApprovalRequired(false);
        entity.setApprovedBy(approvedBy);
        entity.setApprovedAt(LocalDateTime.now());
        entity.setApprovalNotes(notes);
        entity.setStatus("completed");
        entity = repository.save(entity);
        ensureManagerReviewTaskClosed(entity, approvedBy);

        saveCycleCountAudit(
                entity.getId(),
                "ADJUSTMENT_APPROVED",
                approvedBy,
                previousStatus,
                entity.getStatus(),
                entity.getExpectedQuantity(),
                entity.getCountedQuantity(),
                entity.getVariance(),
                notes
        );

        operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                "CYCLE_COUNT_APPROVAL",
                approvedBy,
                null,
                null,
                null,
                entity.getWarehouseId(),
                entity.getMaterialId(),
                adjustedQuantity,
                null,
                LocalDateTime.now(),
                "approval=approved;adjusted=true"
        ));

        return toDomain(entity);
    }

    @Transactional
    public CycleCount rejectAdjustment(UUID id, UUID approvedBy, String notes) {
        CycleCountEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cycle count not found: " + id));

        if (!Boolean.TRUE.equals(entity.getApprovalRequired())) {
            throw new RuntimeException("Cycle count does not require approval");
        }
        if (!"pending_approval".equals(entity.getStatus())) {
            throw new RuntimeException("Cycle count is not in pending_approval status");
        }

        String previousStatus = entity.getStatus();
        entity.setApprovalRequired(false);
        entity.setRecountRequired(true);
        entity.setApprovedBy(approvedBy);
        entity.setApprovedAt(LocalDateTime.now());
        entity.setApprovalNotes(notes);
        entity.setStatus("recount_required");
        entity = repository.save(entity);
        ensureManagerReviewTaskClosed(entity, approvedBy);
        syncWorkerTasks(entity);

        saveCycleCountAudit(
                entity.getId(),
                "ADJUSTMENT_REJECTED",
                approvedBy,
                previousStatus,
                entity.getStatus(),
                entity.getExpectedQuantity(),
                entity.getCountedQuantity(),
                entity.getVariance(),
                notes
        );

        return toDomain(entity);
    }

    /**
     * Save recount history for audit trail
     */
    private void saveRecountHistory(UUID cycleCountId, Integer recountNumber, BigDecimal countedQuantity, 
                                     BigDecimal variance, UUID countedBy, String notes) {
        CycleCountRecountEntity recount = new CycleCountRecountEntity();
        recount.setCycleCountId(cycleCountId);
        recount.setRecountNumber(recountNumber);
        recount.setCountedQuantity(countedQuantity);
        recount.setVariance(variance);
        recount.setCountedBy(countedBy);
        recount.setNotes(notes);
        recountRepository.save(recount);
    }

    private void saveCycleCountAudit(
            UUID cycleCountId,
            String action,
            UUID performedBy,
            String fromStatus,
            String toStatus,
            BigDecimal expectedQuantity,
            BigDecimal countedQuantity,
            BigDecimal variance,
            String notes
    ) {
        CycleCountAuditLogEntity log = new CycleCountAuditLogEntity();
        log.setCycleCountId(cycleCountId);
        log.setAction(action);
        log.setPerformedBy(performedBy);
        log.setFromStatus(fromStatus);
        log.setToStatus(toStatus);
        log.setExpectedQuantity(expectedQuantity);
        log.setCountedQuantity(countedQuantity);
        log.setVariance(variance);
        log.setNotes(notes);
        auditLogRepository.save(log);
    }

    private BigDecimal calculateVariancePercentage(Integer systemQuantity, Integer variance) {
        if (systemQuantity == null || systemQuantity == 0) {
            if (variance == null || variance == 0) {
                return BigDecimal.ZERO;
            }
            return ONE_HUNDRED;
        }
        BigDecimal absVariance = BigDecimal.valueOf(Math.abs(variance.longValue()));
        return absVariance.multiply(ONE_HUNDRED)
                .divide(BigDecimal.valueOf(systemQuantity.longValue()), 4, java.math.RoundingMode.HALF_UP);
    }

    private String calculateAnomalyLevel(BigDecimal variance, BigDecimal threshold) {
        BigDecimal absVariance = variance.abs();
        BigDecimal safeThreshold = (threshold != null && threshold.compareTo(BigDecimal.ZERO) > 0)
                ? threshold
                : new BigDecimal("5.0");

        if (absVariance.compareTo(BigDecimal.ZERO) == 0) {
            return "none";
        }
        if (absVariance.compareTo(safeThreshold) <= 0) {
            return "minor";
        }
        if (absVariance.compareTo(safeThreshold.multiply(new BigDecimal("2"))) <= 0) {
            return "major";
        }
        return "critical";
    }

    private void maybeCreateAnomaly(CycleCountEntity entity) {
        if (!Boolean.TRUE.equals(entity.getAnomalyDetected())) {
            return;
        }
        anomalyService.create(
                "CYCLE_COUNT_VARIANCE",
                entity.getMaterialId(),
                entity.getWarehouseId(),
                entity.getCountedQuantity(),
                entity.getExpectedQuantity(),
                entity.getVariancePercentage(),
                entity.getAnomalyLevel() != null ? entity.getAnomalyLevel().toUpperCase() : "MAJOR",
                "Cycle count variance detected for count " + entity.getCountNumber()
        );
    }

    private String generateCountNumber() {
        return "CC-" + java.time.LocalDate.now() + "-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String generateTaskNumber(String prefix, String reference) {
        return prefix + "-" + reference + "-" + java.util.UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    private boolean isWorkerTask(Task task) {
        return task.getNotes() != null && task.getNotes().contains("role=worker");
    }

    private boolean isManagerTask(Task task) {
        return task.getNotes() != null && task.getNotes().contains("role=manager");
    }

    private void syncWorkerTasks(CycleCountEntity entity) {
        List<Task> existing = taskService.findByTaskTypeAndReference("cycle_count", "cycle_count", entity.getId());
        List<Task> workerTasks = existing.stream().filter(this::isWorkerTask).toList();
        Set<UUID> assignedWorkerIds = entity.getAssignedWorkers() == null
                ? Set.of()
                : Arrays.stream(entity.getAssignedWorkers()).collect(Collectors.toSet());

        if (assignedWorkerIds.isEmpty()) {
            if (workerTasks.isEmpty()) {
                Task task = new Task();
                task.setTaskNumber(generateTaskNumber("CC", entity.getCountNumber()));
                task.setTaskType("cycle_count");
                task.setWarehouseId(entity.getWarehouseId());
                task.setAssignedTo(null);
                task.setPriority("normal");
                task.setStatus("pending");
                task.setDueDate(entity.getScheduledDate() != null ? entity.getScheduledDate().atStartOfDay() : LocalDateTime.now().plusDays(1));
                task.setLocationCode(entity.getLocationCode());
                task.setReferenceType("cycle_count");
                task.setReferenceId(entity.getId());
                task.setNotes("role=worker;count=" + entity.getCountNumber() + ";scope=" + entity.getLocationCode());
                taskService.create(task);
            }
            return;
        }

        for (UUID workerId : assignedWorkerIds) {
            boolean exists = workerTasks.stream().anyMatch(t -> workerId.equals(t.getAssignedTo()));
            if (!exists) {
                Task task = new Task();
                task.setTaskNumber(generateTaskNumber("CC", entity.getCountNumber()));
                task.setTaskType("cycle_count");
                task.setWarehouseId(entity.getWarehouseId());
                task.setAssignedTo(workerId);
                task.setPriority("normal");
                task.setStatus("assigned");
                task.setDueDate(entity.getScheduledDate() != null ? entity.getScheduledDate().atStartOfDay() : LocalDateTime.now().plusDays(1));
                task.setLocationCode(entity.getLocationCode());
                task.setReferenceType("cycle_count");
                task.setReferenceId(entity.getId());
                task.setNotes("role=worker;count=" + entity.getCountNumber() + ";scope=" + entity.getLocationCode());
                taskService.create(task);
            }
        }

        for (Task task : workerTasks) {
            if (task.getAssignedTo() != null
                    && !assignedWorkerIds.contains(task.getAssignedTo())
                    && !"completed".equals(task.getStatus())
                    && !"cancelled".equals(task.getStatus())) {
                taskService.updateStatus(task.getId(), "cancelled");
            }
        }
    }

    private void syncWorkerTaskAfterCount(CycleCountEntity entity, UUID countedBy, boolean markCompleted) {
        List<Task> existing = taskService.findByTaskTypeAndReference("cycle_count", "cycle_count", entity.getId());
        Task workerTask = existing.stream()
                .filter(this::isWorkerTask)
                .filter(t -> countedBy.equals(t.getAssignedTo()))
                .findFirst()
                .orElse(null);

        if (workerTask == null) {
            Task task = new Task();
            task.setTaskNumber(generateTaskNumber("CC", entity.getCountNumber()));
            task.setTaskType("cycle_count");
            task.setWarehouseId(entity.getWarehouseId());
            task.setAssignedTo(countedBy);
            task.setPriority("normal");
            task.setStatus(markCompleted ? "completed" : "in_progress");
            task.setDueDate(entity.getScheduledDate() != null ? entity.getScheduledDate().atStartOfDay() : LocalDateTime.now().plusDays(1));
            task.setLocationCode(entity.getLocationCode());
            task.setReferenceType("cycle_count");
            task.setReferenceId(entity.getId());
            task.setNotes("role=worker;count=" + entity.getCountNumber() + ";scope=" + entity.getLocationCode());
            taskService.create(task);
            return;
        }

        if (markCompleted) {
            taskService.updateStatusWithWorker(workerTask.getId(), "completed", countedBy);
        } else {
            taskService.updateStatusWithWorker(workerTask.getId(), "in_progress", countedBy);
        }
    }

    private void ensureManagerReviewTaskOpen(CycleCountEntity entity) {
        List<Task> existing = taskService.findByTaskTypeAndReference("cycle_count", "cycle_count", entity.getId());
        Task managerTask = existing.stream().filter(this::isManagerTask).findFirst().orElse(null);
        if (managerTask == null) {
            Task task = new Task();
            task.setTaskNumber(generateTaskNumber("CCREV", entity.getCountNumber()));
            task.setTaskType("cycle_count");
            task.setWarehouseId(entity.getWarehouseId());
            task.setAssignedTo(null);
            task.setPriority("high");
            task.setStatus("pending");
            task.setDueDate(LocalDateTime.now().plusHours(4));
            task.setLocationCode(entity.getLocationCode());
            task.setReferenceType("cycle_count");
            task.setReferenceId(entity.getId());
            task.setNotes("role=manager;action=approve_adjustment;count=" + entity.getCountNumber());
            taskService.create(task);
            return;
        }
        if ("completed".equals(managerTask.getStatus()) || "cancelled".equals(managerTask.getStatus())) {
            taskService.updateStatus(managerTask.getId(), "pending");
        }
    }

    private void ensureManagerReviewTaskClosed(CycleCountEntity entity) {
        ensureManagerReviewTaskClosed(entity, null);
    }

    private void ensureManagerReviewTaskClosed(CycleCountEntity entity, UUID closedBy) {
        List<Task> existing = taskService.findByTaskTypeAndReference("cycle_count", "cycle_count", entity.getId());
        existing.stream()
                .filter(this::isManagerTask)
                .filter(task -> !"completed".equals(task.getStatus()) && !"cancelled".equals(task.getStatus()))
                .forEach(task -> {
                    if (closedBy != null) {
                        taskService.updateStatusWithWorker(task.getId(), "completed", closedBy);
                    } else {
                        taskService.updateStatus(task.getId(), "completed");
                    }
                });
    }

    private boolean matchesCountScope(String countLocationCode, String inventoryLocationCode) {
        if (countLocationCode == null || countLocationCode.isBlank() || "ALL".equalsIgnoreCase(countLocationCode)) {
            return true;
        }
        if (inventoryLocationCode == null || inventoryLocationCode.isBlank()) {
            return false;
        }
        String scope = countLocationCode.trim();
        String inventoryCode = inventoryLocationCode.trim();
        if (scope.regionMatches(true, 0, "AREA:", 0, 5)) {
            String area = scope.substring(5).trim().toUpperCase();
            return inventoryCode.toUpperCase().startsWith(area + "-");
        }
        return scope.equalsIgnoreCase(inventoryCode);
    }

    private CycleCount toDomain(CycleCountEntity entity) {
        CycleCount count = new CycleCount();
        count.setId(entity.getId());
        count.setCountNumber(entity.getCountNumber());
        count.setWarehouseId(entity.getWarehouseId());
        count.setLocationCode(entity.getLocationCode());
        count.setScheduledDate(entity.getScheduledDate());
        count.setAssignedWorkers(entity.getAssignedWorkers());
        count.setStatus(entity.getStatus());
        count.setCountedBy(entity.getCountedBy());
        count.setCountedAt(entity.getCountedAt());
        count.setVariance(entity.getVariance());
        count.setMaterialId(entity.getMaterialId());
        count.setExpectedQuantity(entity.getExpectedQuantity());
        count.setCountedQuantity(entity.getCountedQuantity());
        count.setVariancePercentage(entity.getVariancePercentage());
        count.setAnomalyLevel(entity.getAnomalyLevel());
        count.setAnomalyDetected(entity.getAnomalyDetected());
        count.setApprovalRequired(entity.getApprovalRequired());
        count.setApprovedBy(entity.getApprovedBy());
        count.setApprovedAt(entity.getApprovedAt());
        count.setApprovalNotes(entity.getApprovalNotes());
        count.setRecountRequired(entity.getRecountRequired());
        count.setNotes(entity.getNotes());
        return count;
    }

    public static class CycleCount {
        private UUID id;
        private String countNumber;
        private UUID warehouseId;
        private String locationCode;
        private java.time.LocalDate scheduledDate;
        private UUID[] assignedWorkers;
        private String status;
        private UUID countedBy;
        private java.time.LocalDateTime countedAt;
        private BigDecimal variance;
        private UUID materialId;
        private BigDecimal expectedQuantity;
        private BigDecimal countedQuantity;
        private BigDecimal variancePercentage;
        private String anomalyLevel;
        private Boolean anomalyDetected;
        private Boolean approvalRequired;
        private UUID approvedBy;
        private java.time.LocalDateTime approvedAt;
        private String approvalNotes;
        private Boolean recountRequired;
        private String notes;

        // Getters and Setters
        public UUID getId() { return id; }
        public void setId(UUID id) { this.id = id; }
        public String getCountNumber() { return countNumber; }
        public void setCountNumber(String countNumber) { this.countNumber = countNumber; }
        public UUID getWarehouseId() { return warehouseId; }
        public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
        public String getLocationCode() { return locationCode; }
        public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
        public java.time.LocalDate getScheduledDate() { return scheduledDate; }
        public void setScheduledDate(java.time.LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }
        public UUID[] getAssignedWorkers() { return assignedWorkers; }
        public void setAssignedWorkers(UUID[] assignedWorkers) { this.assignedWorkers = assignedWorkers; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public UUID getCountedBy() { return countedBy; }
        public void setCountedBy(UUID countedBy) { this.countedBy = countedBy; }
        public java.time.LocalDateTime getCountedAt() { return countedAt; }
        public void setCountedAt(java.time.LocalDateTime countedAt) { this.countedAt = countedAt; }
        public BigDecimal getVariance() { return variance; }
        public void setVariance(BigDecimal variance) { this.variance = variance; }
        public UUID getMaterialId() { return materialId; }
        public void setMaterialId(UUID materialId) { this.materialId = materialId; }
        public BigDecimal getExpectedQuantity() { return expectedQuantity; }
        public void setExpectedQuantity(BigDecimal expectedQuantity) { this.expectedQuantity = expectedQuantity; }
        public BigDecimal getCountedQuantity() { return countedQuantity; }
        public void setCountedQuantity(BigDecimal countedQuantity) { this.countedQuantity = countedQuantity; }
        public BigDecimal getVariancePercentage() { return variancePercentage; }
        public void setVariancePercentage(BigDecimal variancePercentage) { this.variancePercentage = variancePercentage; }
        public String getAnomalyLevel() { return anomalyLevel; }
        public void setAnomalyLevel(String anomalyLevel) { this.anomalyLevel = anomalyLevel; }
        public Boolean getAnomalyDetected() { return anomalyDetected; }
        public void setAnomalyDetected(Boolean anomalyDetected) { this.anomalyDetected = anomalyDetected; }
        public Boolean getApprovalRequired() { return approvalRequired; }
        public void setApprovalRequired(Boolean approvalRequired) { this.approvalRequired = approvalRequired; }
        public UUID getApprovedBy() { return approvedBy; }
        public void setApprovedBy(UUID approvedBy) { this.approvedBy = approvedBy; }
        public java.time.LocalDateTime getApprovedAt() { return approvedAt; }
        public void setApprovedAt(java.time.LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
        public String getApprovalNotes() { return approvalNotes; }
        public void setApprovalNotes(String approvalNotes) { this.approvalNotes = approvalNotes; }
        public Boolean getRecountRequired() { return recountRequired; }
        public void setRecountRequired(Boolean recountRequired) { this.recountRequired = recountRequired; }
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }

    public record CycleCountResult(
            boolean success,
            String message,
            BigDecimal variance,
            boolean recountRequired,
            boolean approvalRequired
    ) {
        // Backward compatible constructor
        public CycleCountResult(boolean success, String message, BigDecimal variance) {
            this(success, message, variance, false, false);
        }
    }
}
