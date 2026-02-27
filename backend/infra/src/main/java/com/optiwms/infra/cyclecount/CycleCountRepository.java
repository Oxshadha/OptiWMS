package com.optiwms.infra.cyclecount;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycleCountRepository extends JpaRepository<CycleCountEntity, UUID>, JpaSpecificationExecutor<CycleCountEntity> {
    Optional<CycleCountEntity> findByCountNumber(String countNumber);
    List<CycleCountEntity> findByStatus(String status);
    List<CycleCountEntity> findByWarehouseId(UUID warehouseId);
}
