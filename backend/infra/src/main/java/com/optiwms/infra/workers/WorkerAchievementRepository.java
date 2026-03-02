package com.optiwms.infra.workers;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkerAchievementRepository extends JpaRepository<WorkerAchievementEntity, UUID> {
    List<WorkerAchievementEntity> findByWorkerIdOrderByEarnedAtDesc(UUID workerId);
    List<WorkerAchievementEntity> findByWorkerIdAndAchievementTypeOrderByEarnedAtDesc(UUID workerId, String achievementType);
    boolean existsByWorkerIdAndAchievementType(UUID workerId, String achievementType);
}
