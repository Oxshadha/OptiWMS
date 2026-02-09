package com.optiwms.infra.dock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DockDoorRepository extends JpaRepository<DockDoorEntity, UUID> {
    List<DockDoorEntity> findByWarehouseId(UUID warehouseId);
    List<DockDoorEntity> findByWarehouseIdAndStatus(UUID warehouseId, String status);
    Optional<DockDoorEntity> findByWarehouseIdAndDoorNumber(UUID warehouseId, String doorNumber);
    boolean existsByWarehouseIdAndDoorNumber(UUID warehouseId, String doorNumber);
}

