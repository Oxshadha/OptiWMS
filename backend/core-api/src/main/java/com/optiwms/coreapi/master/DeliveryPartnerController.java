package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.DeliveryPartnerService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/delivery-partners")
public class DeliveryPartnerController {

    private final DeliveryPartnerService service;

    public DeliveryPartnerController(DeliveryPartnerService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<DeliveryPartnerDto>> list() {
        var data = service.listAll().stream()
                .map(d -> new DeliveryPartnerDto(
                        d.getId(),
                        d.getCode(),
                        d.getName(),
                        d.getContactPerson(),
                        d.getEmail(),
                        d.getPhone(),
                        d.getAddress(),
                        d.getCountry(),
                        d.getServiceType(),
                        d.getStatus()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DeliveryPartnerDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var partner = service.findById(id);
            return ResponseEntity.ok(new DeliveryPartnerDto(
                    partner.getId(),
                    partner.getCode(),
                    partner.getName(),
                    partner.getContactPerson(),
                    partner.getEmail(),
                    partner.getPhone(),
                    partner.getAddress(),
                    partner.getCountry(),
                    partner.getServiceType(),
                    partner.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/shipments")
    public ResponseEntity<List<ShipmentDto>> getShipments(@PathVariable @NonNull java.util.UUID id) {
        try {
            var shipments = service.getShipments(id);
            var data = shipments.stream()
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
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/metrics")
    public ResponseEntity<Object> getMetrics(@PathVariable @NonNull java.util.UUID id) {
        try {
            // Placeholder for metrics
            return ResponseEntity.ok(new Object() {});
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<DeliveryPartnerDto> create(@RequestBody CreateDeliveryPartnerRequest request) {
        try {
            var partner = new com.optiwms.domain.master.DeliveryPartner();
            partner.setCode(request.code());
            partner.setName(request.name());
            partner.setContactPerson(request.contactPerson());
            partner.setEmail(request.email());
            partner.setPhone(request.phone());
            partner.setAddress(request.address());
            partner.setCountry(request.country());
            partner.setServiceType(request.serviceType());
            partner.setStatus(request.status());

            var created = service.create(partner);
            return ResponseEntity.ok(new DeliveryPartnerDto(
                    created.getId(),
                    created.getCode(),
                    created.getName(),
                    created.getContactPerson(),
                    created.getEmail(),
                    created.getPhone(),
                    created.getAddress(),
                    created.getCountry(),
                    created.getServiceType(),
                    created.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<DeliveryPartnerDto> update(@PathVariable @NonNull java.util.UUID id, @RequestBody UpdateDeliveryPartnerRequest request) {
        try {
            var partner = new com.optiwms.domain.master.DeliveryPartner();
            partner.setCode(request.code());
            partner.setName(request.name());
            partner.setContactPerson(request.contactPerson());
            partner.setEmail(request.email());
            partner.setPhone(request.phone());
            partner.setAddress(request.address());
            partner.setCountry(request.country());
            partner.setServiceType(request.serviceType());
            partner.setStatus(request.status());

            var updated = service.update(id, partner);
            return ResponseEntity.ok(new DeliveryPartnerDto(
                    updated.getId(),
                    updated.getCode(),
                    updated.getName(),
                    updated.getContactPerson(),
                    updated.getEmail(),
                    updated.getPhone(),
                    updated.getAddress(),
                    updated.getCountry(),
                    updated.getServiceType(),
                    updated.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable @NonNull java.util.UUID id) {
        try {
            service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    public record DeliveryPartnerDto(
            java.util.UUID id,
            String code,
            String name,
            String contactPerson,
            String email,
            String phone,
            String address,
            String country,
            String serviceType,
            String status
    ) {}

    public record CreateDeliveryPartnerRequest(
            String code,
            String name,
            String contactPerson,
            String email,
            String phone,
            String address,
            String country,
            String serviceType,
            String status
    ) {}

    public record UpdateDeliveryPartnerRequest(
            String code,
            String name,
            String contactPerson,
            String email,
            String phone,
            String address,
            String country,
            String serviceType,
            String status
    ) {}

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
}

