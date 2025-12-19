package com.optiwms.coreapp.operations;

import com.optiwms.domain.operations.Shipment;
import com.optiwms.infra.operations.ShipmentEntity;
import com.optiwms.infra.operations.ShipmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ShipmentService {

    private final ShipmentRepository repository;

    public ShipmentService(ShipmentRepository repository) {
        this.repository = repository;
    }

    public List<Shipment> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Shipment> findByOrderId(UUID orderId) {
        return repository.findByOrderId(orderId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Shipment> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Shipment findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));
    }

    @Transactional
    public Shipment create(Shipment shipment) {
        if (repository.findByShipmentNumber(shipment.getShipmentNumber()).isPresent()) {
            throw new RuntimeException("Shipment number already exists: " + shipment.getShipmentNumber());
        }

        ShipmentEntity entity = new ShipmentEntity();
        entity.setShipmentNumber(shipment.getShipmentNumber());
        entity.setOrderId(shipment.getOrderId());
        entity.setCarrier(shipment.getCarrier());
        entity.setTrackingNumber(shipment.getTrackingNumber());
        entity.setDestination(shipment.getDestination());
        entity.setWeightKg(shipment.getWeightKg());
        entity.setDriverName(shipment.getDriverName());
        entity.setDriverPhone(shipment.getDriverPhone());
        entity.setVehicleNumber(shipment.getVehicleNumber());
        entity.setStatus(shipment.getStatus() != null ? shipment.getStatus() : "label_created");
        entity.setEta(shipment.getEta());
        entity.setShippedAt(shipment.getShippedAt());
        entity.setDeliveredAt(shipment.getDeliveredAt());

        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Shipment updateStatus(UUID id, String status) {
        ShipmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));
        entity.setStatus(status);
        if ("shipped".equals(status) && entity.getShippedAt() == null) {
            entity.setShippedAt(LocalDateTime.now());
        } else if ("delivered".equals(status) && entity.getDeliveredAt() == null) {
            entity.setDeliveredAt(LocalDateTime.now());
        }
        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Shipment update(Shipment shipment) {
        ShipmentEntity entity = repository.findById(shipment.getId())
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + shipment.getId()));

        entity.setCarrier(shipment.getCarrier());
        entity.setTrackingNumber(shipment.getTrackingNumber());
        entity.setDestination(shipment.getDestination());
        entity.setWeightKg(shipment.getWeightKg());
        entity.setDriverName(shipment.getDriverName());
        entity.setDriverPhone(shipment.getDriverPhone());
        entity.setVehicleNumber(shipment.getVehicleNumber());
        entity.setEta(shipment.getEta());
        if (shipment.getStatus() != null) {
            entity.setStatus(shipment.getStatus());
        }

        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private Shipment toDomain(ShipmentEntity entity) {
        Shipment s = new Shipment();
        s.setId(entity.getId());
        s.setShipmentNumber(entity.getShipmentNumber());
        s.setOrderId(entity.getOrderId());
        s.setCarrier(entity.getCarrier());
        s.setTrackingNumber(entity.getTrackingNumber());
        s.setDestination(entity.getDestination());
        s.setWeightKg(entity.getWeightKg());
        s.setDriverName(entity.getDriverName());
        s.setDriverPhone(entity.getDriverPhone());
        s.setVehicleNumber(entity.getVehicleNumber());
        s.setStatus(entity.getStatus());
        s.setEta(entity.getEta());
        s.setShippedAt(entity.getShippedAt());
        s.setDeliveredAt(entity.getDeliveredAt());
        s.setCreatedAt(entity.getCreatedAt());
        return s;
    }
}

