package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.operations.ReturnRecord;
import com.optiwms.infra.operations.ReturnEntity;
import com.optiwms.infra.operations.ReturnRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReturnService {

    private final ReturnRepository repository;
    private final OrderService orderService;

    public ReturnService(ReturnRepository repository, OrderService orderService) {
        this.repository = repository;
        this.orderService = orderService;
    }

    public List<ReturnRecord> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<ReturnRecord> findByOrderId(UUID orderId) {
        return repository.findByOriginalOrderId(orderId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<ReturnRecord> findByCustomerId(UUID customerId) {
        return repository.findByCustomerId(customerId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<ReturnRecord> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public ReturnRecord findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
    }

    @Transactional
    public ReturnRecord create(ReturnRecord returnRecord) {
        if (repository.findByReturnNumber(returnRecord.getReturnNumber()).isPresent()) {
            throw new RuntimeException("Return number already exists: " + returnRecord.getReturnNumber());
        }

        ReturnEntity entity = new ReturnEntity();
        entity.setReturnNumber(returnRecord.getReturnNumber());
        entity.setOriginalOrderId(returnRecord.getOriginalOrderId());
        entity.setCustomerId(returnRecord.getCustomerId());
        entity.setWarehouseId(returnRecord.getWarehouseId());
        entity.setReturnDate(returnRecord.getReturnDate());
        entity.setReason(returnRecord.getReason());
        entity.setStatus(returnRecord.getStatus() != null ? returnRecord.getStatus() : "pending");
        entity.setResolution(returnRecord.getResolution());
        entity.setReceivedBy(returnRecord.getReceivedBy());
        entity.setInspectedBy(returnRecord.getInspectedBy());

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord intakeOutboundReturn(String orderNumber, String reason, UUID receivedBy) {
        Order order = orderService.findByOrderNumber(orderNumber);
        if (!"outbound".equalsIgnoreCase(order.getOrderType())) {
            throw new RuntimeException("Return intake by order number is supported only for outbound orders");
        }

        List<ReturnEntity> existingReturns = repository.findByOriginalOrderId(order.getId());
        ReturnEntity entity = existingReturns.stream()
                .filter(this::isOpenReturn)
                .findFirst()
                .orElse(null);

        if (entity == null) {
            entity = new ReturnEntity();
            entity.setReturnNumber("RET-OUT-" + System.currentTimeMillis());
            entity.setOriginalOrderId(order.getId());
            entity.setCustomerId(order.getCustomerId());
            entity.setWarehouseId(order.getWarehouseId());
            entity.setReturnDate(java.time.LocalDate.now());
            entity.setStatus("received");
            entity.setResolution("quality_review_pending");
        } else {
            entity.setStatus("received");
            if (entity.getReturnDate() == null) {
                entity.setReturnDate(java.time.LocalDate.now());
            }
        }

        if (reason != null && !reason.isBlank()) {
            String intakeReason = reason.trim();
            if (entity.getReason() == null || entity.getReason().isBlank()) {
                entity.setReason(intakeReason);
            } else if (!entity.getReason().contains(intakeReason)) {
                entity.setReason(entity.getReason() + "\n" + intakeReason);
            }
        } else if (entity.getReason() == null || entity.getReason().isBlank()) {
            entity.setReason("Outbound return intake");
        }

        if (receivedBy != null) {
            entity.setReceivedBy(receivedBy);
        }

        ReturnEntity saved = repository.save(entity);

        String currentStatus = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
        if ("shipped".equals(currentStatus) || "delivered".equals(currentStatus)) {
            orderService.updateStatus(order.getId(), "return_initiated");
        }

        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord updateStatus(UUID id, String status) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        entity.setStatus(status);
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord assignWorker(UUID id, UUID workerId) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        entity.setReceivedBy(workerId);
        if (entity.getStatus() == null || "pending".equalsIgnoreCase(entity.getStatus())) {
            entity.setStatus("received");
        }

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord submitInspection(UUID id, String overallResolution, String notes, UUID inspectedBy) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        entity.setResolution(overallResolution);
        if (inspectedBy != null) {
            entity.setInspectedBy(inspectedBy);
        }
        if (notes != null && !notes.isBlank()) {
            String existingReason = entity.getReason();
            String appended = "[Inspection Notes] " + notes.trim();
            entity.setReason(
                    existingReason == null || existingReason.isBlank()
                            ? appended
                            : existingReason + "\n" + appended
            );
        }
        entity.setStatus("inspecting");

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord approve(UUID id, UUID approvedBy) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        entity.setStatus("approved");
        if (approvedBy != null && entity.getInspectedBy() == null) {
            entity.setInspectedBy(approvedBy);
        }

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord update(ReturnRecord returnRecord) {
        ReturnEntity entity = repository.findById(returnRecord.getId())
                .orElseThrow(() -> new RuntimeException("Return not found: " + returnRecord.getId()));

        entity.setReason(returnRecord.getReason());
        entity.setResolution(returnRecord.getResolution());
        entity.setReceivedBy(returnRecord.getReceivedBy());
        entity.setInspectedBy(returnRecord.getInspectedBy());
        if (returnRecord.getStatus() != null) {
            entity.setStatus(returnRecord.getStatus());
        }

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private ReturnRecord toDomain(ReturnEntity entity) {
        ReturnRecord r = new ReturnRecord();
        r.setId(entity.getId());
        r.setReturnNumber(entity.getReturnNumber());
        r.setOriginalOrderId(entity.getOriginalOrderId());
        r.setCustomerId(entity.getCustomerId());
        r.setWarehouseId(entity.getWarehouseId());
        r.setReturnDate(entity.getReturnDate());
        r.setReason(entity.getReason());
        r.setStatus(entity.getStatus());
        r.setResolution(entity.getResolution());
        r.setReceivedBy(entity.getReceivedBy());
        r.setInspectedBy(entity.getInspectedBy());
        r.setCreatedAt(entity.getCreatedAt());
        return r;
    }

    private boolean isOpenReturn(ReturnEntity entity) {
        String status = entity.getStatus();
        if (status == null || status.isBlank()) {
            return true;
        }
        String normalized = status.toLowerCase();
        return !("closed".equals(normalized)
                || "completed".equals(normalized)
                || "cancelled".equals(normalized)
                || "approved".equals(normalized));
    }
}
