package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OperationEventRepository extends JpaRepository<OperationEventEntity, UUID> {
    List<OperationEventEntity> findByCompletedAtAfter(LocalDateTime dateTime);
    List<OperationEventEntity> findByWorkerId(UUID workerId);
}
