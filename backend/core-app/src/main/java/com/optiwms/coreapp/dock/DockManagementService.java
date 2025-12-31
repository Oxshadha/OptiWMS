package com.optiwms.coreapp.dock;

import com.optiwms.domain.dock.DockAppointment;
import com.optiwms.domain.dock.DockDoor;
import com.optiwms.domain.dock.YardTrailer;
import com.optiwms.infra.dock.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DockManagementService {

    private final DockDoorRepository doorRepository;
    private final DockAppointmentRepository appointmentRepository;
    private final YardTrailerRepository trailerRepository;

    public DockManagementService(
            DockDoorRepository doorRepository,
            DockAppointmentRepository appointmentRepository,
            YardTrailerRepository trailerRepository) {
        this.doorRepository = doorRepository;
        this.appointmentRepository = appointmentRepository;
        this.trailerRepository = trailerRepository;
    }

    // Dock Doors
    public List<DockDoor> getAllDoors(UUID warehouseId) {
        if (warehouseId != null) {
            return doorRepository.findByWarehouseId(warehouseId).stream()
                    .map(this::toDomain)
                    .collect(Collectors.toList());
        }
        return doorRepository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<DockDoor> getDoorsByStatus(UUID warehouseId, String status) {
        return doorRepository.findByWarehouseIdAndStatus(warehouseId, status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public DockDoor getDoorById(UUID id) {
        return doorRepository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Dock door not found: " + id));
    }

    @Transactional
    public DockDoor createDoor(DockDoor door) {
        if (doorRepository.existsByWarehouseIdAndDoorNumber(door.getWarehouseId(), door.getDoorNumber())) {
            throw new RuntimeException("Dock door already exists: " + door.getDoorNumber() + " in warehouse " + door.getWarehouseId());
        }

        DockDoorEntity entity = new DockDoorEntity();
        entity.setDoorNumber(door.getDoorNumber());
        entity.setWarehouseId(door.getWarehouseId());
        entity.setLocation(door.getLocation());
        entity.setStatus(door.getStatus() != null ? door.getStatus() : "available");

        DockDoorEntity saved = doorRepository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public DockDoor updateDoor(UUID id, DockDoor door) {
        DockDoorEntity entity = doorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Dock door not found: " + id));

        // Check if door number is being changed and if it conflicts
        if (!entity.getDoorNumber().equals(door.getDoorNumber())) {
            if (doorRepository.existsByWarehouseIdAndDoorNumber(door.getWarehouseId(), door.getDoorNumber())) {
                throw new RuntimeException("Dock door already exists: " + door.getDoorNumber());
            }
        }

        entity.setDoorNumber(door.getDoorNumber());
        entity.setLocation(door.getLocation());
        entity.setStatus(door.getStatus());
        entity.setCurrentAppointmentId(door.getCurrentAppointmentId());

        DockDoorEntity saved = doorRepository.save(entity);
        return toDomain(saved);
    }

    // Dock Appointments
    public List<DockAppointment> getAllAppointments(UUID warehouseId, String status) {
        if (warehouseId != null && status != null) {
            return appointmentRepository.findByWarehouseIdAndStatus(warehouseId, status).stream()
                    .map(this::toDomain)
                    .collect(Collectors.toList());
        } else if (warehouseId != null) {
            return appointmentRepository.findByWarehouseId(warehouseId).stream()
                    .map(this::toDomain)
                    .collect(Collectors.toList());
        }
        return appointmentRepository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public DockAppointment getAppointmentById(UUID id) {
        return appointmentRepository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Dock appointment not found: " + id));
    }

    @Transactional
    public DockAppointment createAppointment(DockAppointment appointment) {
        if (appointmentRepository.existsByAppointmentNumber(appointment.getAppointmentNumber())) {
            throw new RuntimeException("Appointment number already exists: " + appointment.getAppointmentNumber());
        }

        DockAppointmentEntity entity = new DockAppointmentEntity();
        entity.setAppointmentNumber(appointment.getAppointmentNumber());
        entity.setDockDoorId(appointment.getDockDoorId());
        entity.setWarehouseId(appointment.getWarehouseId());
        entity.setAppointmentType(appointment.getAppointmentType());
        entity.setScheduledStart(appointment.getScheduledStart());
        entity.setScheduledEnd(appointment.getScheduledEnd());
        entity.setInboundOrderId(appointment.getInboundOrderId());
        entity.setOutboundOrderId(appointment.getOutboundOrderId());
        entity.setSupplierId(appointment.getSupplierId());
        entity.setCarrierName(appointment.getCarrierName());
        entity.setTrailerNumber(appointment.getTrailerNumber());
        entity.setStatus(appointment.getStatus() != null ? appointment.getStatus() : "scheduled");
        entity.setNotes(appointment.getNotes());

        DockAppointmentEntity saved = appointmentRepository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public DockAppointment checkIn(UUID id) {
        DockAppointmentEntity entity = appointmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Dock appointment not found: " + id));
        entity.setStatus("checked_in");
        entity.setActualStart(LocalDateTime.now());
        DockAppointmentEntity saved = appointmentRepository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public DockAppointment checkOut(UUID id) {
        DockAppointmentEntity entity = appointmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Dock appointment not found: " + id));
        entity.setStatus("completed");
        entity.setActualEnd(LocalDateTime.now());
        DockAppointmentEntity saved = appointmentRepository.save(entity);
        return toDomain(saved);
    }

    // Yard Trailers
    public List<YardTrailer> getAllYardTrailers(UUID warehouseId) {
        if (warehouseId != null) {
            return trailerRepository.findByWarehouseId(warehouseId).stream()
                    .map(this::toDomain)
                    .collect(Collectors.toList());
        }
        return trailerRepository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<YardTrailer> getYardTrailersByStatus(UUID warehouseId, String status) {
        return trailerRepository.findByWarehouseIdAndStatus(warehouseId, status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public YardTrailer getYardTrailerById(UUID id) {
        return trailerRepository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Yard trailer not found: " + id));
    }

    @Transactional
    public YardTrailer createYardTrailer(YardTrailer trailer) {
        if (trailerRepository.existsByTrailerNumber(trailer.getTrailerNumber())) {
            throw new RuntimeException("Trailer number already exists: " + trailer.getTrailerNumber());
        }

        YardTrailerEntity entity = new YardTrailerEntity();
        entity.setTrailerNumber(trailer.getTrailerNumber());
        entity.setWarehouseId(trailer.getWarehouseId());
        entity.setCarrierName(trailer.getCarrierName());
        entity.setInboundOrderId(trailer.getInboundOrderId());
        entity.setSupplierId(trailer.getSupplierId());
        entity.setArrivedAt(trailer.getArrivedAt() != null ? trailer.getArrivedAt() : LocalDateTime.now());
        entity.setStatus(trailer.getStatus() != null ? trailer.getStatus() : "waiting");
        entity.setAssignedDockDoorId(trailer.getAssignedDockDoorId());

        YardTrailerEntity saved = trailerRepository.save(entity);
        return toDomain(saved);
    }

    // Conversion methods
    private DockDoor toDomain(DockDoorEntity entity) {
        DockDoor door = new DockDoor();
        door.setId(entity.getId());
        door.setDoorNumber(entity.getDoorNumber());
        door.setWarehouseId(entity.getWarehouseId());
        door.setLocation(entity.getLocation());
        door.setStatus(entity.getStatus());
        door.setCurrentAppointmentId(entity.getCurrentAppointmentId());
        return door;
    }

    private DockAppointment toDomain(DockAppointmentEntity entity) {
        DockAppointment appointment = new DockAppointment();
        appointment.setId(entity.getId());
        appointment.setAppointmentNumber(entity.getAppointmentNumber());
        appointment.setDockDoorId(entity.getDockDoorId());
        appointment.setWarehouseId(entity.getWarehouseId());
        appointment.setAppointmentType(entity.getAppointmentType());
        appointment.setScheduledStart(entity.getScheduledStart());
        appointment.setScheduledEnd(entity.getScheduledEnd());
        appointment.setActualStart(entity.getActualStart());
        appointment.setActualEnd(entity.getActualEnd());
        appointment.setInboundOrderId(entity.getInboundOrderId());
        appointment.setOutboundOrderId(entity.getOutboundOrderId());
        appointment.setSupplierId(entity.getSupplierId());
        appointment.setCarrierName(entity.getCarrierName());
        appointment.setTrailerNumber(entity.getTrailerNumber());
        appointment.setStatus(entity.getStatus());
        appointment.setNotes(entity.getNotes());
        return appointment;
    }

    private YardTrailer toDomain(YardTrailerEntity entity) {
        YardTrailer trailer = new YardTrailer();
        trailer.setId(entity.getId());
        trailer.setTrailerNumber(entity.getTrailerNumber());
        trailer.setWarehouseId(entity.getWarehouseId());
        trailer.setCarrierName(entity.getCarrierName());
        trailer.setInboundOrderId(entity.getInboundOrderId());
        trailer.setSupplierId(entity.getSupplierId());
        trailer.setArrivedAt(entity.getArrivedAt());
        trailer.setWaitTimeMinutes(entity.getWaitTimeMinutes());
        trailer.setStatus(entity.getStatus());
        trailer.setAssignedDockDoorId(entity.getAssignedDockDoorId());
        return trailer;
    }
}

