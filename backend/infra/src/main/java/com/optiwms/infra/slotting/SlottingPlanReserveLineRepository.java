package com.optiwms.infra.slotting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SlottingPlanReserveLineRepository extends JpaRepository<SlottingPlanReserveLineEntity, UUID> {
    List<SlottingPlanReserveLineEntity> findByPlanLineIdOrderBySequenceNoAsc(UUID planLineId);

    void deleteByPlanLineIdIn(List<UUID> planLineIds);
}
