package com.optiwms.infra.orders;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItemEntity, UUID> {
    List<OrderItemEntity> findByOrderId(UUID orderId);
    List<OrderItemEntity> findByOrderIdIn(Collection<UUID> orderIds);
    List<OrderItemEntity> findByMaterialId(UUID materialId);

    /**
     * Line and quantity rollups for a page of orders, in one query.
     *
     * The inbound list previously fetched every order's items separately to count them, which
     * cost one request per row and silently reported zero when any of them failed.
     */
    @Query("SELECT i.orderId, COUNT(i), "
            + "SUM(COALESCE(i.quantity, 0)), "
            + "SUM(COALESCE(i.receivedQuantity, 0)), "
            + "SUM(CASE WHEN COALESCE(i.receivedQuantity, 0) >= COALESCE(i.quantity, 0) THEN 1 ELSE 0 END) "
            + "FROM OrderItemEntity i WHERE i.orderId IN :orderIds GROUP BY i.orderId")
    List<Object[]> summariseByOrderIds(@Param("orderIds") Collection<UUID> orderIds);
}
