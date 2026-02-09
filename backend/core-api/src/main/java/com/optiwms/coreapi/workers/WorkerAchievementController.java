package com.optiwms.coreapi.workers;

import com.optiwms.coreapp.workers.WorkerAchievementService;
import com.optiwms.domain.workers.WorkerAchievement;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/workers")
public class WorkerAchievementController {

    private final WorkerAchievementService service;

    public WorkerAchievementController(WorkerAchievementService service) {
        this.service = service;
    }

    @GetMapping("/{workerId}/achievements")
    public ResponseEntity<List<WorkerAchievementDto>> getByWorkerId(
            @PathVariable UUID workerId,
            @RequestParam(required = false) String achievementType
    ) {
        try {
            List<WorkerAchievement> achievements;
            if (achievementType != null) {
                achievements = service.findByWorkerIdAndType(workerId, achievementType);
            } else {
                achievements = service.findByWorkerId(workerId);
            }

            List<WorkerAchievementDto> dtos = achievements.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{workerId}/achievements")
    public ResponseEntity<WorkerAchievementDto> create(
            @PathVariable UUID workerId,
            @RequestBody CreateWorkerAchievementRequest request
    ) {
        try {
            WorkerAchievement achievement = new WorkerAchievement();
            achievement.setWorkerId(workerId);
            achievement.setAchievementType(request.achievementType());
            achievement.setMetadata(request.metadata());
            achievement.setEarnedAt(OffsetDateTime.now());

            WorkerAchievement created = service.create(achievement);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private WorkerAchievementDto toDto(WorkerAchievement achievement) {
        return new WorkerAchievementDto(
                achievement.getId().toString(),
                achievement.getWorkerId().toString(),
                achievement.getAchievementType(),
                achievement.getEarnedAt() != null ? achievement.getEarnedAt().toString() : null,
                achievement.getMetadata()
        );
    }

    public record CreateWorkerAchievementRequest(
            String achievementType,
            String metadata // JSON string
    ) {}

    public record WorkerAchievementDto(
            String id,
            String workerId,
            String achievementType,
            String earnedAt,
            String metadata
    ) {}
}

