package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.coreapp.operations.ShipmentService;
import com.optiwms.domain.notifications.Notification;
import com.optiwms.domain.operations.Shipment;
import com.optiwms.infra.users.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {

    private final ShipmentService service;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public ShipmentController(ShipmentService service, UserRepository userRepository, NotificationService notificationService) {
        this.service = service;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<ShipmentDto>> listAll(
            @RequestParam(required = false) String orderId,
            @RequestParam(required = false) String status
    ) {
        List<Shipment> shipments;
        if (orderId != null) {
            shipments = service.findByOrderId(UUID.fromString(orderId));
        } else if (status != null) {
            shipments = service.findByStatus(status);
        } else {
            shipments = service.listAll();
        }

        List<ShipmentDto> shipmentDtos = shipments.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(shipmentDtos);
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedShipmentResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String orderId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);

        Page<Shipment> shipmentPage = service.findPaged(
                orderId != null && !orderId.isBlank() ? UUID.fromString(orderId) : null,
                status,
                q,
                PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy))
        );

        List<ShipmentDto> data = shipmentPage.getContent().stream()
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(new PagedShipmentResponse(
                data,
                shipmentPage.getNumber(),
                shipmentPage.getSize(),
                shipmentPage.getTotalElements(),
                shipmentPage.getTotalPages()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ShipmentDto> getById(@PathVariable UUID id) {
        Shipment shipment = service.findById(id);
        return ResponseEntity.ok(toDto(shipment));
    }

    @PostMapping
    public ResponseEntity<ShipmentDto> create(@RequestBody CreateShipmentRequest request) {
        Shipment shipment = new Shipment();
        shipment.setShipmentNumber(request.shipmentNumber());
        shipment.setOrderId(request.orderId() != null ? UUID.fromString(request.orderId()) : null);
        shipment.setCarrier(request.carrier());
        shipment.setTrackingNumber(request.trackingNumber());
        shipment.setDestination(request.destination());
        shipment.setWeightKg(parseOptionalBigDecimal(request.weightKg()));
        shipment.setDriverName(request.driverName());
        shipment.setDriverPhone(request.driverPhone());
        shipment.setVehicleNumber(request.vehicleNumber());
        shipment.setStatus(request.status() != null ? request.status() : "label_created");
        shipment.setEta(parseOptionalDate(request.eta()));

        Shipment created = service.create(shipment);
        notifyShipmentEvent("Shipment Created", "Shipment " + created.getShipmentNumber() + " was created.", created, "created");
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShipmentDto> update(@PathVariable UUID id, @RequestBody UpdateShipmentRequest request) {
        Shipment shipment = service.findById(id);
        if (request.carrier() != null) shipment.setCarrier(request.carrier());
        if (request.trackingNumber() != null) shipment.setTrackingNumber(request.trackingNumber());
        if (request.destination() != null) shipment.setDestination(request.destination());
        if (request.weightKg() != null) shipment.setWeightKg(parseOptionalBigDecimal(request.weightKg()));
        if (request.driverName() != null) shipment.setDriverName(request.driverName());
        if (request.driverPhone() != null) shipment.setDriverPhone(request.driverPhone());
        if (request.vehicleNumber() != null) shipment.setVehicleNumber(request.vehicleNumber());
        if (request.status() != null) shipment.setStatus(request.status());
        if (request.eta() != null) shipment.setEta(parseOptionalDate(request.eta()));

        Shipment updated = service.update(shipment);
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ShipmentDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody UpdateStatusRequest request,
            Authentication authentication
    ) {
        boolean managerApproval = isManagerOrAdmin(authentication);
        UUID actorUserId = request.workerId() != null && !request.workerId().isBlank()
                ? UUID.fromString(request.workerId())
                : resolveActorUserId(authentication);
        Shipment updated = service.updateStatus(id, request.status(), actorUserId, managerApproval);
        notifyShipmentEvent(
                "Shipment Status Updated",
                "Shipment " + updated.getShipmentNumber() + " moved to " + updated.getStatus() + ".",
                updated,
                "status_updated"
        );
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/confirm-delivery")
    public ResponseEntity<ShipmentDto> confirmDelivery(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        if (!isManagerOrAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        UUID actorUserId = resolveActorUserId(authentication);
        Shipment updated = service.updateStatus(id, "delivered", actorUserId, true);
        notifyShipmentEvent(
                "Shipment Delivered",
                "Shipment " + updated.getShipmentNumber() + " was confirmed delivered.",
                updated,
                "delivered"
        );
        return ResponseEntity.ok(toDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private ShipmentDto toDto(Shipment shipment) {
        return new ShipmentDto(
                shipment.getId() != null ? shipment.getId().toString() : null,
                shipment.getShipmentNumber() != null ? shipment.getShipmentNumber() : "",
                shipment.getOrderId() != null ? shipment.getOrderId().toString() : null,
                shipment.getCarrier(),
                shipment.getTrackingNumber(),
                shipment.getDestination(),
                shipment.getWeightKg() != null ? shipment.getWeightKg().toString() : null,
                shipment.getDriverName(),
                shipment.getDriverPhone(),
                shipment.getVehicleNumber(),
                shipment.getStatus() != null ? shipment.getStatus() : "label_created",
                shipment.getEta() != null ? shipment.getEta().toString() : null,
                shipment.getShippedAt() != null ? shipment.getShippedAt().toString() : null,
                shipment.getDeliveredAt() != null ? shipment.getDeliveredAt().toString() : null,
                shipment.getDeliveryConfirmedBy() != null ? shipment.getDeliveryConfirmedBy().toString() : null,
                shipment.getDeliveryConfirmedAt() != null ? shipment.getDeliveryConfirmedAt().toString() : null
        );
    }

    public record CreateShipmentRequest(
            String shipmentNumber,
            String orderId,
            String carrier,
            String trackingNumber,
            String destination,
            String weightKg,
            String driverName,
            String driverPhone,
            String vehicleNumber,
            String status,
            String eta
    ) {}

    public record UpdateShipmentRequest(
            String carrier,
            String trackingNumber,
            String destination,
            String weightKg,
            String driverName,
            String driverPhone,
            String vehicleNumber,
            String status,
            String eta
    ) {}

    public record UpdateStatusRequest(String status, String workerId) {}

    public record ShipmentDto(
            String id,
            String shipmentNumber,
            String orderId,
            String carrier,
            String trackingNumber,
            String destination,
            String weightKg,
            String driverName,
            String driverPhone,
            String vehicleNumber,
            String status,
            String eta,
            String shippedAt,
            String deliveredAt,
            String deliveryConfirmedBy,
            String deliveryConfirmedAt
    ) {}

    public record PagedShipmentResponse(
            List<ShipmentDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    private boolean isManagerOrAdmin(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String role = authority.getAuthority();
            if ("ROLE_ADMIN".equals(role) || "ROLE_WAREHOUSE_MANAGER".equals(role)) {
                return true;
            }
        }
        return false;
    }

    private UUID resolveActorUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return null;
        }
        return userRepository.findByUsername(authentication.getName())
                .map(user -> user.getId())
                .orElse(null);
    }

    private BigDecimal parseOptionalBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Invalid weightKg value");
        }
    }

    private LocalDate parseOptionalDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid eta date format. Use YYYY-MM-DD.");
        }
    }

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "createdAt";
        }
        return switch (sortBy) {
            case "createdAt", "shipmentNumber", "status", "carrier", "destination", "eta", "shippedAt", "deliveredAt" -> sortBy;
            default -> "createdAt";
        };
    }

    private void notifyShipmentEvent(String title, String message, Shipment shipment, String eventType) {
        try {
            Notification notification = new Notification();
            notification.setUserId(null);
            notification.setAudienceRoles("admin,warehouse_manager,inbound_coordinator");
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setNotificationType("shipment");
            notification.setRead(false);
            notification.setActionUrl("/admin/shipments/" + shipment.getId());
            notification.setMetadata(
                    "{\"shipmentId\":\"" + shipment.getId() + "\",\"shipmentNumber\":\"" + shipment.getShipmentNumber() + "\",\"status\":\"" + shipment.getStatus() + "\",\"event\":\"" + eventType + "\"}"
            );
            notification.setCreatedAt(OffsetDateTime.now());
            notificationService.create(notification);
        } catch (Exception ignored) {
            // Notifications must not block shipment workflows.
        }
    }
}
