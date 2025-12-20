package com.optiwms.coreapi.tasks;

import com.optiwms.coreapp.tasks.TaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<TaskDto>> list() {
        var data = service.listAll().stream()
                .map(t -> new TaskDto(
                        t.getId(),
                        t.getTaskNumber(),
                        t.getTaskType(),
                        t.getWarehouseId(),
                        t.getAssignedTo(),
                        t.getPriority(),
                        t.getStatus(),
                        t.getDueDate(),
                        t.getCompletedAt(),
                        t.getLocationCode(),
                        t.getReferenceType(),
                        t.getReferenceId(),
                        t.getNotes()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var task = service.findById(id);
            return ResponseEntity.ok(new TaskDto(
                    task.getId(),
                    task.getTaskNumber(),
                    task.getTaskType(),
                    task.getWarehouseId(),
                    task.getAssignedTo(),
                    task.getPriority(),
                    task.getStatus(),
                    task.getDueDate(),
                    task.getCompletedAt(),
                    task.getLocationCode(),
                    task.getReferenceType(),
                    task.getReferenceId(),
                    task.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<TaskDto> create(@RequestBody CreateTaskRequest request) {
        try {
            var task = new com.optiwms.domain.tasks.Task();
            task.setTaskNumber(request.taskNumber());
            task.setTaskType(request.taskType());
            task.setWarehouseId(request.warehouseId());
            task.setAssignedTo(request.assignedTo());
            task.setPriority(request.priority());
            task.setStatus(request.status());
            task.setDueDate(request.dueDate());
            task.setLocationCode(request.locationCode());
            task.setReferenceType(request.referenceType());
            task.setReferenceId(request.referenceId());
            task.setNotes(request.notes());

            var created = service.create(task);
            return ResponseEntity.ok(new TaskDto(
                    created.getId(),
                    created.getTaskNumber(),
                    created.getTaskType(),
                    created.getWarehouseId(),
                    created.getAssignedTo(),
                    created.getPriority(),
                    created.getStatus(),
                    created.getDueDate(),
                    created.getCompletedAt(),
                    created.getLocationCode(),
                    created.getReferenceType(),
                    created.getReferenceId(),
                    created.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskDto> update(@PathVariable @NonNull java.util.UUID id, @RequestBody UpdateTaskRequest request) {
        try {
            var task = new com.optiwms.domain.tasks.Task();
            task.setTaskNumber(request.taskNumber());
            task.setTaskType(request.taskType());
            task.setWarehouseId(request.warehouseId());
            task.setAssignedTo(request.assignedTo());
            task.setPriority(request.priority());
            task.setStatus(request.status());
            task.setDueDate(request.dueDate());
            task.setLocationCode(request.locationCode());
            task.setReferenceType(request.referenceType());
            task.setReferenceId(request.referenceId());
            task.setNotes(request.notes());

            var updated = service.update(id, task);
            return ResponseEntity.ok(new TaskDto(
                    updated.getId(),
                    updated.getTaskNumber(),
                    updated.getTaskType(),
                    updated.getWarehouseId(),
                    updated.getAssignedTo(),
                    updated.getPriority(),
                    updated.getStatus(),
                    updated.getDueDate(),
                    updated.getCompletedAt(),
                    updated.getLocationCode(),
                    updated.getReferenceType(),
                    updated.getReferenceId(),
                    updated.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<TaskDto> assign(@PathVariable @NonNull java.util.UUID id, @RequestBody AssignTaskRequest request) {
        try {
            var assignedTo = Objects.requireNonNull(request.assignedTo(), "assignedTo cannot be null");
            var task = service.assign(id, assignedTo);
            return ResponseEntity.ok(new TaskDto(
                    task.getId(),
                    task.getTaskNumber(),
                    task.getTaskType(),
                    task.getWarehouseId(),
                    task.getAssignedTo(),
                    task.getPriority(),
                    task.getStatus(),
                    task.getDueDate(),
                    task.getCompletedAt(),
                    task.getLocationCode(),
                    task.getReferenceType(),
                    task.getReferenceId(),
                    task.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<TaskDto> complete(@PathVariable @NonNull java.util.UUID id) {
        try {
            var task = service.complete(id);
            return ResponseEntity.ok(new TaskDto(
                    task.getId(),
                    task.getTaskNumber(),
                    task.getTaskType(),
                    task.getWarehouseId(),
                    task.getAssignedTo(),
                    task.getPriority(),
                    task.getStatus(),
                    task.getDueDate(),
                    task.getCompletedAt(),
                    task.getLocationCode(),
                    task.getReferenceType(),
                    task.getReferenceId(),
                    task.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable @NonNull java.util.UUID id) {
        try {
            service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    public record TaskDto(
            java.util.UUID id,
            String taskNumber,
            String taskType,
            java.util.UUID warehouseId,
            java.util.UUID assignedTo,
            String priority,
            String status,
            java.time.LocalDateTime dueDate,
            java.time.LocalDateTime completedAt,
            String locationCode,
            String referenceType,
            java.util.UUID referenceId,
            String notes
    ) {}

    public record CreateTaskRequest(
            String taskNumber,
            String taskType,
            java.util.UUID warehouseId,
            java.util.UUID assignedTo,
            String priority,
            String status,
            java.time.LocalDateTime dueDate,
            String locationCode,
            String referenceType,
            java.util.UUID referenceId,
            String notes
    ) {}

    public record UpdateTaskRequest(
            String taskNumber,
            String taskType,
            java.util.UUID warehouseId,
            java.util.UUID assignedTo,
            String priority,
            String status,
            java.time.LocalDateTime dueDate,
            String locationCode,
            String referenceType,
            java.util.UUID referenceId,
            String notes
    ) {}

    public record AssignTaskRequest(java.util.UUID assignedTo) {}
}

