package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.ShipmentService;
import com.optiwms.domain.operations.Shipment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {

    private final ShipmentService service;

    public ShipmentController(ShipmentService service) {
        this.service = service;
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
        shipment.setWeightKg(request.weightKg() != null ? new BigDecimal(request.weightKg()) : null);
        shipment.setDriverName(request.driverName());
        shipment.setDriverPhone(request.driverPhone());
        shipment.setVehicleNumber(request.vehicleNumber());
        shipment.setStatus(request.status() != null ? request.status() : "label_created");
        if (request.eta() != null && !request.eta().isEmpty()) {
            shipment.setEta(LocalDate.parse(request.eta()));
        }

        Shipment created = service.create(shipment);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShipmentDto> update(@PathVariable UUID id, @RequestBody UpdateShipmentRequest request) {
        Shipment shipment = service.findById(id);
        if (request.carrier() != null) shipment.setCarrier(request.carrier());
        if (request.trackingNumber() != null) shipment.setTrackingNumber(request.trackingNumber());
        if (request.destination() != null) shipment.setDestination(request.destination());
        if (request.weightKg() != null) shipment.setWeightKg(new BigDecimal(request.weightKg()));
        if (request.driverName() != null) shipment.setDriverName(request.driverName());
        if (request.driverPhone() != null) shipment.setDriverPhone(request.driverPhone());
        if (request.vehicleNumber() != null) shipment.setVehicleNumber(request.vehicleNumber());
        if (request.status() != null) shipment.setStatus(request.status());
        if (request.eta() != null && !request.eta().isEmpty()) {
            shipment.setEta(LocalDate.parse(request.eta()));
        }

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
        Shipment updated = service.updateStatus(id, request.status(), null, managerApproval);
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
        Shipment updated = service.updateStatus(id, "delivered", null, true);
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
                shipment.getDeliveredAt() != null ? shipment.getDeliveredAt().toString() : null
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

    public record UpdateStatusRequest(String status) {}

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
            String deliveredAt
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
}
