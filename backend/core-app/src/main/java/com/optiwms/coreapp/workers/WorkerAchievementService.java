package com.optiwms.coreapp.workers;

import com.optiwms.domain.workers.WorkerAchievement;
import com.optiwms.infra.workers.WorkerAchievementEntity;
import com.optiwms.infra.workers.WorkerAchievementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WorkerAchievementService {

    private final WorkerAchievementRepository repository;

    public WorkerAchievementService(WorkerAchievementRepository repository) {
        this.repository = repository;
    }

    public List<WorkerAchievement> findByWorkerId(UUID workerId) {
        return repository.findByWorkerIdOrderByEarnedAtDesc(workerId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<WorkerAchievement> findByWorkerIdAndType(UUID workerId, String achievementType) {
        return repository.findByWorkerIdAndAchievementTypeOrderByEarnedAtDesc(workerId, achievementType).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Transactional
    public WorkerAchievement create(WorkerAchievement achievement) {
        WorkerAchievementEntity entity = toEntity(achievement);
        if (entity.getEarnedAt() == null) {
            entity.setEarnedAt(OffsetDateTime.now());
        }
        return toDomain(repository.save(entity));
    }

    private WorkerAchievement toDomain(WorkerAchievementEntity entity) {
        WorkerAchievement domain = new WorkerAchievement();
        domain.setId(entity.getId());
        domain.setWorkerId(entity.getWorkerId());
        domain.setAchievementType(entity.getAchievementType());
        domain.setEarnedAt(entity.getEarnedAt());
        domain.setMetadata(entity.getMetadata());
        return domain;
    }

    private WorkerAchievementEntity toEntity(WorkerAchievement domain) {
        WorkerAchievementEntity entity = new WorkerAchievementEntity();
        entity.setId(domain.getId());
        entity.setWorkerId(domain.getWorkerId());
        entity.setAchievementType(domain.getAchievementType());
        entity.setEarnedAt(domain.getEarnedAt());
        entity.setMetadata(domain.getMetadata());
        return entity;
    }
}

