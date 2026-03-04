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
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TaskService {

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
        task.setNotes(entity.getNotes());
        return task;
    }

    private void createTaskNotifications(TaskEntity entity, boolean includeWorker) {
        notify(
                null,
                "admin,warehouse_manager,inbound_coordinator",
                entity.getWarehouseId(),
                "Task Created",
                "Task " + entity.getTaskNumber() + " is available for execution.",
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
                    "Task " + entity.getTaskNumber() + " has been assigned to you.",
                    "task",
                    "/worker/tasks/" + entity.getId(),
                    "{\"taskId\":\"" + entity.getId() + "\",\"taskNumber\":\"" + entity.getTaskNumber() + "\",\"status\":\"" + entity.getStatus() + "\"}"
            );
        }
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
