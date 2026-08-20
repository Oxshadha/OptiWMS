package com.optiwms.infra.forecastspace;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InventoryPolicyRecommendationLineRepository
        extends JpaRepository<InventoryPolicyRecommendationLineEntity, UUID> {
    List<InventoryPolicyRecommendationLineEntity> findByRunIdOrderByMaterialCodeAsc(UUID runId);
    Optional<InventoryPolicyRecommendationLineEntity> findByRunIdAndMaterialId(UUID runId, UUID materialId);
}
