package com.optiwms.infra.cyclecount;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface CycleCountScheduleRepository extends JpaRepository<CycleCountScheduleEntity, UUID> {
    
    /**
     * Find all active schedules that are due (next_scheduled_date <= today) and auto_create enabled
     */
    List<CycleCountScheduleEntity> findByNextScheduledDateLessThanEqualAndAutoCreateTrueAndActiveTrue(LocalDate date);
    
    /**
     * Find all schedules for a specific warehouse
     */
    List<CycleCountScheduleEntity> findByWarehouseIdOrderByNextScheduledDateAsc(UUID warehouseId);
    
    /**
     * Find all active schedules
     */
    List<CycleCountScheduleEntity> findByActiveTrueOrderByNextScheduledDateAsc();
}
