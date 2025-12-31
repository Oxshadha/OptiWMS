package com.optiwms.infra.dock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DockAppointmentRepository extends JpaRepository<DockAppointmentEntity, UUID> {
    List<DockAppointmentEntity> findByWarehouseId(UUID warehouseId);
    List<DockAppointmentEntity> findByWarehouseIdAndStatus(UUID warehouseId, String status);
    List<DockAppointmentEntity> findByDockDoorId(UUID dockDoorId);
    List<DockAppointmentEntity> findByAppointmentType(String appointmentType);
    List<DockAppointmentEntity> findByScheduledStartBetween(LocalDateTime start, LocalDateTime end);
    Optional<DockAppointmentEntity> findByAppointmentNumber(String appointmentNumber);
    boolean existsByAppointmentNumber(String appointmentNumber);
}

