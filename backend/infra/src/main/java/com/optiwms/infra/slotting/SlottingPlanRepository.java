package com.optiwms.infra.slotting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SlottingPlanRepository extends JpaRepository<SlottingPlanEntity, UUID> {
    List<SlottingPlanEntity> findByWarehouseIdOrderByCreatedAtDesc(UUID warehouseId);

    Optional<SlottingPlanEntity> findFirstByWarehouseIdAndStatusOrderByApprovedAtDesc(
            UUID warehouseId, String status);

    boolean existsByWarehouseIdAndPlanCode(UUID warehouseId, String planCode);

    Optional<SlottingPlanEntity> findByWarehouseIdAndPlanCode(UUID warehouseId, String planCode);
}
