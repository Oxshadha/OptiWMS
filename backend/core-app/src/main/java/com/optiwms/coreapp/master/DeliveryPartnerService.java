package com.optiwms.coreapp.master;

import com.optiwms.domain.master.DeliveryPartner;
import com.optiwms.infra.master.DeliveryPartnerEntity;
import com.optiwms.infra.master.DeliveryPartnerRepository;
import com.optiwms.infra.operations.ShipmentEntity;
import com.optiwms.infra.operations.ShipmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.HashSet;
import java.util.stream.Collectors;

@Service
public class DeliveryPartnerService {

    private final DeliveryPartnerRepository repository;
    private final ShipmentRepository shipmentRepository;

    public DeliveryPartnerService(DeliveryPartnerRepository repository, ShipmentRepository shipmentRepository) {
        this.repository = repository;
        this.shipmentRepository = shipmentRepository;
    }

    public List<DeliveryPartner> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<DeliveryPartner> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public DeliveryPartner findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Delivery partner not found: " + id));
    }

    public DeliveryPartner findByPartnerCode(String partnerCode) {
        return repository.findByPartnerCode(partnerCode)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Delivery partner not found: " + partnerCode));
    }

    @Transactional
    public DeliveryPartner create(DeliveryPartner partner) {
        if (repository.findByPartnerCode(partner.getPartnerCode()).isPresent()) {
            throw new RuntimeException("Partner code already exists: " + partner.getPartnerCode());
        }

        DeliveryPartnerEntity entity = new DeliveryPartnerEntity();
        entity.setPartnerCode(partner.getPartnerCode());
        entity.setCompanyName(partner.getCompanyName());
        entity.setContactPerson(partner.getContactPerson());
        entity.setEmail(partner.getEmail());
        entity.setPhone(partner.getPhone());
        entity.setAddress(partner.getAddress());
        entity.setCity(partner.getCity());
        entity.setCountry(partner.getCountry());
        entity.setCurrencyCode(partner.getCurrencyCode());
        entity.setServiceAreas(partner.getServiceAreas());
        entity.setRating(partner.getRating());
        entity.setCostPerDelivery(partner.getCostPerDelivery());
        entity.setStatus(partner.getStatus() != null ? partner.getStatus() : "active");
        entity.setTotalShipments(partner.getTotalShipments() != null ? partner.getTotalShipments() : 0);
        entity.setOnTimeDeliveryRate(partner.getOnTimeDeliveryRate());

        DeliveryPartnerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public DeliveryPartner update(DeliveryPartner partner) {
        DeliveryPartnerEntity entity = repository.findById(partner.getId())
                .orElseThrow(() -> new RuntimeException("Delivery partner not found: " + partner.getId()));

        if (partner.getCompanyName() != null) entity.setCompanyName(partner.getCompanyName());
        if (partner.getContactPerson() != null) entity.setContactPerson(partner.getContactPerson());
        if (partner.getEmail() != null) entity.setEmail(partner.getEmail());
        if (partner.getPhone() != null) entity.setPhone(partner.getPhone());
        if (partner.getAddress() != null) entity.setAddress(partner.getAddress());
        if (partner.getCity() != null) entity.setCity(partner.getCity());
        if (partner.getCountry() != null) entity.setCountry(partner.getCountry());
        if (partner.getCurrencyCode() != null) entity.setCurrencyCode(partner.getCurrencyCode());
        if (partner.getServiceAreas() != null) entity.setServiceAreas(partner.getServiceAreas());
        if (partner.getRating() != null) entity.setRating(partner.getRating());
        if (partner.getCostPerDelivery() != null) entity.setCostPerDelivery(partner.getCostPerDelivery());
        if (partner.getStatus() != null) entity.setStatus(partner.getStatus());
        if (partner.getTotalShipments() != null) entity.setTotalShipments(partner.getTotalShipments());
        if (partner.getOnTimeDeliveryRate() != null) entity.setOnTimeDeliveryRate(partner.getOnTimeDeliveryRate());

        DeliveryPartnerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    public DeliveryPartnerMetrics getMetrics(UUID partnerId) {
        DeliveryPartner partner = findById(partnerId);

        Set<UUID> uniqueShipmentIds = new HashSet<>();
        List<ShipmentEntity> matchedShipments = new java.util.ArrayList<>();

        if (partner.getCompanyName() != null && !partner.getCompanyName().isBlank()) {
            shipmentRepository.findByCarrierIgnoreCase(partner.getCompanyName())
                    .forEach(shipment -> {
                        if (uniqueShipmentIds.add(shipment.getId())) {
                            matchedShipments.add(shipment);
                        }
                    });
        }

        if (partner.getPartnerCode() != null && !partner.getPartnerCode().isBlank()) {
            shipmentRepository.findByCarrierIgnoreCase(partner.getPartnerCode())
                    .forEach(shipment -> {
                        if (uniqueShipmentIds.add(shipment.getId())) {
                            matchedShipments.add(shipment);
                        }
                    });
        }

        int totalShipments = !matchedShipments.isEmpty()
                ? matchedShipments.size()
                : (partner.getTotalShipments() != null ? partner.getTotalShipments() : 0);

        long deliveredShipments = matchedShipments.stream()
                .filter(s -> "delivered".equalsIgnoreCase(s.getStatus()))
                .count();

        long onTimeDelivered = matchedShipments.stream()
                .filter(s -> "delivered".equalsIgnoreCase(s.getStatus()))
                .filter(s -> s.getDeliveredAt() != null && s.getEta() != null)
                .filter(s -> !s.getDeliveredAt().toLocalDate().isAfter(s.getEta()))
                .count();

        double computedOnTimeRate = deliveredShipments > 0
                ? (onTimeDelivered * 100.0 / deliveredShipments)
                : (partner.getOnTimeDeliveryRate() != null ? partner.getOnTimeDeliveryRate().doubleValue() : 0.0);

        double averageCost = partner.getCostPerDelivery() != null
                ? partner.getCostPerDelivery().doubleValue()
                : 0.0;

        return new DeliveryPartnerMetrics(
                partner.getId(),
                partner.getPartnerCode(),
                partner.getCompanyName(),
                totalShipments,
                (int) deliveredShipments,
                Math.round(computedOnTimeRate * 100.0) / 100.0,
                averageCost,
                partner.getCurrencyCode(),
                LocalDate.now().toString()
        );
    }

    public record DeliveryPartnerMetrics(
            UUID partnerId,
            String partnerCode,
            String companyName,
            Integer totalShipments,
            Integer deliveredShipments,
            Double onTimeDeliveryRate,
            Double averageCostPerDelivery,
            String currencyCode,
            String generatedAt
    ) {}

    private DeliveryPartner toDomain(DeliveryPartnerEntity entity) {
        DeliveryPartner p = new DeliveryPartner();
        p.setId(entity.getId());
        p.setPartnerCode(entity.getPartnerCode());
        p.setCompanyName(entity.getCompanyName());
        p.setContactPerson(entity.getContactPerson());
        p.setEmail(entity.getEmail());
        p.setPhone(entity.getPhone());
        p.setAddress(entity.getAddress());
        p.setCity(entity.getCity());
        p.setCountry(entity.getCountry());
        p.setCurrencyCode(entity.getCurrencyCode());
        p.setServiceAreas(entity.getServiceAreas());
        p.setRating(entity.getRating());
        p.setCostPerDelivery(entity.getCostPerDelivery());
        p.setStatus(entity.getStatus());
        p.setTotalShipments(entity.getTotalShipments());
        p.setOnTimeDeliveryRate(entity.getOnTimeDeliveryRate());
        p.setCreatedAt(entity.getCreatedAt());
        p.setUpdatedAt(entity.getUpdatedAt());
        return p;
    }
}
