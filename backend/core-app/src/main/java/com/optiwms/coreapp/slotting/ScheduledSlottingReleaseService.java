package com.optiwms.coreapp.slotting;

import com.optiwms.infra.slotting.SlottingPlanRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

@Service
public class ScheduledSlottingReleaseService {
    private final SlottingPlanRepository repository;
    private final SlottingPlanService service;

    public ScheduledSlottingReleaseService(SlottingPlanRepository repository, SlottingPlanService service) {
        this.repository = repository;
        this.service = service;
    }

    @Scheduled(fixedDelayString = "${slotting.release.poll-delay-ms:30000}")
    public void releaseDuePlans() {
        repository.findByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc("SCHEDULED", OffsetDateTime.now())
                .forEach(plan -> service.releaseScheduledPlan(plan.getId()));
    }
}
