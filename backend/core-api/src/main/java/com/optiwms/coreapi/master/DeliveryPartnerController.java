package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.DeliveryPartnerService;
import com.optiwms.domain.master.DeliveryPartner;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/delivery-partners")
public class DeliveryPartnerController {

    private final DeliveryPartnerService service;

    public DeliveryPartnerController(DeliveryPartnerService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<DeliveryPartnerDto>> listAll(
            @RequestParam(required = false) String status
    ) {
        List<DeliveryPartner> partners;
        if (status != null) {
            partners = service.findByStatus(status);
        } else {
            partners = service.listAll();
        }

        List<DeliveryPartnerDto> dtos = partners.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DeliveryPartnerDto> getById(@PathVariable UUID id) {
        try {
            DeliveryPartner partner = service.findById(id);
            return ResponseEntity.ok(toDto(partner));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/code/{partnerCode}")
    public ResponseEntity<DeliveryPartnerDto> getByPartnerCode(@PathVariable String partnerCode) {
        try {
            DeliveryPartner partner = service.findByPartnerCode(partnerCode);
            return ResponseEntity.ok(toDto(partner));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<DeliveryPartnerDto> create(@RequestBody CreateDeliveryPartnerRequest request) {
        try {
            DeliveryPartner partner = new DeliveryPartner();
            partner.setPartnerCode(request.partnerCode());
            partner.setCompanyName(request.companyName());
            partner.setContactPerson(request.contactPerson());
            partner.setEmail(request.email());
            partner.setPhone(request.phone());
            partner.setAddress(request.address());
            partner.setCity(request.city());
            partner.setCountry(request.country());
            partner.setServiceAreas(request.serviceAreas());
            partner.setRating(request.rating() != null ? new BigDecimal(request.rating()) : null);
            partner.setCostPerDelivery(request.costPerDelivery() != null ? new BigDecimal(request.costPerDelivery()) : null);
            partner.setStatus(request.status() != null ? request.status() : "active");
            partner.setTotalShipments(request.totalShipments() != null ? request.totalShipments() : 0);
            partner.setOnTimeDeliveryRate(request.onTimeDeliveryRate() != null ? new BigDecimal(request.onTimeDeliveryRate()) : null);

            DeliveryPartner created = service.create(partner);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<DeliveryPartnerDto> update(@PathVariable UUID id, @RequestBody UpdateDeliveryPartnerRequest request) {
        try {
            DeliveryPartner partner = service.findById(id);
            if (request.companyName() != null) partner.setCompanyName(request.companyName());
            if (request.contactPerson() != null) partner.setContactPerson(request.contactPerson());
            if (request.email() != null) partner.setEmail(request.email());
            if (request.phone() != null) partner.setPhone(request.phone());
            if (request.address() != null) partner.setAddress(request.address());
            if (request.city() != null) partner.setCity(request.city());
            if (request.country() != null) partner.setCountry(request.country());
            if (request.serviceAreas() != null) partner.setServiceAreas(request.serviceAreas());
            if (request.rating() != null) partner.setRating(new BigDecimal(request.rating()));
            if (request.costPerDelivery() != null) partner.setCostPerDelivery(new BigDecimal(request.costPerDelivery()));
            if (request.status() != null) partner.setStatus(request.status());
            if (request.totalShipments() != null) partner.setTotalShipments(request.totalShipments());
            if (request.onTimeDeliveryRate() != null) partner.setOnTimeDeliveryRate(new BigDecimal(request.onTimeDeliveryRate()));

            DeliveryPartner updated = service.update(partner);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            service.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private DeliveryPartnerDto toDto(DeliveryPartner partner) {
        return new DeliveryPartnerDto(
                partner.getId().toString(),
                partner.getPartnerCode(),
                partner.getCompanyName(),
                partner.getContactPerson(),
                partner.getEmail(),
                partner.getPhone(),
                partner.getAddress(),
                partner.getCity(),
                partner.getCountry(),
                partner.getServiceAreas(),
                partner.getRating() != null ? partner.getRating().toString() : null,
                partner.getCostPerDelivery() != null ? partner.getCostPerDelivery().toString() : null,
                partner.getStatus(),
                partner.getTotalShipments(),
                partner.getOnTimeDeliveryRate() != null ? partner.getOnTimeDeliveryRate().toString() : null
        );
    }

    public record CreateDeliveryPartnerRequest(
            String partnerCode,
            String companyName,
            String contactPerson,
            String email,
            String phone,
            String address,
            String city,
            String country,
            String serviceAreas,
            String rating,
            String costPerDelivery,
            String status,
            Integer totalShipments,
            String onTimeDeliveryRate
    ) {}

    public record UpdateDeliveryPartnerRequest(
            String companyName,
            String contactPerson,
            String email,
            String phone,
            String address,
            String city,
            String country,
            String serviceAreas,
            String rating,
            String costPerDelivery,
            String status,
            Integer totalShipments,
            String onTimeDeliveryRate
    ) {}

    public record DeliveryPartnerDto(
            String id,
            String partnerCode,
            String companyName,
            String contactPerson,
            String email,
            String phone,
            String address,
            String city,
            String country,
            String serviceAreas,
            String rating,
            String costPerDelivery,
            String status,
            Integer totalShipments,
            String onTimeDeliveryRate
    ) {}
}

