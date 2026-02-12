package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.domain.notifications.Notification;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.operations.ReturnRecord;
import com.optiwms.infra.operations.ReturnEntity;
import com.optiwms.infra.operations.ReturnRepository;
import com.optiwms.infra.operations.ReturnStatusHistoryEntity;
import com.optiwms.infra.operations.ReturnStatusHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReturnService {

    private final ReturnRepository repository;
    private final OrderService orderService;
    private final ReturnStatusHistoryRepository statusHistoryRepository;
    private final NotificationService notificationService;

    public ReturnService(
            ReturnRepository repository,
            OrderService orderService,
            ReturnStatusHistoryRepository statusHistoryRepository,
            NotificationService notificationService) {
        this.repository = repository;
        this.orderService = orderService;
        this.statusHistoryRepository = statusHistoryRepository;
        this.notificationService = notificationService;
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
        entity.setReturnFlow(returnRecord.getReturnFlow() != null ? returnRecord.getReturnFlow() : "unknown");
        entity.setQcOutcome(returnRecord.getQcOutcome());
        entity.setSupplierResponseStatus(returnRecord.getSupplierResponseStatus());
        entity.setSupplierResponseNotes(returnRecord.getSupplierResponseNotes());
        entity.setFalseReturnRequest(Boolean.TRUE.equals(returnRecord.getFalseReturnRequest()));
        entity.setCustomerCareFlag(Boolean.TRUE.equals(returnRecord.getCustomerCareFlag()));
        entity.setFollowupOrderId(returnRecord.getFollowupOrderId());
        entity.setClosedAt(returnRecord.getClosedAt());
        entity.setLastStatusChangedAt(LocalDateTime.now());

        ReturnEntity saved = repository.save(entity);
        recordStatusHistory(saved.getId(), null, saved.getStatus(), returnRecord.getReceivedBy(), "Return created");
        notifyReturnStage(saved, "Return Created", "Return " + saved.getReturnNumber() + " created with status " + saved.getStatus());
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
            entity.setStatus("pending");
            entity.setResolution("quality_review_pending");
            entity.setReturnFlow("outbound");
            entity = repository.save(entity);
        } else {
            if (entity.getReturnDate() == null) {
                entity.setReturnDate(java.time.LocalDate.now());
            }
            if (entity.getReturnFlow() == null || entity.getReturnFlow().isBlank()) {
                entity.setReturnFlow("outbound");
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

        transitionStatus(entity, "received", receivedBy, "Outbound return received at worker intake");
        ReturnEntity saved = repository.save(entity);

        String currentStatus = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
        if ("shipped".equals(currentStatus) || "delivered".equals(currentStatus)) {
            orderService.updateStatus(order.getId(), "return_initiated");
        }

        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord updateStatus(UUID id, String status) {
        return updateStatus(id, status, null, null);
    }

    @Transactional
    public ReturnRecord updateStatus(UUID id, String status, UUID changedBy, String notes) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        transitionStatus(entity, status, changedBy, notes);
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord assignWorker(UUID id, UUID workerId) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        entity.setReceivedBy(workerId);
        if (entity.getStatus() == null || "pending".equalsIgnoreCase(entity.getStatus())) {
            transitionStatus(entity, "received", workerId, "Return assigned and received by worker");
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
        transitionStatus(entity, "inspecting", inspectedBy, "Return moved to inspection");

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord approve(UUID id, UUID approvedBy) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        transitionStatus(entity, "approved", approvedBy, "Return QC approved");
        entity.setQcOutcome("approved");
        entity.setFalseReturnRequest(false);
        if (approvedBy != null && entity.getInspectedBy() == null) {
            entity.setInspectedBy(approvedBy);
        }

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord reject(UUID id, String rejectionReason, String resolution, UUID reviewedBy) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        String normalizedResolution = resolution != null ? resolution.toLowerCase() : "reject";
        boolean falseClaim = "false_return_request".equals(normalizedResolution) || "false_claim".equals(normalizedResolution);

        entity.setResolution(resolution != null ? resolution : "reject");
        entity.setQcOutcome("rejected");
        entity.setFalseReturnRequest(falseClaim);
        entity.setCustomerCareFlag(falseClaim);
        if (rejectionReason != null && !rejectionReason.isBlank()) {
            String existing = entity.getReason();
            String note = "[QC Rejection] " + rejectionReason.trim();
            entity.setReason(existing == null || existing.isBlank() ? note : existing + "\n" + note);
        }
        if (reviewedBy != null && entity.getInspectedBy() == null) {
            entity.setInspectedBy(reviewedBy);
        }

        transitionStatus(entity, "rejected", reviewedBy, "Return QC rejected");
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
        entity.setReturnFlow(returnRecord.getReturnFlow());
        entity.setQcOutcome(returnRecord.getQcOutcome());
        entity.setSupplierResponseStatus(returnRecord.getSupplierResponseStatus());
        entity.setSupplierResponseNotes(returnRecord.getSupplierResponseNotes());
        entity.setFalseReturnRequest(returnRecord.getFalseReturnRequest());
        entity.setCustomerCareFlag(returnRecord.getCustomerCareFlag());
        entity.setFollowupOrderId(returnRecord.getFollowupOrderId());
        entity.setClosedAt(returnRecord.getClosedAt());
        entity.setLastStatusChangedAt(returnRecord.getLastStatusChangedAt());
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
        r.setReturnFlow(entity.getReturnFlow());
        r.setQcOutcome(entity.getQcOutcome());
        r.setSupplierResponseStatus(entity.getSupplierResponseStatus());
        r.setSupplierResponseNotes(entity.getSupplierResponseNotes());
        r.setFalseReturnRequest(entity.getFalseReturnRequest());
        r.setCustomerCareFlag(entity.getCustomerCareFlag());
        r.setFollowupOrderId(entity.getFollowupOrderId());
        r.setClosedAt(entity.getClosedAt());
        r.setLastStatusChangedAt(entity.getLastStatusChangedAt());
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

    private void transitionStatus(ReturnEntity entity, String nextStatus, UUID changedBy, String notes) {
        String fromStatus = entity.getStatus();
        String normalizedNext = nextStatus == null ? "" : nextStatus.trim().toLowerCase();
        if (normalizedNext.isBlank()) {
            throw new RuntimeException("Return status cannot be empty");
        }

        entity.setStatus(normalizedNext);
        entity.setLastStatusChangedAt(LocalDateTime.now());
        if ("approved".equals(normalizedNext) || "rejected".equals(normalizedNext) || "completed".equals(normalizedNext)) {
            entity.setClosedAt(LocalDateTime.now());
        }

        recordStatusHistory(entity.getId(), fromStatus, normalizedNext, changedBy, notes);
        notifyReturnStage(entity, "Return Status Updated", "Return " + entity.getReturnNumber() + " moved to " + normalizedNext);
    }

    private void recordStatusHistory(UUID returnId, String fromStatus, String toStatus, UUID changedBy, String notes) {
        if (returnId == null) {
            return;
        }
        ReturnStatusHistoryEntity history = new ReturnStatusHistoryEntity();
        history.setReturnId(returnId);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setChangedBy(changedBy);
        history.setNotes(notes);
        statusHistoryRepository.save(history);
    }

    private void notifyReturnStage(ReturnEntity entity, String title, String message) {
        try {
            Notification notification = new Notification();
            notification.setUserId(null); // broadcast
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setNotificationType("return");
            notification.setRead(false);
            notification.setActionUrl("/admin/returns");
            notification.setMetadata("{\"returnId\":\"" + entity.getId() + "\",\"status\":\"" + entity.getStatus() + "\"}");
            notification.setCreatedAt(OffsetDateTime.now());
            notificationService.create(notification);
        } catch (Exception ignored) {
            // Notification should not block workflow status update.
        }
    }
}
