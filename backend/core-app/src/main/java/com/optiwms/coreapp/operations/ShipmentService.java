package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.tasks.Task;
import com.optiwms.domain.operations.Shipment;
import com.optiwms.infra.operations.ShipmentEntity;
import com.optiwms.infra.operations.ShipmentRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ShipmentService {

    private final ShipmentRepository repository;
    private final OrderService orderService;
    private final TaskService taskService;
    private final OperationEventService operationEventService;
    private static final Map<String, Set<String>> STATUS_TRANSITIONS = buildShipmentTransitions();

    public ShipmentService(
            ShipmentRepository repository,
            OrderService orderService,
            TaskService taskService,
            OperationEventService operationEventService) {
        this.repository = repository;
        this.orderService = orderService;
        this.taskService = taskService;
        this.operationEventService = operationEventService;
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

    public Page<Shipment> findPaged(
            UUID orderId,
            UUID deliveryPartnerId,
            String status,
            String q,
            Pageable pageable
    ) {
        Specification<ShipmentEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (orderId != null) {
                predicates.add(cb.equal(root.get("orderId"), orderId));
            }
            if (deliveryPartnerId != null) {
                predicates.add(cb.equal(root.get("deliveryPartnerId"), deliveryPartnerId));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("shipmentNumber")), pattern),
                        cb.like(cb.lower(root.get("carrier")), pattern),
                        cb.like(cb.lower(root.get("trackingNumber")), pattern),
                        cb.like(cb.lower(root.get("destination")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern),
                        cb.like(cb.lower(root.get("driverName")), pattern),
                        cb.like(cb.lower(root.get("driverPhone")), pattern),
                        cb.like(cb.lower(root.get("vehicleNumber")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    public List<Shipment> findByOrderId(UUID orderId) {
        return repository.findByOrderId(orderId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Shipment> findByDeliveryPartnerId(UUID deliveryPartnerId) {
        return repository.findByDeliveryPartnerId(deliveryPartnerId).stream()
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
        entity.setDeliveryPartnerId(shipment.getDeliveryPartnerId());
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
        return updateStatus(id, status, workerId, false);
    }

    @Transactional
    public Shipment updateStatus(UUID id, String status, UUID workerId, boolean managerApproval) {
        ShipmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + id));
        String nextStatus = normalizeStatus(status);
        String currentStatus = normalizeStatus(entity.getStatus());

        if (!isAllowedTransition(currentStatus, nextStatus)) {
            throw new RuntimeException("Invalid shipment status transition: " + currentStatus + " -> " + nextStatus);
        }

        if ("delivered".equals(nextStatus) && !managerApproval) {
            throw new RuntimeException("Only admin or warehouse manager can confirm delivery");
        }

        entity.setStatus(nextStatus);
        if ("shipped".equals(nextStatus) && entity.getShippedAt() == null) {
            entity.setShippedAt(LocalDateTime.now());
            handleShippedSideEffects(entity, workerId);
        } else if ("delivered".equals(nextStatus) && entity.getDeliveredAt() == null) {
            if (entity.getShippedAt() == null) {
                throw new RuntimeException("Shipment must be marked as shipped before delivery confirmation");
            }
            entity.setDeliveredAt(LocalDateTime.now());
            entity.setDeliveryConfirmedBy(workerId);
            entity.setDeliveryConfirmedAt(LocalDateTime.now());
            
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
        return updateStatus(id, status, null, false);
    }

    @Transactional
    public Shipment update(Shipment shipment) {
        ShipmentEntity entity = repository.findById(shipment.getId())
                .orElseThrow(() -> new RuntimeException("Shipment not found: " + shipment.getId()));

        entity.setCarrier(shipment.getCarrier());
        entity.setDeliveryPartnerId(shipment.getDeliveryPartnerId());
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
            s.setDeliveryPartnerId(entity.getDeliveryPartnerId());
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
            s.setDeliveryConfirmedBy(entity.getDeliveryConfirmedBy());
            s.setDeliveryConfirmedAt(entity.getDeliveryConfirmedAt());
            s.setCreatedAt(entity.getCreatedAt());
            return s;
        } catch (Exception e) {
            System.err.println("Error converting ShipmentEntity to domain: " + e.getMessage());
            System.err.println("Entity ID: " + (entity != null ? entity.getId() : "null"));
            e.printStackTrace();
            throw new RuntimeException("Failed to convert shipment entity to domain: " + e.getMessage(), e);
        }
    }

    private static Map<String, Set<String>> buildShipmentTransitions() {
        Map<String, Set<String>> transitions = new HashMap<>();
        transitions.put("label_created", setOf("label_created", "ready_to_ship", "shipped", "cancelled"));
        transitions.put("ready_to_ship", setOf("ready_to_ship", "shipped", "cancelled"));
        transitions.put("shipped", setOf("shipped", "in_transit", "delivered"));
        transitions.put("in_transit", setOf("in_transit", "delivered"));
        transitions.put("delivered", setOf("delivered"));
        transitions.put("cancelled", setOf("cancelled"));
        return transitions;
    }

    private static Set<String> setOf(String... statuses) {
        Set<String> values = new HashSet<>();
        for (String status : statuses) {
            values.add(status);
        }
        return values;
    }

    private boolean isAllowedTransition(String currentStatus, String nextStatus) {
        if (currentStatus == null || currentStatus.isBlank()) {
            return true;
        }
        Set<String> allowed = STATUS_TRANSITIONS.get(currentStatus);
        if (allowed == null) {
            return currentStatus.equals(nextStatus);
        }
        return allowed.contains(nextStatus);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new RuntimeException("Shipment status cannot be empty");
        }
        return status.trim().toLowerCase();
    }

    private void handleShippedSideEffects(ShipmentEntity entity, UUID workerId) {
        if (entity.getOrderId() == null) {
            return;
        }

        UUID warehouseId = null;
        try {
            var order = orderService.findById(entity.getOrderId());
            warehouseId = order.getWarehouseId();
            orderService.updateStatus(entity.getOrderId(), "shipped");
            if (workerId != null) {
                orderService.updateWorkerRecord(entity.getOrderId(), workerId, "shipped");
            }
        } catch (RuntimeException ignored) {
        }

        completeShipmentTasks(entity.getOrderId(), workerId);

        if (workerId != null) {
            operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                    "SHIPMENT",
                    workerId,
                    null,
                    entity.getOrderId(),
                    null,
                    warehouseId,
                    null,
                    null,
                    null,
                    entity.getShippedAt(),
                    null
            ));
        }
    }

    private void completeShipmentTasks(UUID orderId, UUID workerId) {
        List<Task> shipmentTasks = taskService.findByTaskTypeAndReference("shipment", "order", orderId);
        List<Task> openTasks = shipmentTasks.stream()
                .filter(task -> {
                    String status = task.getStatus() == null ? "" : task.getStatus().toLowerCase();
                    return "pending".equals(status) || "assigned".equals(status) || "in_progress".equals(status);
                })
                .toList();

        if (openTasks.isEmpty()) {
            Task completedTask = new Task();
            completedTask.setTaskNumber(generateTaskNumber("SHIP", orderId));
            completedTask.setTaskType("shipment");
            completedTask.setReferenceType("order");
            completedTask.setReferenceId(orderId);
            completedTask.setStatus("completed");
            completedTask.setAssignedTo(workerId);
            Task created = taskService.create(completedTask);
            if (workerId != null) {
                taskService.updateStatusWithWorker(created.getId(), "completed", workerId);
            } else {
                taskService.updateStatus(created.getId(), "completed");
            }
            return;
        }

        for (Task task : openTasks) {
            if (workerId != null) {
                taskService.updateStatusWithWorker(task.getId(), "completed", workerId);
            } else {
                taskService.updateStatus(task.getId(), "completed");
            }
        }
    }

    private String generateTaskNumber(String prefix, UUID orderId) {
        String ts = String.valueOf(System.currentTimeMillis());
        String suffix = ts.substring(Math.max(0, ts.length() - 6));
        String orderPart = orderId != null ? orderId.toString().substring(0, 8).toUpperCase() : "ORDER";
        return prefix + "-" + orderPart + "-" + suffix;
    }
}
