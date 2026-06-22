package com.optiwms.infra.slotting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SlottingPlanLineRepository extends JpaRepository<SlottingPlanLineEntity, UUID> {
    List<SlottingPlanLineEntity> findByPlanIdOrderByMaterialCodeAsc(UUID planId);

    Optional<SlottingPlanLineEntity> findByPlanIdAndMaterialId(UUID planId, UUID materialId);

    void deleteByPlanId(UUID planId);
}
