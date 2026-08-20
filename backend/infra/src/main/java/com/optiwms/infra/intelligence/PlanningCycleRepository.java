package com.optiwms.infra.intelligence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlanningCycleRepository extends JpaRepository<PlanningCycleEntity, UUID> {
    List<PlanningCycleEntity> findByWarehouseIdOrderByCreatedAtDesc(UUID warehouseId);
}
