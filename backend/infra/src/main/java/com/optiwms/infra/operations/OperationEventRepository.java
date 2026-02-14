package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OperationEventRepository extends JpaRepository<OperationEventEntity, UUID> {
    List<OperationEventEntity> findByCompletedAtAfter(LocalDateTime dateTime);
    List<OperationEventEntity> findByWorkerId(UUID workerId);
    @Query("""
            SELECT e
            FROM OperationEventEntity e
            WHERE e.warehouseId = :warehouseId
              AND e.completedAt >= :startDate
              AND e.completedAt <= :endDate
            """)
    List<OperationEventEntity> findByWarehouseAndCompletedAtBetween(
            @Param("warehouseId") UUID warehouseId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );
}
