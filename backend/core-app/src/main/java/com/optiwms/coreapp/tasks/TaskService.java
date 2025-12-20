package com.optiwms.coreapp.tasks;

import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.tasks.TaskEntity;
import com.optiwms.infra.tasks.TaskRepository;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private final TaskRepository repository;

    public TaskService(TaskRepository repository) {
        this.repository = repository;
    }

    public List<Task> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Task> findByType(String taskType) {
        return repository.findByTaskType(taskType).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Task> findByStatus(String status) {
        return repository.findByStatus(status).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Task> findByAssignedTo(@NonNull UUID assignedTo) {
        return repository.findByAssignedTo(assignedTo).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Task findById(@NonNull UUID id) {
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
        return toDomain(saved);
    }

    @Transactional
    public Task update(@NonNull UUID id, Task task) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));

        // Check if task number is being changed and if it conflicts
        if (!entity.getTaskNumber().equals(task.getTaskNumber())) {
            if (repository.findByTaskNumber(task.getTaskNumber()).isPresent()) {
                throw new RuntimeException("Task number already exists: " + task.getTaskNumber());
            }
        }

        entity.setTaskNumber(task.getTaskNumber());
        entity.setTaskType(task.getTaskType());
        entity.setWarehouseId(task.getWarehouseId());
        entity.setAssignedTo(task.getAssignedTo());
        entity.setPriority(task.getPriority());
        entity.setStatus(task.getStatus());
        entity.setDueDate(task.getDueDate());
        entity.setLocationCode(task.getLocationCode());
        entity.setReferenceType(task.getReferenceType());
        entity.setReferenceId(task.getReferenceId());
        entity.setNotes(task.getNotes());

        TaskEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Task assign(@NonNull UUID id, @NonNull UUID assignedTo) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        entity.setAssignedTo(assignedTo);
        entity.setStatus("in_progress");
        TaskEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Task complete(@NonNull UUID id) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        entity.setStatus("completed");
        entity.setCompletedAt(LocalDateTime.now());
        TaskEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Task updateStatus(@NonNull UUID id, String status) {
        TaskEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));
        entity.setStatus(status);
        if ("completed".equals(status)) {
            entity.setCompletedAt(LocalDateTime.now());
        }
        TaskEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(@NonNull UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Task not found: " + id);
        }
        repository.deleteById(id);
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
        task.setLocationCode(entity.getLocationCode());
        task.setReferenceType(entity.getReferenceType());
        task.setReferenceId(entity.getReferenceId());
        task.setNotes(entity.getNotes());
        return task;
    }
}

