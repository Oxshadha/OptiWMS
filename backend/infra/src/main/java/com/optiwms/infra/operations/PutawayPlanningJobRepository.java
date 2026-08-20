package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PutawayPlanningJobRepository extends JpaRepository<PutawayPlanningJobEntity, UUID> {

    Optional<PutawayPlanningJobEntity> findByOrderId(UUID orderId);

    @Modifying
    @Query(value = """
            INSERT INTO putaway_planning_jobs
                (id, order_id, warehouse_id, status, attempt_count, next_attempt_at, created_at, updated_at)
            VALUES
                (:id, :orderId, :warehouseId, 'PENDING', 0, :now, :now, :now)
            ON CONFLICT (order_id) DO NOTHING
            """, nativeQuery = true)
    int enqueueIfAbsent(
            @Param("id") UUID id,
            @Param("orderId") UUID orderId,
            @Param("warehouseId") UUID warehouseId,
            @Param("now") LocalDateTime now);

    @Query(value = """
            SELECT *
              FROM putaway_planning_jobs
             WHERE (
                    (status IN ('PENDING', 'RETRY') AND next_attempt_at <= :now)
                 OR (status = 'PROCESSING' AND locked_at <= :staleBefore)
             )
             ORDER BY created_at
             LIMIT :batchSize
             FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<PutawayPlanningJobEntity> findClaimable(
            @Param("now") LocalDateTime now,
            @Param("staleBefore") LocalDateTime staleBefore,
            @Param("batchSize") int batchSize);
}
