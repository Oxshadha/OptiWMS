package com.optiwms.infra.tasks;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TaskRepository extends JpaRepository<TaskEntity, UUID> {
    Optional<TaskEntity> findByTaskNumber(String taskNumber);
    List<TaskEntity> findByTaskType(String taskType);
    List<TaskEntity> findByStatus(String status);
    List<TaskEntity> findByAssignedTo(UUID assignedTo);
    List<TaskEntity> findByWarehouseId(UUID warehouseId);
    List<TaskEntity> findByTaskTypeAndStatus(String taskType, String status);
}

