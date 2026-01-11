package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
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
    private final OrderService orderService;

    public ShipmentService(ShipmentRepository repository, OrderService orderService) {
        this.repository = repository;
        this.orderService = orderService;
    }

    public List<Shipment> listAll() {
        try {
            return repository.findAll().stream()
                    .map(this::toDomain)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            System.err.println("Error in ShipmentService.listAll: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to list shipments: " + e.getMessage(), e);
        }
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
    public Shipment updateStatus(UUID id, String status, UUID workerId) {
        ShipmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));
        entity.setStatus(status);
        if ("shipped".equals(status) && entity.getShippedAt() == null) {
            entity.setShippedAt(LocalDateTime.now());
            
            // Update order status to "shipped" when shipment status is "shipped"
            if (entity.getOrderId() != null) {
                try {
                    orderService.updateStatus(entity.getOrderId(), "shipped");
                    // Store worker record
                    if (workerId != null) {
                        orderService.updateWorkerRecord(entity.getOrderId(), workerId, "shipped");
                    }
                } catch (RuntimeException e) {
                    // Log but don't fail shipment update
                }
            }
        } else if ("delivered".equals(status) && entity.getDeliveredAt() == null) {
            entity.setDeliveredAt(LocalDateTime.now());
            
            // Update order status to "delivered" when shipment is delivered
            if (entity.getOrderId() != null) {
                try {
                    orderService.updateStatus(entity.getOrderId(), "delivered");
                } catch (RuntimeException e) {
                    // Log but don't fail shipment update
                }
            }
        }
        ShipmentEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Shipment updateStatus(UUID id, String status) {
        return updateStatus(id, status, null);
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
        try {
            if (entity == null) {
                throw new IllegalArgumentException("ShipmentEntity cannot be null");
            }
            
            Shipment s = new Shipment();
            s.setId(entity.getId());
            s.setShipmentNumber(entity.getShipmentNumber() != null ? entity.getShipmentNumber() : "");
            s.setOrderId(entity.getOrderId());
            s.setCarrier(entity.getCarrier());
            s.setTrackingNumber(entity.getTrackingNumber());
            s.setDestination(entity.getDestination());
            s.setWeightKg(entity.getWeightKg());
            s.setDriverName(entity.getDriverName());
            s.setDriverPhone(entity.getDriverPhone());
            s.setVehicleNumber(entity.getVehicleNumber());
            s.setStatus(entity.getStatus() != null ? entity.getStatus() : "label_created");
            s.setEta(entity.getEta());
            s.setShippedAt(entity.getShippedAt());
            s.setDeliveredAt(entity.getDeliveredAt());
            s.setCreatedAt(entity.getCreatedAt());
            return s;
        } catch (Exception e) {
            System.err.println("Error converting ShipmentEntity to domain: " + e.getMessage());
            System.err.println("Entity ID: " + (entity != null ? entity.getId() : "null"));
            e.printStackTrace();
            throw new RuntimeException("Failed to convert shipment entity to domain: " + e.getMessage(), e);
        }
    }
}

