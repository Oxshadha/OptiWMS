package com.optiwms.coreapp.master;

import com.optiwms.domain.master.DeliveryPartner;
import com.optiwms.infra.master.DeliveryPartnerEntity;
import com.optiwms.infra.master.DeliveryPartnerRepository;
import com.optiwms.infra.shipments.ShipmentEntity;
import com.optiwms.infra.shipments.ShipmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
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
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public DeliveryPartner findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Delivery partner not found: " + id));
    }

    public List<ShipmentEntity> getShipments(UUID id) {
        // Get shipments by carrier name - this is a simplified approach
        // In a real system, you'd have a carrier_id field in shipments
        DeliveryPartnerEntity partner = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Delivery partner not found: " + id));
        return shipmentRepository.findAll().stream()
                .filter(s -> partner.getName().equals(s.getCarrier()))
                .collect(Collectors.toList());
    }

    @Transactional
    public DeliveryPartner create(DeliveryPartner partner) {
        if (partner.getCode() != null && repository.existsByCode(partner.getCode())) {
            throw new RuntimeException("Delivery partner code already exists: " + partner.getCode());
        }

        DeliveryPartnerEntity entity = new DeliveryPartnerEntity();
        entity.setCode(partner.getCode());
        entity.setName(partner.getName());
        entity.setContactPerson(partner.getContactPerson());
        entity.setEmail(partner.getEmail());
        entity.setPhone(partner.getPhone());
        entity.setAddress(partner.getAddress());
        entity.setCountry(partner.getCountry());
        entity.setServiceType(partner.getServiceType());
        entity.setStatus(partner.getStatus() != null ? partner.getStatus() : "active");

        DeliveryPartnerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public DeliveryPartner update(UUID id, DeliveryPartner partner) {
        DeliveryPartnerEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Delivery partner not found: " + id));

        if (partner.getCode() != null && !entity.getCode().equals(partner.getCode())) {
            if (repository.existsByCode(partner.getCode())) {
                throw new RuntimeException("Delivery partner code already exists: " + partner.getCode());
            }
        }

        entity.setCode(partner.getCode());
        entity.setName(partner.getName());
        entity.setContactPerson(partner.getContactPerson());
        entity.setEmail(partner.getEmail());
        entity.setPhone(partner.getPhone());
        entity.setAddress(partner.getAddress());
        entity.setCountry(partner.getCountry());
        entity.setServiceType(partner.getServiceType());
        entity.setStatus(partner.getStatus());

        DeliveryPartnerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Delivery partner not found: " + id);
        }
        repository.deleteById(id);
    }

    private DeliveryPartner toDomain(DeliveryPartnerEntity entity) {
        DeliveryPartner partner = new DeliveryPartner();
        partner.setId(entity.getId());
        partner.setCode(entity.getCode());
        partner.setName(entity.getName());
        partner.setContactPerson(entity.getContactPerson());
        partner.setEmail(entity.getEmail());
        partner.setPhone(entity.getPhone());
        partner.setAddress(entity.getAddress());
        partner.setCountry(entity.getCountry());
        partner.setServiceType(entity.getServiceType());
        partner.setStatus(entity.getStatus());
        return partner;
    }
}

