package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.operations.PackingRecord;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.operations.PackingRecordEntity;
import com.optiwms.infra.operations.PackingRecordRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PackingService {

    private final PackingRecordRepository repository;
    private final OrderService orderService;
    private final OperationEventService operationEventService;
    private final TaskService taskService;

    public PackingService(
            PackingRecordRepository repository,
            OrderService orderService,
            OperationEventService operationEventService,
            TaskService taskService) {
        this.repository = repository;
        this.orderService = orderService;
        this.operationEventService = operationEventService;
        this.taskService = taskService;
    }

    @Transactional
    public PackingRecord updateStatusWithWorker(UUID id, String status, UUID workerId) {
        PackingRecordEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + id));
        String normalizedStatus = normalizePackingStatus(status);
        entity.setStatus(normalizedStatus);
        if (workerId != null) {
            entity.setPackerId(workerId);
        }
        handlePackedSideEffects(entity);
        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    public List<PackingRecord> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByOrderId(UUID orderId) {
        return repository.findByOrderId(orderId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByOrderNumber(String orderNumber) {
        return repository.findByOrderNumber(orderNumber).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByPackerId(UUID packerId) {
        return repository.findByPackerId(packerId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Page<PackingRecord> findPaged(
            String status,
            UUID packerId,
            String query,
            Pageable pageable
    ) {
        Specification<PackingRecordEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (packerId != null) {
                predicates.add(cb.equal(root.get("packerId"), packerId));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("orderNumber")), pattern),
                        cb.like(cb.lower(root.get("trackingNumber")), pattern),
                        cb.like(cb.lower(root.get("boxType")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern),
                        cb.like(cb.lower(root.get("packingNotes")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    public PackingRecord findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + id));
    }

    @Transactional
    public PackingRecord create(PackingRecord packingRecord) {
        PackingRecordEntity entity = new PackingRecordEntity();
        entity.setOrderId(packingRecord.getOrderId());
        entity.setOrderNumber(packingRecord.getOrderNumber());
        entity.setPackagingTypeId(packingRecord.getPackagingTypeId());
        entity.setBoxType(packingRecord.getBoxType());
        entity.setBoxDimensions(normalizeJsonObjectText(packingRecord.getBoxDimensions()));
        entity.setDunnageMaterials(normalizeJsonArrayText(packingRecord.getDunnageMaterials()));
        entity.setHasFragileItems(packingRecord.getHasFragileItems() != null ? packingRecord.getHasFragileItems() : false);
        entity.setActualWeightKg(packingRecord.getActualWeightKg());
        entity.setDimensionalWeightKg(packingRecord.getDimensionalWeightKg());
        entity.setChargeableWeightKg(packingRecord.getChargeableWeightKg());
        entity.setTrackingNumber(normalizeTrackingNumber(packingRecord.getTrackingNumber(), packingRecord.getOrderNumber()));
        entity.setShippingLabelUrl(packingRecord.getShippingLabelUrl());
        entity.setPackingSlipUrl(packingRecord.getPackingSlipUrl());
        entity.setPackingNotes(packingRecord.getPackingNotes());
        entity.setPackingPhotos(normalizeJsonArrayText(packingRecord.getPackingPhotos()));
        entity.setPackerId(packingRecord.getPackerId());
        String normalizedStatus = normalizePackingStatus(packingRecord.getStatus() != null ? packingRecord.getStatus() : "in_progress");
        entity.setStatus(normalizedStatus);
        entity.setStartedAt(packingRecord.getStartedAt() != null ? packingRecord.getStartedAt() : LocalDateTime.now());
        handlePackedSideEffects(entity);

        PackingRecordEntity saved = repository.save(entity);
        if (saved.getOrderId() != null && ("in_progress".equals(saved.getStatus()) || "pending".equals(saved.getStatus()))) {
            try {
                orderService.updateStatus(saved.getOrderId(), "packing");
            } catch (RuntimeException ignored) {
            }
        }
        return toDomain(saved);
    }

    @Transactional
    public PackingRecord updateStatus(UUID id, String status) {
        PackingRecordEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + id));
        String normalizedStatus = normalizePackingStatus(status);
        entity.setStatus(normalizedStatus);
        if ("packed".equals(normalizedStatus) && entity.getCompletedAt() == null) {
            entity.setCompletedAt(LocalDateTime.now());
            
            // Update order status to "ready_to_ship" when packing is completed
            if (entity.getOrderId() != null) {
                try {
                    orderService.updateStatus(entity.getOrderId(), "ready_to_ship");
                } catch (RuntimeException e) {
                    // Log but don't fail packing update
                }
            }
        }
        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public PackingRecord update(PackingRecord packingRecord) {
        PackingRecordEntity entity = repository.findById(packingRecord.getId())
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + packingRecord.getId()));

        if (packingRecord.getBoxType() != null) entity.setBoxType(packingRecord.getBoxType());
        if (packingRecord.getBoxDimensions() != null) {
            entity.setBoxDimensions(normalizeJsonObjectText(packingRecord.getBoxDimensions()));
        }
        if (packingRecord.getDunnageMaterials() != null) {
            entity.setDunnageMaterials(normalizeJsonArrayText(packingRecord.getDunnageMaterials()));
        }
        if (packingRecord.getHasFragileItems() != null) entity.setHasFragileItems(packingRecord.getHasFragileItems());
        if (packingRecord.getActualWeightKg() != null) entity.setActualWeightKg(packingRecord.getActualWeightKg());
        if (packingRecord.getDimensionalWeightKg() != null) entity.setDimensionalWeightKg(packingRecord.getDimensionalWeightKg());
        if (packingRecord.getChargeableWeightKg() != null) entity.setChargeableWeightKg(packingRecord.getChargeableWeightKg());
        if (packingRecord.getTrackingNumber() != null) {
            entity.setTrackingNumber(normalizeTrackingNumber(packingRecord.getTrackingNumber(), entity.getOrderNumber()));
        } else if (entity.getTrackingNumber() == null || entity.getTrackingNumber().isBlank()) {
            entity.setTrackingNumber(normalizeTrackingNumber(null, entity.getOrderNumber()));
        }
        if (packingRecord.getPackingNotes() != null) entity.setPackingNotes(packingRecord.getPackingNotes());
        if (packingRecord.getPackerId() != null) entity.setPackerId(packingRecord.getPackerId());
        if (packingRecord.getStatus() != null) {
            entity.setStatus(normalizePackingStatus(packingRecord.getStatus()));
        }
        handlePackedSideEffects(entity);

        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private PackingRecord toDomain(PackingRecordEntity entity) {
        PackingRecord p = new PackingRecord();
        p.setId(entity.getId());
        p.setOrderId(entity.getOrderId());
        p.setOrderNumber(entity.getOrderNumber());
        p.setPackagingTypeId(entity.getPackagingTypeId());
        p.setBoxType(entity.getBoxType());
        p.setBoxDimensions(entity.getBoxDimensions());
        p.setDunnageMaterials(entity.getDunnageMaterials());
        p.setHasFragileItems(entity.getHasFragileItems());
        p.setActualWeightKg(entity.getActualWeightKg());
        p.setDimensionalWeightKg(entity.getDimensionalWeightKg());
        p.setChargeableWeightKg(entity.getChargeableWeightKg());
        p.setTrackingNumber(entity.getTrackingNumber());
        p.setShippingLabelUrl(entity.getShippingLabelUrl());
        p.setPackingSlipUrl(entity.getPackingSlipUrl());
        p.setPackingNotes(entity.getPackingNotes());
        p.setPackingPhotos(entity.getPackingPhotos());
        p.setPackerId(entity.getPackerId());
        p.setStatus(entity.getStatus());
        p.setStartedAt(entity.getStartedAt());
        p.setCompletedAt(entity.getCompletedAt());
        p.setCreatedAt(entity.getCreatedAt());
        p.setUpdatedAt(entity.getUpdatedAt());
        return p;
    }

    private String normalizePackingStatus(String status) {
        if (status == null || status.isBlank()) {
            return "pending";
        }
        String normalized = status.trim().toLowerCase();
        if ("completed".equals(normalized)) {
            return "packed";
        }
        return normalized;
    }

    private String normalizeTrackingNumber(String trackingNumber, String orderNumber) {
        if (trackingNumber != null && !trackingNumber.isBlank()) {
            return trackingNumber.trim().toUpperCase();
        }
        return derivePackReference(orderNumber);
    }

    private String derivePackReference(String orderNumber) {
        if (orderNumber == null || orderNumber.isBlank()) {
            return "PACK-" + System.currentTimeMillis();
        }
        String normalized = orderNumber.trim().toUpperCase();
        if (normalized.startsWith("OUT-")) {
            return "PACK-" + normalized.substring(4);
        }
        return "PACK-" + normalized.replaceFirst("^OUT", "").replaceFirst("^-+", "");
    }

    private String normalizeJsonArrayText(String value) {
        if (value == null || value.isBlank()) {
            return "[]";
        }
        String trimmed = value.trim();
        if (trimmed.startsWith("[")) {
            return trimmed;
        }
        List<String> parts = Arrays.stream(trimmed.split(","))
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .collect(Collectors.toList());
        return "["
                + parts.stream()
                .map(part -> "\"" + part.replace("\"", "\\\"") + "\"")
                .collect(Collectors.joining(","))
                + "]";
    }

    private String normalizeJsonObjectText(String value) {
        if (value == null || value.isBlank()) {
            return "{}";
        }
        String trimmed = value.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return trimmed;
        }
        // Keep free-text dimensions as valid JSON payload instead of raw VARCHAR.
        return "{\"value\":\"" + trimmed.replace("\"", "\\\"") + "\"}";
    }

    private void handlePackedSideEffects(PackingRecordEntity entity) {
        if (!"packed".equals(entity.getStatus())) {
            return;
        }

        if (entity.getCompletedAt() == null) {
            entity.setCompletedAt(LocalDateTime.now());
        }

        if (entity.getOrderId() != null) {
            try {
                orderService.updateStatus(entity.getOrderId(), "ready_to_ship");
            } catch (RuntimeException ignored) {
            }

            if (entity.getPackerId() != null) {
                try {
                    orderService.updateWorkerRecord(entity.getOrderId(), entity.getPackerId(), "packed");
                } catch (RuntimeException ignored) {
                }
            }

            completePackingTasks(entity.getOrderId(), entity.getPackerId(), entity.getCompletedAt());
        }

        if (entity.getPackerId() != null) {
            operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                    "PACKING",
                    entity.getPackerId(),
                    null,
                    entity.getOrderId(),
                    null,
                    null,
                    null,
                    null,
                    entity.getStartedAt(),
                    entity.getCompletedAt(),
                    null
            ));
        }
    }

    private void completePackingTasks(UUID orderId, UUID workerId, LocalDateTime completedAt) {
        List<Task> packingTasks = taskService.findByTaskTypeAndReference("packing", "order", orderId);
        List<Task> openTasks = packingTasks.stream()
                .filter(task -> {
                    String status = task.getStatus() == null ? "" : task.getStatus().toLowerCase();
                    return "pending".equals(status) || "assigned".equals(status) || "in_progress".equals(status);
                })
                .toList();

        if (openTasks.isEmpty()) {
            Task completedTask = new Task();
            completedTask.setTaskNumber(generateTaskNumber("PACK", orderId));
            completedTask.setTaskType("packing");
            if (orderId != null) {
                try {
                    var order = orderService.findById(orderId);
                    completedTask.setWarehouseId(order.getWarehouseId());
                    completedTask.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
                } catch (RuntimeException ignored) {
                    completedTask.setPriority("normal");
                }
            } else {
                completedTask.setPriority("normal");
            }
            completedTask.setReferenceType("order");
            completedTask.setReferenceId(orderId);
            completedTask.setStatus("completed");
            completedTask.setAssignedTo(workerId);
            completedTask.setDueDate(completedAt);
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
