package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.domain.operations.PackingRecord;
import com.optiwms.infra.operations.PackingRecordEntity;
import com.optiwms.infra.operations.PackingRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PackingService {

    private final PackingRecordRepository repository;
    private final OrderService orderService;
    private final OperationEventService operationEventService;

    public PackingService(PackingRecordRepository repository, OrderService orderService, OperationEventService operationEventService) {
        this.repository = repository;
        this.orderService = orderService;
        this.operationEventService = operationEventService;
    }

    @Transactional
    public PackingRecord updateStatusWithWorker(UUID id, String status, UUID workerId) {
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
                    // Store worker record
                    if (workerId != null) {
                        orderService.updateWorkerRecord(entity.getOrderId(), workerId, "packed");
                    }
                } catch (RuntimeException e) {
                    // Log but don't fail packing update
                }
            }
            if (workerId != null) {
                operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                        "PACKING",
                        workerId,
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
        entity.setBoxDimensions(packingRecord.getBoxDimensions());
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

        PackingRecordEntity saved = repository.save(entity);
        if (saved.getOrderId() != null && "in_progress".equals(saved.getStatus())) {
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
        if (packingRecord.getBoxDimensions() != null) entity.setBoxDimensions(packingRecord.getBoxDimensions());
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
        if (packingRecord.getStatus() != null) {
            entity.setStatus(normalizePackingStatus(packingRecord.getStatus()));
        }

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
}
