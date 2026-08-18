package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface InboundPutawayAllocationRepository extends JpaRepository<InboundPutawayAllocationEntity, UUID> {

    List<InboundPutawayAllocationEntity> findByOrderItemId(UUID orderItemId);

    List<InboundPutawayAllocationEntity> findByOrderId(UUID orderId);

    /**
     * Live claims for a warehouse: those still awaiting putaway tasks. Claims that have become
     * tasks are excluded because the task itself then holds the space, and counting both would
     * reserve every pallet twice.
     */
    @Query("""
            SELECT a FROM InboundPutawayAllocationEntity a
            WHERE a.warehouseId = :warehouseId
              AND a.status = 'planned'
            """)
    List<InboundPutawayAllocationEntity> findLiveByWarehouse(@Param("warehouseId") UUID warehouseId);

    @Modifying
    @Query("""
            UPDATE InboundPutawayAllocationEntity a
            SET a.status = :status, a.updatedAt = CURRENT_TIMESTAMP
            WHERE a.orderItemId = :orderItemId AND a.status = 'planned'
            """)
    int updateStatusForItem(@Param("orderItemId") UUID orderItemId, @Param("status") String status);

    @Modifying
    @Query("""
            UPDATE InboundPutawayAllocationEntity a
            SET a.status = 'released', a.updatedAt = CURRENT_TIMESTAMP
            WHERE a.orderId = :orderId AND a.status IN ('planned', 'tasked')
            """)
    int releaseForOrder(@Param("orderId") UUID orderId);
}
