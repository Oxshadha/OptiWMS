package com.optiwms.infra.orders;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, UUID> {
    Optional<OrderEntity> findByOrderNumber(String orderNumber);
    List<OrderEntity> findByOrderType(String orderType);
    List<OrderEntity> findByWarehouseId(UUID warehouseId);
    List<OrderEntity> findByStatus(String status);
    List<OrderEntity> findByOrderTypeAndStatus(String orderType, String status);
    List<OrderEntity> findByOrderTypeAndSupplierIdAndStatus(String orderType, UUID supplierId, String status);
}
