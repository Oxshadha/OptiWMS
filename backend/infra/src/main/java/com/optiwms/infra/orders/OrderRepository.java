package com.optiwms.infra.orders;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, UUID>, JpaSpecificationExecutor<OrderEntity> {
    Optional<OrderEntity> findByOrderNumber(String orderNumber);
    long countByOrderNumberStartingWith(String prefix);
    List<OrderEntity> findByOrderType(String orderType);
    List<OrderEntity> findByWarehouseId(UUID warehouseId);
    @Query(value = """
            SELECT o.*
            FROM orders o
            WHERE o.warehouse_id = :warehouseId
              AND o.dataset_version IN (
                  'OPERATIONAL_ENTRY',
                  COALESCE((SELECT w.dataset_version FROM warehouses w WHERE w.id = :warehouseId), 'OPERATIONAL_ENTRY')
              )
            """, nativeQuery = true)
    List<OrderEntity> findOperationalByWarehouseId(@Param("warehouseId") UUID warehouseId);
    List<OrderEntity> findByStatus(String status);
    List<OrderEntity> findByOrderTypeAndStatus(String orderType, String status);
}
