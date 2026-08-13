package com.optiwms.coreapi.dock;

import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.coreapp.dock.DockManagementService;
import com.optiwms.domain.dock.DockAppointment;
import com.optiwms.domain.dock.DockDoor;
import com.optiwms.domain.dock.YardTrailer;
import com.optiwms.domain.notifications.Notification;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dock-management")
@ConditionalOnProperty(
        name = "optiwms.features.dock-management.enabled",
        havingValue = "true"
)
public class DockManagementController {

    private final DockManagementService service;
    private final NotificationService notificationService;

    public DockManagementController(DockManagementService service, NotificationService notificationService) {
        this.service = service;
        this.notificationService = notificationService;
    }

    // Dock Doors Endpoints
    @GetMapping("/doors")
    public ResponseEntity<List<DockDoorDto>> getAllDoors(
            @RequestParam(required = false) UUID warehouseId
    ) {
        List<DockDoor> doors = service.getAllDoors(warehouseId);
        List<DockDoorDto> dtos = doors.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/doors/{id}")
    public ResponseEntity<DockDoorDto> getDoorById(@PathVariable UUID id) {
        try {
            DockDoor door = service.getDoorById(id);
            return ResponseEntity.ok(toDto(door));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/doors")
    public ResponseEntity<DockDoorDto> createDoor(@RequestBody DockDoorDto dto) {
        try {
            DockDoor door = toDomain(dto);
            DockDoor created = service.createDoor(door);
            notifyDockEvent("Dock Door Created", "Dock door " + created.getDoorNumber() + " was created.", "/admin/dock-management/doors/" + created.getId(), "dock", created.getWarehouseId(), "{\"doorId\":\"" + created.getId() + "\",\"doorNumber\":\"" + created.getDoorNumber() + "\",\"status\":\"" + created.getStatus() + "\",\"event\":\"created\"}");
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/doors/{id}")
    public ResponseEntity<DockDoorDto> updateDoor(@PathVariable UUID id, @RequestBody DockDoorDto dto) {
        try {
            DockDoor door = toDomain(dto);
            DockDoor updated = service.updateDoor(id, door);
            notifyDockEvent("Dock Door Updated", "Dock door " + updated.getDoorNumber() + " was updated.", "/admin/dock-management/doors/" + updated.getId(), "dock", updated.getWarehouseId(), "{\"doorId\":\"" + updated.getId() + "\",\"doorNumber\":\"" + updated.getDoorNumber() + "\",\"status\":\"" + updated.getStatus() + "\",\"event\":\"updated\"}");
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Dock Appointments Endpoints
    @GetMapping("/appointments")
    public ResponseEntity<List<DockAppointmentDto>> getAllAppointments(
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String status
    ) {
        List<DockAppointment> appointments = service.getAllAppointments(warehouseId, status);
        List<DockAppointmentDto> dtos = appointments.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/appointments/{id}")
    public ResponseEntity<DockAppointmentDto> getAppointmentById(@PathVariable UUID id) {
        try {
            DockAppointment appointment = service.getAppointmentById(id);
            return ResponseEntity.ok(toDto(appointment));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/appointments")
    public ResponseEntity<DockAppointmentDto> createAppointment(@RequestBody DockAppointmentDto dto) {
        try {
            DockAppointment appointment = toDomain(dto);
            DockAppointment created = service.createAppointment(appointment);
            notifyDockEvent("Dock Appointment Created", "Dock appointment " + created.getAppointmentNumber() + " was created.", "/admin/dock-management/appointments/" + created.getId(), "dock", created.getWarehouseId(), "{\"appointmentId\":\"" + created.getId() + "\",\"appointmentNumber\":\"" + created.getAppointmentNumber() + "\",\"status\":\"" + created.getStatus() + "\",\"event\":\"created\"}");
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/appointments/{id}/check-in")
    public ResponseEntity<DockAppointmentDto> checkIn(@PathVariable UUID id) {
        try {
            DockAppointment appointment = service.checkIn(id);
            notifyDockEvent("Dock Appointment Checked In", "Dock appointment " + appointment.getAppointmentNumber() + " was checked in.", "/admin/dock-management/appointments/" + appointment.getId(), "dock", appointment.getWarehouseId(), "{\"appointmentId\":\"" + appointment.getId() + "\",\"appointmentNumber\":\"" + appointment.getAppointmentNumber() + "\",\"status\":\"" + appointment.getStatus() + "\",\"event\":\"checked_in\"}");
            return ResponseEntity.ok(toDto(appointment));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/appointments/{id}/check-out")
    public ResponseEntity<DockAppointmentDto> checkOut(@PathVariable UUID id) {
        try {
            DockAppointment appointment = service.checkOut(id);
            notifyDockEvent("Dock Appointment Checked Out", "Dock appointment " + appointment.getAppointmentNumber() + " was checked out.", "/admin/dock-management/appointments/" + appointment.getId(), "dock", appointment.getWarehouseId(), "{\"appointmentId\":\"" + appointment.getId() + "\",\"appointmentNumber\":\"" + appointment.getAppointmentNumber() + "\",\"status\":\"" + appointment.getStatus() + "\",\"event\":\"checked_out\"}");
            return ResponseEntity.ok(toDto(appointment));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Yard Trailers Endpoints
    @GetMapping("/yard-trailers")
    public ResponseEntity<List<YardTrailerDto>> getAllYardTrailers(
            @RequestParam(required = false) UUID warehouseId
    ) {
        List<YardTrailer> trailers = service.getAllYardTrailers(warehouseId);
        List<YardTrailerDto> dtos = trailers.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/yard-trailers/{id}")
    public ResponseEntity<YardTrailerDto> getYardTrailerById(@PathVariable UUID id) {
        try {
            YardTrailer trailer = service.getYardTrailerById(id);
            return ResponseEntity.ok(toDto(trailer));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/yard-trailers")
    public ResponseEntity<YardTrailerDto> createYardTrailer(@RequestBody YardTrailerDto dto) {
        try {
            YardTrailer trailer = toDomain(dto);
            YardTrailer created = service.createYardTrailer(trailer);
            notifyDockEvent("Yard Trailer Created", "Yard trailer " + created.getTrailerNumber() + " was added.", "/admin/dock-management/yard-trailers/" + created.getId(), "dock", created.getWarehouseId(), "{\"trailerId\":\"" + created.getId() + "\",\"trailerNumber\":\"" + created.getTrailerNumber() + "\",\"status\":\"" + created.getStatus() + "\",\"event\":\"created\"}");
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // Conversion methods
    private DockDoor toDomain(DockDoorDto dto) {
        DockDoor door = new DockDoor();
        door.setId(dto.id());
        door.setDoorNumber(dto.doorNumber());
        door.setWarehouseId(dto.warehouseId());
        door.setLocation(dto.location());
        door.setStatus(dto.status());
        door.setCurrentAppointmentId(dto.currentAppointmentId());
        return door;
    }

    private DockDoorDto toDto(DockDoor door) {
        return new DockDoorDto(
                door.getId(),
                door.getDoorNumber(),
                door.getWarehouseId(),
                door.getLocation(),
                door.getStatus(),
                door.getCurrentAppointmentId()
        );
    }

    private DockAppointment toDomain(DockAppointmentDto dto) {
        DockAppointment appointment = new DockAppointment();
        appointment.setId(dto.id());
        appointment.setAppointmentNumber(dto.appointmentNumber());
        appointment.setDockDoorId(dto.dockDoorId());
        appointment.setWarehouseId(dto.warehouseId());
        appointment.setAppointmentType(dto.appointmentType());
        appointment.setScheduledStart(dto.scheduledStart());
        appointment.setScheduledEnd(dto.scheduledEnd());
        appointment.setActualStart(dto.actualStart());
        appointment.setActualEnd(dto.actualEnd());
        appointment.setInboundOrderId(dto.inboundOrderId());
        appointment.setOutboundOrderId(dto.outboundOrderId());
        appointment.setSupplierId(dto.supplierId());
        appointment.setCarrierName(dto.carrierName());
        appointment.setTrailerNumber(dto.trailerNumber());
        appointment.setStatus(dto.status());
        appointment.setNotes(dto.notes());
        return appointment;
    }

    private DockAppointmentDto toDto(DockAppointment appointment) {
        return new DockAppointmentDto(
                appointment.getId(),
                appointment.getAppointmentNumber(),
                appointment.getDockDoorId(),
                appointment.getWarehouseId(),
                appointment.getAppointmentType(),
                appointment.getScheduledStart(),
                appointment.getScheduledEnd(),
                appointment.getActualStart(),
                appointment.getActualEnd(),
                appointment.getInboundOrderId(),
                appointment.getOutboundOrderId(),
                appointment.getSupplierId(),
                appointment.getCarrierName(),
                appointment.getTrailerNumber(),
                appointment.getStatus(),
                appointment.getNotes()
        );
    }

    private YardTrailer toDomain(YardTrailerDto dto) {
        YardTrailer trailer = new YardTrailer();
        trailer.setId(dto.id());
        trailer.setTrailerNumber(dto.trailerNumber());
        trailer.setWarehouseId(dto.warehouseId());
        trailer.setCarrierName(dto.carrierName());
        trailer.setInboundOrderId(dto.inboundOrderId());
        trailer.setSupplierId(dto.supplierId());
        trailer.setArrivedAt(dto.arrivedAt());
        trailer.setWaitTimeMinutes(dto.waitTimeMinutes());
        trailer.setStatus(dto.status());
        trailer.setAssignedDockDoorId(dto.assignedDockDoorId());
        return trailer;
    }

    private YardTrailerDto toDto(YardTrailer trailer) {
        return new YardTrailerDto(
                trailer.getId(),
                trailer.getTrailerNumber(),
                trailer.getWarehouseId(),
                trailer.getCarrierName(),
                trailer.getInboundOrderId(),
                trailer.getSupplierId(),
                trailer.getArrivedAt(),
                trailer.getWaitTimeMinutes(),
                trailer.getStatus(),
                trailer.getAssignedDockDoorId()
        );
    }

    // DTOs
    public record DockDoorDto(
            UUID id,
            String doorNumber,
            UUID warehouseId,
            String location,
            String status,
            UUID currentAppointmentId
    ) {}

    public record DockAppointmentDto(
            UUID id,
            String appointmentNumber,
            UUID dockDoorId,
            UUID warehouseId,
            String appointmentType,
            LocalDateTime scheduledStart,
            LocalDateTime scheduledEnd,
            LocalDateTime actualStart,
            LocalDateTime actualEnd,
            UUID inboundOrderId,
            UUID outboundOrderId,
            UUID supplierId,
            String carrierName,
            String trailerNumber,
            String status,
            String notes
    ) {}

    public record YardTrailerDto(
            UUID id,
            String trailerNumber,
            UUID warehouseId,
            String carrierName,
            UUID inboundOrderId,
            UUID supplierId,
            LocalDateTime arrivedAt,
            Integer waitTimeMinutes,
            String status,
            UUID assignedDockDoorId
    ) {}

    private void notifyDockEvent(String title, String message, String actionUrl, String type, UUID warehouseId, String metadata) {
        try {
            Notification notification = new Notification();
            notification.setUserId(null);
            notification.setAudienceRoles("admin,warehouse_manager,inbound_coordinator");
            notification.setWarehouseId(warehouseId);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setNotificationType(type);
            notification.setRead(false);
            notification.setActionUrl(actionUrl);
            notification.setMetadata(metadata);
            notification.setCreatedAt(OffsetDateTime.now());
            notificationService.create(notification);
        } catch (Exception ignored) {
            // Notifications must not block dock workflows.
        }
    }
}
