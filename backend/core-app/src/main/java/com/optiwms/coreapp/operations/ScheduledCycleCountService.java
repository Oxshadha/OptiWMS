package com.optiwms.coreapp.operations;

import com.optiwms.infra.cyclecount.CycleCountScheduleEntity;
import com.optiwms.infra.cyclecount.CycleCountScheduleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Service for automated cycle count scheduling
 * Runs daily at 1 AM to check and create scheduled counts
 */
@Service
public class ScheduledCycleCountService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledCycleCountService.class);

    private final CycleCountScheduleRepository scheduleRepository;
    private final CycleCountService cycleCountService;

    public ScheduledCycleCountService(CycleCountScheduleRepository scheduleRepository,
                                      CycleCountService cycleCountService) {
        this.scheduleRepository = scheduleRepository;
        this.cycleCountService = cycleCountService;
    }

    /**
     * Runs daily at 1 AM to check for due scheduled counts
     * Creates cycle counts if schedule is active and auto_create is true
     */
    @Scheduled(cron = "0 0 1 * * ?") // Daily at 1 AM
    @Transactional
    public void checkAndCreateScheduledCounts() {
        log.info("[Scheduler] Checking for due cycle count schedules...");

        LocalDate today = LocalDate.now();
        List<CycleCountScheduleEntity> dueSchedules = 
            scheduleRepository.findByNextScheduledDateLessThanEqualAndAutoCreateTrueAndActiveTrue(today);

        if (dueSchedules.isEmpty()) {
            log.info("[Scheduler] No due schedules found.");
            return;
        }

        log.info("[Scheduler] Found {} due schedule(s). Creating cycle counts...", dueSchedules.size());

        for (CycleCountScheduleEntity schedule : dueSchedules) {
            try {
                createScheduledCount(schedule);
            } catch (Exception e) {
                log.error("[Scheduler] Failed to create cycle count for schedule {}: {}", 
                    schedule.getId(), e.getMessage(), e);
                // Continue with next schedule even if this one fails
            }
        }

        log.info("[Scheduler] Scheduled cycle count check complete.");
    }

    /**
     * Create a cycle count from a schedule and update next scheduled date
     */
    private void createScheduledCount(CycleCountScheduleEntity schedule) {
        log.info("[Scheduler] Creating cycle count for schedule {} (warehouse: {})", 
            schedule.getId(), schedule.getWarehouseId());

        // Generate count number
        String countNumber = generateCountNumber(schedule);

        // Create cycle count
        CycleCountService.CycleCount cycleCount = new CycleCountService.CycleCount();
        cycleCount.setCountNumber(countNumber);
        cycleCount.setWarehouseId(schedule.getWarehouseId());
        cycleCount.setLocationCode(schedule.getLocationPattern()); // Can be null for all locations
        cycleCount.setScheduledDate(LocalDate.now());
        cycleCount.setStatus("scheduled");
        cycleCount.setNotes(String.format("Auto-created from %s schedule (ID: %s)", 
            schedule.getFrequency(), schedule.getId()));

        // TODO: Auto-assign workers if enabled (requires worker repository integration)
        if (Boolean.TRUE.equals(schedule.getAutoAssignWorkers())) {
            // Future: Query available workers and assign
            log.info("[Scheduler] Auto-assign workers is enabled but not yet implemented");
        }

        cycleCountService.create(cycleCount);
        log.info("[Scheduler] Created cycle count: {}", countNumber);

        // Update next scheduled date based on frequency
        LocalDate nextDate = calculateNextScheduledDate(schedule);
        schedule.setNextScheduledDate(nextDate);
        scheduleRepository.save(schedule);

        log.info("[Scheduler] Next scheduled date for schedule {}: {}", schedule.getId(), nextDate);
    }

    /**
     * Generate count number based on schedule
     */
    private String generateCountNumber(CycleCountScheduleEntity schedule) {
        String prefix = switch (schedule.getFrequency()) {
            case "quarterly" -> "QTR";
            case "monthly" -> "MON";
            case "weekly" -> "WKL";
            default -> "CST"; // custom
        };
        return String.format("%s-CC-%d", prefix, System.currentTimeMillis());
    }

    /**
     * Calculate next scheduled date based on frequency
     */
    private LocalDate calculateNextScheduledDate(CycleCountScheduleEntity schedule) {
        LocalDate current = schedule.getNextScheduledDate();
        
        return switch (schedule.getFrequency()) {
            case "quarterly" -> current.plusMonths(3);
            case "monthly" -> current.plusMonths(1);
            case "weekly" -> current.plusWeeks(1);
            case "custom" -> {
                Integer days = schedule.getIntervalDays();
                if (days == null || days <= 0) {
                    log.warn("[Scheduler] Invalid interval_days for custom schedule {}, defaulting to 30 days", 
                        schedule.getId());
                    yield current.plusDays(30);
                }
                yield current.plusDays(days);
            }
            default -> {
                log.warn("[Scheduler] Unknown frequency '{}' for schedule {}, defaulting to 90 days", 
                    schedule.getFrequency(), schedule.getId());
                yield current.plusDays(90);
            }
        };
    }

    // === Manual API methods for schedule management ===

    /**
     * Create a new schedule (for admin API)
     */
    @Transactional
    public CycleCountScheduleEntity createSchedule(CycleCountScheduleEntity schedule) {
        log.info("[Schedule API] Creating new schedule for warehouse: {}", schedule.getWarehouseId());
        return scheduleRepository.save(schedule);
    }

    /**
     * List all schedules
     */
    public List<CycleCountScheduleEntity> listAllSchedules() {
        return scheduleRepository.findByActiveTrueOrderByNextScheduledDateAsc();
    }

    /**
     * List schedules for a specific warehouse
     */
    public List<CycleCountScheduleEntity> listSchedulesByWarehouse(UUID warehouseId) {
        return scheduleRepository.findByWarehouseIdOrderByNextScheduledDateAsc(warehouseId);
    }

    /**
     * Update a schedule
     */
    @Transactional
    public CycleCountScheduleEntity updateSchedule(UUID id, CycleCountScheduleEntity updates) {
        CycleCountScheduleEntity existing = scheduleRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Schedule not found: " + id));

        if (updates.getFrequency() != null) {
            existing.setFrequency(updates.getFrequency());
        }
        if (updates.getIntervalDays() != null) {
            existing.setIntervalDays(updates.getIntervalDays());
        }
        if (updates.getNextScheduledDate() != null) {
            existing.setNextScheduledDate(updates.getNextScheduledDate());
        }
        if (updates.getLocationPattern() != null) {
            existing.setLocationPattern(updates.getLocationPattern());
        }
        if (updates.getAutoCreate() != null) {
            existing.setAutoCreate(updates.getAutoCreate());
        }
        if (updates.getAutoAssignWorkers() != null) {
            existing.setAutoAssignWorkers(updates.getAutoAssignWorkers());
        }
        if (updates.getActive() != null) {
            existing.setActive(updates.getActive());
        }

        return scheduleRepository.save(existing);
    }

    /**
     * Delete (deactivate) a schedule
     */
    @Transactional
    public void deleteSchedule(UUID id) {
        CycleCountScheduleEntity schedule = scheduleRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Schedule not found: " + id));
        schedule.setActive(false);
        scheduleRepository.save(schedule);
        log.info("[Schedule API] Deactivated schedule: {}", id);
    }
}
