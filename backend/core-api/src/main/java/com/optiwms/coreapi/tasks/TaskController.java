package com.optiwms.coreapi.tasks;

import com.optiwms.coreapp.orders.OutboundOrderWorkflowService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.tasks.Task;
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

    public TaskController(TaskService taskService, OutboundOrderWorkflowService workflowService) {
        this.taskService = taskService;
        this.workflowService = workflowService;
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

    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getById(@PathVariable UUID id) {
        try {
            Task task = taskService.findById(id);
            return ResponseEntity.ok(toDto(task));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<TaskDto> create(@RequestBody CreateTaskRequest request) {
        try {
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
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<TaskDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody UpdateStatusRequest request
    ) {
        try {
            Task updated = taskService.updateStatus(id, request.status());
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<TaskDto> assignTask(
            @PathVariable UUID id,
            @RequestBody AssignTaskRequest request
    ) {
        try {
            Task updated = taskService.assignTask(id, UUID.fromString(request.workerId()), request.assignedBy());
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<TaskDto> claimTask(
            @PathVariable UUID id,
            @RequestBody ClaimTaskRequest request
    ) {
        try {
            Task updated = workflowService.claimTask(id, UUID.fromString(request.workerId()));
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
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

    public record UpdateStatusRequest(String status) {}

    public record AssignTaskRequest(
            String workerId,
            String assignedBy,
            java.util.List<String> warnings
    ) {}

    public record ClaimTaskRequest(String workerId) {}

    public record TaskDto(
            String id,
            String taskNumber,
            String taskType,
            String warehouseId,
            String assignedTo,
            String priority,
            String status,
            String dueDate,
            String completedAt,
            String locationCode,
            String referenceType,
            String referenceId,
            String notes
    ) {}
}

