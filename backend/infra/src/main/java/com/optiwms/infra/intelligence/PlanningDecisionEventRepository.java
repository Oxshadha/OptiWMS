package com.optiwms.infra.intelligence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanningDecisionEventRepository extends JpaRepository<PlanningDecisionEventEntity, UUID> {
    List<PlanningDecisionEventEntity> findByWarehouseIdOrderByCreatedAtDesc(UUID warehouseId);
    Optional<PlanningDecisionEventEntity> findFirstByRecommendationIdAndRecommendationTypeOrderByCreatedAtDesc(
            UUID recommendationId, String recommendationType);
}
