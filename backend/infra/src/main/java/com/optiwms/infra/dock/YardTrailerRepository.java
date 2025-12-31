package com.optiwms.infra.dock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface YardTrailerRepository extends JpaRepository<YardTrailerEntity, UUID> {
    List<YardTrailerEntity> findByWarehouseId(UUID warehouseId);
    List<YardTrailerEntity> findByWarehouseIdAndStatus(UUID warehouseId, String status);
    List<YardTrailerEntity> findByAssignedDockDoorId(UUID dockDoorId);
    Optional<YardTrailerEntity> findByTrailerNumber(String trailerNumber);
    boolean existsByTrailerNumber(String trailerNumber);
}

