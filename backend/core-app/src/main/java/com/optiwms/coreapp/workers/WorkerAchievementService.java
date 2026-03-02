package com.optiwms.coreapp.workers;

import com.optiwms.domain.workers.WorkerAchievement;
import com.optiwms.infra.operations.OperationEventEntity;
import com.optiwms.infra.operations.OperationEventRepository;
import com.optiwms.infra.workers.WorkerAchievementEntity;
import com.optiwms.infra.workers.WorkerAchievementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WorkerAchievementService {

    private final WorkerAchievementRepository repository;
    private final OperationEventRepository operationEventRepository;

    public WorkerAchievementService(
            WorkerAchievementRepository repository,
            OperationEventRepository operationEventRepository
    ) {
        this.repository = repository;
        this.operationEventRepository = operationEventRepository;
    }

    @Transactional
    public List<WorkerAchievement> findByWorkerId(UUID workerId) {
        ensureAutoAchievements(workerId);
        return repository.findByWorkerIdOrderByEarnedAtDesc(workerId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<WorkerAchievement> findByWorkerIdAndType(UUID workerId, String achievementType) {
        ensureAutoAchievements(workerId);
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

    private void ensureAutoAchievements(UUID workerId) {
        List<OperationEventEntity> allEvents = operationEventRepository.findByWorkerId(workerId).stream()
                .filter(event -> event.getCompletedAt() != null)
                .sorted(Comparator.comparing(OperationEventEntity::getCompletedAt))
                .toList();

        if (allEvents.isEmpty()) {
            return;
        }

        List<OperationEventEntity> completedEvents = allEvents.stream()
                .filter(event -> "completed".equalsIgnoreCase(event.getStatus()))
                .toList();

        if (completedEvents.isEmpty()) {
            return;
        }

        int completedCount = completedEvents.size();
        long earlyBirdCount = completedEvents.stream()
                .filter(event -> event.getCompletedAt().getHour() < 10)
                .count();
        long nightOwlCount = completedEvents.stream()
                .filter(event -> event.getCompletedAt().getHour() >= 20)
                .count();
        int timedTaskCount = (int) completedEvents.stream()
                .filter(event -> event.getDurationMinutes() != null && event.getDurationMinutes() > 0)
                .count();
        int totalDurationMinutes = completedEvents.stream()
                .map(OperationEventEntity::getDurationMinutes)
                .filter(duration -> duration != null && duration > 0)
                .mapToInt(Integer::intValue)
                .sum();
        double picksPerHour = totalDurationMinutes > 0
                ? (completedCount * 60.0) / totalDurationMinutes
                : 0.0;

        awardIfEligible(
                workerId,
                "century_club",
                completedCount >= 100,
                "{\"source\":\"operation_events\",\"completedTasks\":" + completedCount + "}"
        );
        awardIfEligible(
                workerId,
                "early_bird",
                earlyBirdCount >= 10,
                "{\"source\":\"operation_events\",\"before10amTasks\":" + earlyBirdCount + "}"
        );
        awardIfEligible(
                workerId,
                "night_owl",
                nightOwlCount >= 10,
                "{\"source\":\"operation_events\",\"after8pmTasks\":" + nightOwlCount + "}"
        );
        awardIfEligible(
                workerId,
                "speed_demon",
                timedTaskCount >= 10 && picksPerHour >= 50.0,
                "{\"source\":\"operation_events\",\"timedTasks\":" + timedTaskCount
                        + ",\"picksPerHour\":" + Math.round(picksPerHour * 10.0) / 10.0 + "}"
        );
        awardIfEligible(
                workerId,
                "perfect_week",
                hasPerfectWeek(completedEvents, allEvents),
                "{\"source\":\"operation_events\",\"rule\":\"7_consecutive_days_without_errors\"}"
        );
    }

    private boolean hasPerfectWeek(
            List<OperationEventEntity> completedEvents,
            List<OperationEventEntity> allEvents
    ) {
        var errorDays = allEvents.stream()
                .filter(event -> "error".equalsIgnoreCase(event.getStatus()))
                .map(event -> event.getCompletedAt().toLocalDate())
                .collect(Collectors.toSet());

        LocalDate previousDay = null;
        int streak = 0;

        for (LocalDate day : completedEvents.stream()
                .map(event -> event.getCompletedAt().toLocalDate())
                .distinct()
                .sorted()
                .toList()) {
            if (errorDays.contains(day)) {
                previousDay = day;
                streak = 0;
                continue;
            }

            if (previousDay == null) {
                streak = 1;
            } else if (previousDay.plusDays(1).equals(day)) {
                streak++;
            } else {
                streak = 1;
            }

            if (streak >= 7) {
                return true;
            }
            previousDay = day;
        }

        return false;
    }

    private void awardIfEligible(UUID workerId, String achievementType, boolean eligible, String metadata) {
        if (!eligible || repository.existsByWorkerIdAndAchievementType(workerId, achievementType)) {
            return;
        }

        WorkerAchievementEntity entity = new WorkerAchievementEntity();
        entity.setWorkerId(workerId);
        entity.setAchievementType(achievementType);
        entity.setEarnedAt(OffsetDateTime.now());
        entity.setMetadata(metadata);
        repository.save(entity);
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
