package com.optiwms.coreapp.shipments;

import com.optiwms.domain.shipments.Shipment;
import com.optiwms.infra.shipments.ShipmentEntity;
import com.optiwms.infra.shipments.ShipmentRepository;
import org.springframework.lang.NonNull;
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
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Shipment findById(@NonNull UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));
    }

    public Shipment findByShipmentNumber(String shipmentNumber) {
        return repository.findByShipmentNumber(shipmentNumber)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + shipmentNumber));
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

        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Shipment update(@NonNull UUID id, Shipment shipment) {
        ShipmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));

        entity.setCarrier(shipment.getCarrier());
        entity.setTrackingNumber(shipment.getTrackingNumber());
        entity.setDestination(shipment.getDestination());
        entity.setWeightKg(shipment.getWeightKg());
        entity.setDriverName(shipment.getDriverName());
        entity.setDriverPhone(shipment.getDriverPhone());
        entity.setVehicleNumber(shipment.getVehicleNumber());
        entity.setStatus(shipment.getStatus());
        entity.setEta(shipment.getEta());

        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Shipment process(@NonNull UUID id) {
        ShipmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));
        entity.setStatus("shipped");
        entity.setShippedAt(LocalDateTime.now());
        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Shipment track(@NonNull UUID id, String trackingNumber) {
        ShipmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));
        entity.setTrackingNumber(trackingNumber);
        entity.setStatus("in_transit");
        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    private Shipment toDomain(ShipmentEntity entity) {
        Shipment shipment = new Shipment();
        shipment.setId(entity.getId());
        shipment.setShipmentNumber(entity.getShipmentNumber());
        shipment.setOrderId(entity.getOrderId());
        shipment.setCarrier(entity.getCarrier());
        shipment.setTrackingNumber(entity.getTrackingNumber());
        shipment.setDestination(entity.getDestination());
        shipment.setWeightKg(entity.getWeightKg());
        shipment.setDriverName(entity.getDriverName());
        shipment.setDriverPhone(entity.getDriverPhone());
        shipment.setVehicleNumber(entity.getVehicleNumber());
        shipment.setStatus(entity.getStatus());
        shipment.setEta(entity.getEta());
        shipment.setShippedAt(entity.getShippedAt());
        shipment.setDeliveredAt(entity.getDeliveredAt());
        return shipment;
    }
}

