package com.optiwms.coreapi.tasks;

import com.optiwms.coreapp.operations.OperationEventService;
import com.optiwms.coreapp.orders.OutboundOrderWorkflowService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.tasks.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final OutboundOrderWorkflowService workflowService;
    private final OperationEventService operationEventService;

    public TaskController(
            TaskService taskService,
            OutboundOrderWorkflowService workflowService,
            OperationEventService operationEventService
    ) {
        this.taskService = taskService;
        this.workflowService = workflowService;
        this.operationEventService = operationEventService;
    }

    @GetMapping
    public ResponseEntity<List<TaskDto>> listAll(
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String assignedTo,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) Boolean availableOnly
    ) {
        List<Task> tasks;
        if (taskType != null && status != null && warehouseId != null) {
            // Get available tasks (unassigned) for a specific warehouse and task type
            tasks = taskService.findByWarehouseAndTypeAndStatus(
                    UUID.fromString(warehouseId), 
                    taskType, 
                    status
            );
        } else if (warehouseId != null && taskType != null) {
            // Get all tasks for warehouse and type
            List<Task> warehouseTasks = taskService.findByWarehouseId(UUID.fromString(warehouseId));
            tasks = warehouseTasks.stream()
                    .filter(task -> taskType.equals(task.getTaskType()))
                    .collect(Collectors.toList());
        } else if (taskType != null && status != null) {
            tasks = taskService.findByTaskTypeAndStatus(taskType, status);
        } else if (taskType != null) {
            tasks = taskService.findByType(taskType);
        } else if (status != null) {
            tasks = taskService.findByStatus(status);
        } else if (assignedTo != null) {
            tasks = taskService.findByAssignedTo(UUID.fromString(assignedTo));
        } else if (warehouseId != null) {
            tasks = taskService.findByWarehouseId(UUID.fromString(warehouseId));
        } else {
            tasks = taskService.listAll();
        }

        // Filter to show only available (unassigned) tasks if requested
        if (Boolean.TRUE.equals(availableOnly)) {
            tasks = tasks.stream()
                    .filter(task -> task.getAssignedTo() == null && "pending".equals(task.getStatus()))
                    .collect(Collectors.toList());
        }

        List<TaskDto> taskDtos = tasks.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(taskDtos);
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedTaskResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String assignedTo,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) Boolean availableOnly,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);

        Page<Task> taskPage = taskService.findPaged(
                taskType,
                status,
                assignedTo != null && !assignedTo.isBlank() ? UUID.fromString(assignedTo) : null,
                warehouseId != null && !warehouseId.isBlank() ? UUID.fromString(warehouseId) : null,
                availableOnly,
                q,
                PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy))
        );

        List<TaskDto> taskDtos = taskPage.getContent().stream()
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(new PagedTaskResponse(
                taskDtos,
                taskPage.getNumber(),
                taskPage.getSize(),
                taskPage.getTotalElements(),
                taskPage.getTotalPages()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getById(@PathVariable UUID id) {
        Task task = taskService.findById(id);
        return ResponseEntity.ok(toDto(task));
    }

    @PostMapping
    public ResponseEntity<TaskDto> create(@RequestBody CreateTaskRequest request) {
        Task task = new Task();
        task.setTaskNumber(request.taskNumber());
        task.setTaskType(request.taskType());
        task.setWarehouseId(UUID.fromString(request.warehouseId()));
        task.setAssignedTo(request.assignedTo() != null ? UUID.fromString(request.assignedTo()) : null);
        task.setPriority(request.priority() != null ? request.priority() : "normal");
        task.setStatus(request.status() != null ? request.status() : "pending");
        if (request.dueDate() != null && !request.dueDate().isEmpty()) {
            task.setDueDate(LocalDateTime.parse(request.dueDate()));
        }
        task.setLocationCode(request.locationCode());
        task.setReferenceType(request.referenceType());
        task.setReferenceId(request.referenceId() != null ? UUID.fromString(request.referenceId()) : null);
        task.setNotes(request.notes());

        Task created = taskService.create(task);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<TaskDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody UpdateStatusRequest request
    ) {
        Task updated;
        if (request.workerId() != null && !request.workerId().isBlank()) {
            updated = taskService.updateStatusWithWorker(id, request.status(), UUID.fromString(request.workerId()));
        } else {
            updated = taskService.updateStatus(id, request.status());
        }
        recordGenericTaskCompletion(updated, request.workerId(), request.status());
        return ResponseEntity.ok(toDto(updated));
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<TaskDto> assignTask(
            @PathVariable UUID id,
            @RequestBody AssignTaskRequest request
    ) {
        Task updated = taskService.assignTask(id, UUID.fromString(request.workerId()), request.assignedBy());
        return ResponseEntity.ok(toDto(updated));
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<TaskDto> claimTask(
            @PathVariable UUID id,
            @RequestBody ClaimTaskRequest request
    ) {
        Task updated = workflowService.claimTask(id, UUID.fromString(request.workerId()));
        return ResponseEntity.ok(toDto(updated));
    }

    @PostMapping("/{id}/errors")
    public ResponseEntity<TaskDto> reportTaskError(
            @PathVariable UUID id,
            @RequestBody ReportTaskErrorRequest request
    ) {
        Task task = taskService.findById(id);
        recordGenericTaskError(task, request.workerId(), request.message());
        return ResponseEntity.ok(toDto(task));
    }

    private TaskDto toDto(Task task) {
        return new TaskDto(
                task.getId().toString(),
                task.getTaskNumber(),
                task.getTaskType(),
                task.getWarehouseId() != null ? task.getWarehouseId().toString() : null,
                task.getAssignedTo() != null ? task.getAssignedTo().toString() : null,
                task.getPriority(),
                task.getStatus(),
                task.getDueDate() != null ? task.getDueDate().toString() : null,
                task.getStartedAt() != null ? task.getStartedAt().toString() : null,
                task.getCompletedAt() != null ? task.getCompletedAt().toString() : null,
                task.getLocationCode(),
                task.getReferenceType(),
                task.getReferenceId() != null ? task.getReferenceId().toString() : null,
                task.getNotes()
        );
    }

    public record CreateTaskRequest(
            String taskNumber,
            String taskType,
            String warehouseId,
            String assignedTo,
            String priority,
            String status,
            String dueDate,
            String locationCode,
            String referenceType,
            String referenceId,
            String notes
    ) {}

    public record UpdateStatusRequest(String status, String workerId) {}

    public record AssignTaskRequest(
            String workerId,
            String assignedBy,
            java.util.List<String> warnings
    ) {}

    public record ClaimTaskRequest(String workerId) {}

    public record ReportTaskErrorRequest(String workerId, String message) {}

    public record TaskDto(
            String id,
            String taskNumber,
            String taskType,
            String warehouseId,
            String assignedTo,
            String priority,
            String status,
            String dueDate,
            String startedAt,
            String completedAt,
            String locationCode,
            String referenceType,
            String referenceId,
            String notes
    ) {}

    public record PagedTaskResponse(
            List<TaskDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "createdAt";
        }
        return switch (sortBy) {
            case "taskNumber", "taskType", "priority", "status", "dueDate", "startedAt", "completedAt", "createdAt" -> sortBy;
            default -> "createdAt";
        };
    }

    private void recordGenericTaskCompletion(Task task, String workerId, String status) {
        if (!"completed".equalsIgnoreCase(status) || workerId == null || workerId.isBlank()) {
            return;
        }

        try {
            operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                    task.getTaskType() != null ? task.getTaskType().toUpperCase() : "TASK",
                    UUID.fromString(workerId),
                    task.getId(),
                    "order".equals(task.getReferenceType()) ? task.getReferenceId() : null,
                    "order_item".equals(task.getReferenceType()) ? task.getReferenceId() : null,
                    task.getWarehouseId(),
                    null,
                    null,
                    task.getStartedAt(),
                    task.getCompletedAt(),
                    task.getReferenceId() != null
                            ? "{\"referenceType\":\"" + task.getReferenceType() + "\",\"referenceId\":\"" + task.getReferenceId() + "\"}"
                            : null
            ));
        } catch (Exception ignored) {
            // Analytics failures must not block task updates.
        }
    }

    private void recordGenericTaskError(Task task, String workerId, String message) {
        if (workerId == null || workerId.isBlank()) {
            return;
        }

        try {
            String metadata = task.getReferenceId() != null
                    ? "{\"referenceType\":\"" + task.getReferenceType() + "\",\"referenceId\":\"" + task.getReferenceId()
                    + "\",\"message\":\"" + sanitizeMetadataValue(message) + "\"}"
                    : "{\"message\":\"" + sanitizeMetadataValue(message) + "\"}";

            operationEventService.recordError(new OperationEventService.OperationEventData(
                    task.getTaskType() != null ? task.getTaskType().toUpperCase() : "TASK",
                    UUID.fromString(workerId),
                    task.getId(),
                    "order".equals(task.getReferenceType()) ? task.getReferenceId() : null,
                    "order_item".equals(task.getReferenceType()) ? task.getReferenceId() : null,
                    task.getWarehouseId(),
                    null,
                    null,
                    task.getStartedAt(),
                    LocalDateTime.now(),
                    metadata
            ));
        } catch (Exception ignored) {
            // Analytics failures must not block task updates.
        }
    }

    private String sanitizeMetadataValue(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
