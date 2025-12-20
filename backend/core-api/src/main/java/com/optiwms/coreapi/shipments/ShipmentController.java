package com.optiwms.coreapi.shipments;

import com.optiwms.coreapp.shipments.ShipmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {

    private final ShipmentService service;

    public ShipmentController(ShipmentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ShipmentDto>> list() {
        var data = service.listAll().stream()
                .map(s -> new ShipmentDto(
                        s.getId(),
                        s.getShipmentNumber(),
                        s.getOrderId(),
                        s.getCarrier(),
                        s.getTrackingNumber(),
                        s.getDestination(),
                        s.getWeightKg(),
                        s.getDriverName(),
                        s.getDriverPhone(),
                        s.getVehicleNumber(),
                        s.getStatus(),
                        s.getEta(),
                        s.getShippedAt(),
                        s.getDeliveredAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ShipmentDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var shipment = service.findById(id);
            return ResponseEntity.ok(new ShipmentDto(
                    shipment.getId(),
                    shipment.getShipmentNumber(),
                    shipment.getOrderId(),
                    shipment.getCarrier(),
                    shipment.getTrackingNumber(),
                    shipment.getDestination(),
                    shipment.getWeightKg(),
                    shipment.getDriverName(),
                    shipment.getDriverPhone(),
                    shipment.getVehicleNumber(),
                    shipment.getStatus(),
                    shipment.getEta(),
                    shipment.getShippedAt(),
                    shipment.getDeliveredAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<ShipmentDto> create(@RequestBody CreateShipmentRequest request) {
        try {
            var shipment = new com.optiwms.domain.shipments.Shipment();
            shipment.setShipmentNumber(request.shipmentNumber());
            shipment.setOrderId(request.orderId());
            shipment.setCarrier(request.carrier());
            shipment.setTrackingNumber(request.trackingNumber());
            shipment.setDestination(request.destination());
            shipment.setWeightKg(request.weightKg());
            shipment.setDriverName(request.driverName());
            shipment.setDriverPhone(request.driverPhone());
            shipment.setVehicleNumber(request.vehicleNumber());
            shipment.setStatus(request.status());
            shipment.setEta(request.eta());

            var created = service.create(shipment);
            return ResponseEntity.ok(new ShipmentDto(
                    created.getId(),
                    created.getShipmentNumber(),
                    created.getOrderId(),
                    created.getCarrier(),
                    created.getTrackingNumber(),
                    created.getDestination(),
                    created.getWeightKg(),
                    created.getDriverName(),
                    created.getDriverPhone(),
                    created.getVehicleNumber(),
                    created.getStatus(),
                    created.getEta(),
                    created.getShippedAt(),
                    created.getDeliveredAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShipmentDto> update(@PathVariable @NonNull java.util.UUID id, @RequestBody UpdateShipmentRequest request) {
        try {
            var shipment = new com.optiwms.domain.shipments.Shipment();
            shipment.setCarrier(request.carrier());
            shipment.setTrackingNumber(request.trackingNumber());
            shipment.setDestination(request.destination());
            shipment.setWeightKg(request.weightKg());
            shipment.setDriverName(request.driverName());
            shipment.setDriverPhone(request.driverPhone());
            shipment.setVehicleNumber(request.vehicleNumber());
            shipment.setStatus(request.status());
            shipment.setEta(request.eta());

            var updated = service.update(id, shipment);
            return ResponseEntity.ok(new ShipmentDto(
                    updated.getId(),
                    updated.getShipmentNumber(),
                    updated.getOrderId(),
                    updated.getCarrier(),
                    updated.getTrackingNumber(),
                    updated.getDestination(),
                    updated.getWeightKg(),
                    updated.getDriverName(),
                    updated.getDriverPhone(),
                    updated.getVehicleNumber(),
                    updated.getStatus(),
                    updated.getEta(),
                    updated.getShippedAt(),
                    updated.getDeliveredAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/process")
    public ResponseEntity<ShipmentDto> process(@PathVariable @NonNull java.util.UUID id) {
        try {
            var shipment = service.process(id);
            return ResponseEntity.ok(new ShipmentDto(
                    shipment.getId(),
                    shipment.getShipmentNumber(),
                    shipment.getOrderId(),
                    shipment.getCarrier(),
                    shipment.getTrackingNumber(),
                    shipment.getDestination(),
                    shipment.getWeightKg(),
                    shipment.getDriverName(),
                    shipment.getDriverPhone(),
                    shipment.getVehicleNumber(),
                    shipment.getStatus(),
                    shipment.getEta(),
                    shipment.getShippedAt(),
                    shipment.getDeliveredAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/track")
    public ResponseEntity<ShipmentDto> track(@PathVariable @NonNull java.util.UUID id, @RequestBody TrackShipmentRequest request) {
        try {
            var shipment = service.track(id, request.trackingNumber());
            return ResponseEntity.ok(new ShipmentDto(
                    shipment.getId(),
                    shipment.getShipmentNumber(),
                    shipment.getOrderId(),
                    shipment.getCarrier(),
                    shipment.getTrackingNumber(),
                    shipment.getDestination(),
                    shipment.getWeightKg(),
                    shipment.getDriverName(),
                    shipment.getDriverPhone(),
                    shipment.getVehicleNumber(),
                    shipment.getStatus(),
                    shipment.getEta(),
                    shipment.getShippedAt(),
                    shipment.getDeliveredAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record ShipmentDto(
            java.util.UUID id,
            String shipmentNumber,
            java.util.UUID orderId,
            String carrier,
            String trackingNumber,
            String destination,
            java.math.BigDecimal weightKg,
            String driverName,
            String driverPhone,
            String vehicleNumber,
            String status,
            java.time.LocalDate eta,
            java.time.LocalDateTime shippedAt,
            java.time.LocalDateTime deliveredAt
    ) {}

    public record CreateShipmentRequest(
            String shipmentNumber,
            java.util.UUID orderId,
            String carrier,
            String trackingNumber,
            String destination,
            java.math.BigDecimal weightKg,
            String driverName,
            String driverPhone,
            String vehicleNumber,
            String status,
            java.time.LocalDate eta
    ) {}

    public record UpdateShipmentRequest(
            String carrier,
            String trackingNumber,
            String destination,
            java.math.BigDecimal weightKg,
            String driverName,
            String driverPhone,
            String vehicleNumber,
            String status,
            java.time.LocalDate eta
    ) {}

    public record TrackShipmentRequest(String trackingNumber) {}
}

