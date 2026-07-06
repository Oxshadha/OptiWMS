package com.optiwms.infra.forecastspace;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpaceOptimizationLineRepository extends JpaRepository<SpaceOptimizationLineEntity, UUID> {
    List<SpaceOptimizationLineEntity> findByRunIdOrderByMaterialCodeAsc(UUID runId);
}
