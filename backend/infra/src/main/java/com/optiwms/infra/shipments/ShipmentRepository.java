package com.optiwms.infra.shipments;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShipmentRepository extends JpaRepository<ShipmentEntity, UUID> {
    Optional<ShipmentEntity> findByShipmentNumber(String shipmentNumber);
    Optional<ShipmentEntity> findByTrackingNumber(String trackingNumber);
    List<ShipmentEntity> findByOrderId(UUID orderId);
    List<ShipmentEntity> findByStatus(String status);
}

