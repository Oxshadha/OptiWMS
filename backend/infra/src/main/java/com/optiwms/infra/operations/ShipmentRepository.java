package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShipmentRepository extends JpaRepository<ShipmentEntity, UUID> {
    Optional<ShipmentEntity> findByShipmentNumber(String shipmentNumber);
    List<ShipmentEntity> findByOrderId(UUID orderId);
    List<ShipmentEntity> findByStatus(String status);
    List<ShipmentEntity> findByCarrierIgnoreCase(String carrier);
}
