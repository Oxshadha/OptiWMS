package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.ScheduledCycleCountService;
import com.optiwms.infra.cyclecount.CycleCountScheduleEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST API for managing cycle count schedules
 * Allows admins to create, view, and manage automated cycle count schedules
 */
@RestController
@RequestMapping("/api/operations/cycle-count-schedules")
public class CycleCountScheduleController {

    private final ScheduledCycleCountService scheduledCycleCountService;

    public CycleCountScheduleController(ScheduledCycleCountService scheduledCycleCountService) {
        this.scheduledCycleCountService = scheduledCycleCountService;
    }

    /**
     * List all active schedules
     * GET /api/operations/cycle-count-schedules
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
    public ResponseEntity<List<CycleCountScheduleEntity>> listAllSchedules() {
        List<CycleCountScheduleEntity> schedules = scheduledCycleCountService.listAllSchedules();
        return ResponseEntity.ok(schedules);
    }

    /**
     * List schedules for a specific warehouse
     * GET /api/operations/cycle-count-schedules/warehouse/{warehouseId}
     */
    @GetMapping("/warehouse/{warehouseId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
    public ResponseEntity<List<CycleCountScheduleEntity>> listSchedulesByWarehouse(@PathVariable UUID warehouseId) {
        List<CycleCountScheduleEntity> schedules = scheduledCycleCountService.listSchedulesByWarehouse(warehouseId);
        return ResponseEntity.ok(schedules);
    }

    /**
     * Create a new schedule
     * POST /api/operations/cycle-count-schedules
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
    public ResponseEntity<CycleCountScheduleEntity> createSchedule(@RequestBody CreateScheduleRequest request) {
        CycleCountScheduleEntity schedule = new CycleCountScheduleEntity();
        schedule.setWarehouseId(request.warehouseId());
        schedule.setFrequency(request.frequency());
        schedule.setIntervalDays(request.intervalDays());
        schedule.setNextScheduledDate(request.nextScheduledDate());
        schedule.setLocationPattern(request.locationPattern());
        schedule.setAutoCreate(request.autoCreate() != null ? request.autoCreate() : true);
        schedule.setAutoAssignWorkers(request.autoAssignWorkers() != null ? request.autoAssignWorkers() : false);
        schedule.setActive(request.active() != null ? request.active() : true);

        CycleCountScheduleEntity created = scheduledCycleCountService.createSchedule(schedule);
        return ResponseEntity.ok(created);
    }

    /**
     * Update an existing schedule
     * PUT /api/operations/cycle-count-schedules/{id}
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
    public ResponseEntity<CycleCountScheduleEntity> updateSchedule(
            @PathVariable UUID id,
            @RequestBody UpdateScheduleRequest request) {
        
        CycleCountScheduleEntity updates = new CycleCountScheduleEntity();
        updates.setFrequency(request.frequency());
        updates.setIntervalDays(request.intervalDays());
        updates.setNextScheduledDate(request.nextScheduledDate());
        updates.setLocationPattern(request.locationPattern());
        updates.setAutoCreate(request.autoCreate());
        updates.setAutoAssignWorkers(request.autoAssignWorkers());
        updates.setActive(request.active());

        CycleCountScheduleEntity updated = scheduledCycleCountService.updateSchedule(id, updates);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete (deactivate) a schedule
     * DELETE /api/operations/cycle-count-schedules/{id}
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
    public ResponseEntity<Void> deleteSchedule(@PathVariable UUID id) {
        scheduledCycleCountService.deleteSchedule(id);
        return ResponseEntity.noContent().build();
    }

    // === DTOs ===

    public record CreateScheduleRequest(
        UUID warehouseId,
        String frequency, // quarterly, monthly, weekly, custom
        Integer intervalDays, // For custom frequency
        java.time.LocalDate nextScheduledDate,
        String locationPattern, // NULL = all locations
        Boolean autoCreate,
        Boolean autoAssignWorkers,
        Boolean active
    ) {}

    public record UpdateScheduleRequest(
        String frequency,
        Integer intervalDays,
        java.time.LocalDate nextScheduledDate,
        String locationPattern,
        Boolean autoCreate,
        Boolean autoAssignWorkers,
        Boolean active
    ) {}
}
