package com.optiwms.coreapp.tasks;

import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.domain.notifications.Notification;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.tasks.TaskEntity;
import com.optiwms.infra.tasks.TaskRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private static final Pattern HANDLING_UNIT_QUANTITY = Pattern.compile("PUTAWAY_HU_QTY=(\\d+)");

    private final TaskRepository repository;
    private final NotificationService notificationService;

    public TaskService(TaskRepository repository, NotificationService notificationService) {
        this.repository = repository;
        this.notificationService = notificationService;
    }

    public List<Task> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Page<Task> findPaged(
            String taskType,
            String status,
            UUID assignedTo,
            UUID warehouseId,
            Boolean availableOnly,
            String query,
            Pageable pageable
    ) {
        Specification<TaskEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (taskType != null && !taskType.isBlank()) {
                predicates.add(cb.equal(root.get("taskType"), taskType));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (assignedTo != null) {
                predicates.add(cb.equal(root.get("assignedTo"), assignedTo));
            }
            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            }
            if (Boolean.TRUE.equals(availableOnly)) {
                predicates.add(cb.isNull(root.get("assignedTo")));
                predicates.add(cb.equal(root.get("status"), "pending"));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("taskNumber")), pattern),
                        cb.like(cb.lower(root.get("taskType")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern),
                        cb.like(cb.lower(root.get("locationCode")), pattern),
                        cb.like(cb.lower(root.get("notes")), pattern)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    public List<Task> findByType(String taskType) {
        return repository.findByTaskType(taskType).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Task> findByStatus(String status) {
        return repository.findByStatus(status).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Task> findByAssignedTo(UUID assignedTo) {
        return repository.findByAssignedTo(assignedTo).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<WorkerTaskSummary> getWorkerTaskSummaries(List<UUID> workerIds) {
        if (workerIds == null || workerIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, WorkerTaskSummaryAccumulator> summaries = new LinkedHashMap<>();
        for (UUID workerId : workerIds) {
            if (workerId != null) {
                summaries.put(workerId, new WorkerTaskSummaryAccumulator());
            }
        }

        repository.findByAssignedToIn(new ArrayList<>(summaries.keySet())).forEach(task -> {
            WorkerTaskSummaryAccumulator summary = summaries.get(task.getAssignedTo());
            if (summary == null) {
                return;
            }

            summary.total++;
            if ("completed".equalsIgnoreCase(task.getStatus())) {
                summary.completed++;
            }
        });

        return summaries.entrySet().stream()
                .map(entry -> new WorkerTaskSummary(entry.getKey(), entry.getValue().total, entry.getValue().completed))
                .toList();
    }

    public List<Task> findByWarehouseId(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Task> findByTaskTypeAndStatus(String taskType, String status) {
        return repository.findByTaskTypeAndStatus(taskType, status).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Task> findByWarehouseAndTypeAndStatus(UUID warehouseId, String taskType, String status) {
        return repository.findByWarehouseIdAndTaskTypeAndStatus(warehouseId, taskType, status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Task> findByReference(String referenceType, UUID referenceId) {
        return repository.findByReferenceTypeAndReferenceId(referenceType, referenceId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Task> findByTaskTypeAndReference(String taskType, String referenceType, UUID referenceId) {
        return repository.findByTaskTypeAndReferenceTypeAndReferenceId(taskType, referenceType, referenceId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Task findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
    }

    @Transactional
    public Task create(Task task) {
        TaskEntity entity = new TaskEntity();
        entity.setTaskNumber(task.getTaskNumber());
        entity.setTaskType(task.getTaskType());
        entity.setWarehouseId(task.getWarehouseId());
        entity.setAssignedTo(task.getAssignedTo());
        entity.setPriority(task.getPriority() != null ? task.getPriority() : "normal");
        entity.setStatus(task.getStatus() != null ? task.getStatus() : "pending");
        entity.setDueDate(task.getDueDate());
        entity.setLocationCode(task.getLocationCode());
        entity.setReferenceType(task.getReferenceType());
        entity.setReferenceId(task.getReferenceId());
        entity.setHandlingUnitSeq(task.getHandlingUnitSeq());
        entity.setNotes(task.getNotes());

        TaskEntity saved = repository.save(entity);
        createTaskNotifications(saved, saved.getAssignedTo() != null);
        return toDomain(saved);
    }

    @Transactional
    public Task updateStatus(UUID id, String status) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        String previousStatus = entity.getStatus();
        entity.setStatus(status);
        if ("completed".equals(status)) {
            entity.setCompletedAt(LocalDateTime.now());
        } else if ("assigned".equals(status) || "in_progress".equals(status)) {
            // Set started_at when task is first assigned or started
            if (entity.getStartedAt() == null) {
                entity.setStartedAt(LocalDateTime.now());
            }
        }
        TaskEntity saved = repository.save(entity);
        createStatusNotification(saved, previousStatus, status);
        return toDomain(saved);
    }

    @Transactional
    public Task updateStatusWithWorker(UUID id, String status, UUID workerId) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        String previousStatus = entity.getStatus();
        entity.setStatus(status);
        if (workerId != null) {
            // Keep task ownership aligned with actual executor for labor productivity views.
            entity.setAssignedTo(workerId);
        }
        if ("completed".equals(status)) {
            if (entity.getStartedAt() == null) {
                entity.setStartedAt(LocalDateTime.now());
            }
            entity.setCompletedAt(LocalDateTime.now());
            entity.setCompletedBy(workerId);
        } else if ("assigned".equals(status) || "in_progress".equals(status)) {
            if (entity.getStartedAt() == null) {
                entity.setStartedAt(LocalDateTime.now());
            }
        }
        TaskEntity saved = repository.save(entity);
        createStatusNotification(saved, previousStatus, status);
        return toDomain(saved);
    }

    @Transactional
    public Task assignTask(UUID id, UUID workerId, String assignedBy) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        entity.setAssignedTo(workerId);
        entity.setStatus("assigned");
        if (entity.getStartedAt() == null) {
            entity.setStartedAt(LocalDateTime.now());
        }
        TaskEntity saved = repository.save(entity);
        createAssignedNotification(saved, assignedBy);
        return toDomain(saved);
    }

    @Transactional
    public Task updateNotes(UUID id, String notes) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        entity.setNotes(notes);
        TaskEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    /**
     * Records where the work actually happened, which is not always where it was planned.
     *
     * <p>A putaway task carried its planned bin and never learned the bin the worker really used.
     * Anything reading the task afterwards -- the route guide releasing stop reservations, the
     * putaway list, reporting -- was therefore told about a bin the pallet never reached.
     */
    @Transactional
    public Task updateLocationCode(UUID id, String locationCode) {
        if (locationCode == null || locationCode.isBlank()) {
            return findById(id);
        }
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        entity.setLocationCode(locationCode.trim().toUpperCase(java.util.Locale.ROOT));
        return toDomain(repository.save(entity));
    }

    private Task toDomain(TaskEntity entity) {
        Task task = new Task();
        task.setId(entity.getId());
        task.setTaskNumber(entity.getTaskNumber());
        task.setTaskType(entity.getTaskType());
        task.setWarehouseId(entity.getWarehouseId());
        task.setAssignedTo(entity.getAssignedTo());
        task.setPriority(entity.getPriority());
        task.setStatus(entity.getStatus());
        task.setDueDate(entity.getDueDate());
        task.setCompletedAt(entity.getCompletedAt());
        task.setCompletedBy(entity.getCompletedBy());
        task.setStartedAt(entity.getStartedAt());
        task.setLocationCode(entity.getLocationCode());
        task.setReferenceType(entity.getReferenceType());
        task.setReferenceId(entity.getReferenceId());
        task.setHandlingUnitSeq(entity.getHandlingUnitSeq());
        task.setNotes(entity.getNotes());
        return task;
    }

    /** Remove a task outright. Used when an unstarted plan is rebuilt against a changed order. */
    @Transactional
    public void deleteById(UUID taskId) {
        repository.deleteById(taskId);
    }

    private void createTaskNotifications(TaskEntity entity, boolean includeWorker) {
        notify(
                null,
                "admin,warehouse_manager,inbound_coordinator",
                entity.getWarehouseId(),
                taskNotificationTitle(entity),
                taskNotificationBody(entity),
                "task",
                "/admin/tasks/" + entity.getId(),
                "{\"taskId\":\"" + entity.getId() + "\",\"taskNumber\":\"" + entity.getTaskNumber() + "\",\"status\":\"" + entity.getStatus() + "\"}"
        );
        if (includeWorker && entity.getAssignedTo() != null) {
            notify(
                    entity.getAssignedTo(),
                    null,
                    entity.getWarehouseId(),
                    "New Task Assigned",
                    taskNotificationBody(entity) + " Assigned to you.",
                    "task",
                    "/worker/tasks/" + entity.getId(),
                    "{\"taskId\":\"" + entity.getId() + "\",\"taskNumber\":\"" + entity.getTaskNumber() + "\",\"status\":\"" + entity.getStatus() + "\"}"
            );
        }
    }

    /**
     * Notification headline naming the kind of work, not just "Task Created".
     *
     * One receipt raises a receiving task and one putaway task per pallet. Titling all of them
     * identically made a two-pallet receipt read as three interchangeable tasks, and left the
     * reader counting rows to work out how many pallets were actually involved.
     */
    private String taskNotificationTitle(TaskEntity entity) {
        String type = entity.getTaskType() == null ? "" : entity.getTaskType().toLowerCase(Locale.ROOT);
        return switch (type) {
            case "receiving" -> "Receiving Task Created";
            case "putaway" -> "Putaway Task Created";
            case "picking" -> "Picking Task Created";
            case "packing" -> "Packing Task Created";
            case "replenishment" -> "Replenishment Task Created";
            case "cycle_count" -> "Cycle Count Task Created";
            default -> "Task Created";
        };
    }

    /** What the task actually asks for: pallet number, quantity and destination where known. */
    private String taskNotificationBody(TaskEntity entity) {
        StringBuilder body = new StringBuilder();
        Integer sequence = entity.getHandlingUnitSeq();
        if ("putaway".equalsIgnoreCase(entity.getTaskType()) && sequence != null) {
            body.append("Pallet ").append(sequence);
            Integer quantity = handlingUnitQuantity(entity.getNotes());
            if (quantity != null) {
                body.append(" · ").append(quantity).append(" units");
            }
            if (entity.getLocationCode() != null && !entity.getLocationCode().isBlank()) {
                body.append(" to ").append(entity.getLocationCode());
            }
            body.append(" (").append(entity.getTaskNumber()).append(").");
            return body.toString();
        }
        body.append("Task ").append(entity.getTaskNumber());
        if (entity.getLocationCode() != null && !entity.getLocationCode().isBlank()) {
            body.append(" at ").append(entity.getLocationCode());
        }
        body.append(" is available for execution.");
        return body.toString();
    }

    /** Putaway writes the pallet quantity into the notes as PUTAWAY_HU_QTY=&lt;n&gt;. */
    private Integer handlingUnitQuantity(String notes) {
        if (notes == null) {
            return null;
        }
        Matcher matcher = HANDLING_UNIT_QUANTITY.matcher(notes);
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private void createAssignedNotification(TaskEntity entity, String assignedBy) {
        if (entity.getAssignedTo() != null) {
            notify(
                    entity.getAssignedTo(),
                    null,
                    entity.getWarehouseId(),
                    "Task Assigned",
                    "Task " + entity.getTaskNumber() + " is ready for you to start.",
                    "task",
                    "/worker/tasks/" + entity.getId(),
                    "{\"taskId\":\"" + entity.getId() + "\",\"taskNumber\":\"" + entity.getTaskNumber() + "\",\"assignedBy\":\"" + (assignedBy != null ? assignedBy : "") + "\"}"
            );
        }
        notify(
                null,
                "admin,warehouse_manager,inbound_coordinator",
                entity.getWarehouseId(),
                "Task Assigned",
                "Task " + entity.getTaskNumber() + " was assigned to a worker.",
                "task",
                "/admin/tasks/" + entity.getId(),
                "{\"taskId\":\"" + entity.getId() + "\",\"taskNumber\":\"" + entity.getTaskNumber() + "\",\"status\":\"assigned\"}"
        );
    }

    private void createStatusNotification(TaskEntity entity, String previousStatus, String nextStatus) {
        if (nextStatus == null || nextStatus.equalsIgnoreCase(previousStatus)) {
            return;
        }

        String normalized = nextStatus.toLowerCase();
        String title;
        String message;
        String actionUrl;

        switch (normalized) {
            case "in_progress" -> {
                title = "Task Started";
                message = "Task " + entity.getTaskNumber() + " is now in progress.";
                actionUrl = "/admin/tasks/" + entity.getId();
            }
            case "completed" -> {
                title = "Task Completed";
                message = "Task " + entity.getTaskNumber() + " was completed.";
                actionUrl = "/admin/tasks/" + entity.getId();
            }
            case "cancelled" -> {
                title = "Task Cancelled";
                message = "Task " + entity.getTaskNumber() + " was cancelled.";
                actionUrl = "/admin/tasks/" + entity.getId();
            }
            default -> {
                title = "Task Updated";
                message = "Task " + entity.getTaskNumber() + " moved to " + normalized + ".";
                actionUrl = "/admin/tasks/" + entity.getId();
            }
        }

        notify(
                null,
                "admin,warehouse_manager,inbound_coordinator",
                entity.getWarehouseId(),
                title,
                message,
                "task",
                actionUrl,
                "{\"taskId\":\"" + entity.getId() + "\",\"taskNumber\":\"" + entity.getTaskNumber() + "\",\"fromStatus\":\"" + (previousStatus != null ? previousStatus : "") + "\",\"status\":\"" + normalized + "\"}"
        );

        if (entity.getAssignedTo() != null && !"completed".equals(normalized)) {
            notify(
                    entity.getAssignedTo(),
                    null,
                    entity.getWarehouseId(),
                    title,
                    message,
                    "task",
                    "/worker/tasks/" + entity.getId(),
                    "{\"taskId\":\"" + entity.getId() + "\",\"taskNumber\":\"" + entity.getTaskNumber() + "\",\"status\":\"" + normalized + "\"}"
            );
        }
    }

    private void notify(
            UUID userId,
            String audienceRoles,
            UUID warehouseId,
            String title,
            String message,
            String type,
            String actionUrl,
            String metadata
    ) {
        try {
            Notification notification = new Notification();
            notification.setUserId(userId);
            notification.setAudienceRoles(audienceRoles);
            notification.setWarehouseId(warehouseId);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setNotificationType(type);
            notification.setRead(false);
            notification.setActionUrl(actionUrl);
            notification.setMetadata(metadata);
            notification.setCreatedAt(OffsetDateTime.now());
            notificationService.create(notification);
        } catch (Exception ignored) {
            // Notifications must not block core task state transitions.
        }
    }

    public record WorkerTaskSummary(UUID workerId, long total, long completed) {}

    private static class WorkerTaskSummaryAccumulator {
        private long total;
        private long completed;
    }
}
