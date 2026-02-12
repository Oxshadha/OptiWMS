package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OutboundOrderWorkflowService;
import com.optiwms.coreapp.orders.InboundOrderWorkflowService;
import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.domain.notifications.Notification;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.orders.OrderItem;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.operations.ReturnRecord;
import com.optiwms.infra.operations.ReturnEntity;
import com.optiwms.infra.operations.ReturnRepository;
import com.optiwms.infra.operations.ReturnStatusHistoryEntity;
import com.optiwms.infra.operations.ReturnStatusHistoryRepository;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReturnService {

    private final ReturnRepository repository;
    private final OrderService orderService;
    private final OrderItemRepository orderItemRepository;
    private final OutboundOrderWorkflowService outboundWorkflowService;
    private final InboundOrderWorkflowService inboundWorkflowService;
    private final InventoryService inventoryService;
    private final ReturnStatusHistoryRepository statusHistoryRepository;
    private final NotificationService notificationService;

    public ReturnService(
            ReturnRepository repository,
            OrderService orderService,
            OrderItemRepository orderItemRepository,
            OutboundOrderWorkflowService outboundWorkflowService,
            InboundOrderWorkflowService inboundWorkflowService,
            InventoryService inventoryService,
            ReturnStatusHistoryRepository statusHistoryRepository,
            NotificationService notificationService) {
        this.repository = repository;
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.outboundWorkflowService = outboundWorkflowService;
        this.inboundWorkflowService = inboundWorkflowService;
        this.inventoryService = inventoryService;
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
        handleStatusSideEffects(entity, changedBy, notes);
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
        handleStatusSideEffects(entity, approvedBy, "QC approved");

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
        handleStatusSideEffects(entity, reviewedBy, rejectionReason);
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

    private void handleStatusSideEffects(ReturnEntity entity, UUID actor, String notes) {
        if (entity.getOriginalOrderId() == null) {
            return;
        }
        Order sourceOrder;
        try {
            sourceOrder = orderService.findById(entity.getOriginalOrderId());
        } catch (Exception e) {
            return;
        }

        String flow = entity.getReturnFlow() != null ? entity.getReturnFlow().toLowerCase() : "unknown";
        String status = entity.getStatus() != null ? entity.getStatus().toLowerCase() : "";

        if ("inbound".equals(flow) && "supplier_accepted".equals(status)) {
            UUID followupOrderId = createFollowupInboundOrder(sourceOrder, entity, notes);
            if (followupOrderId != null) {
                entity.setFollowupOrderId(followupOrderId);
                entity.setResolution("replacement_inbound_created");
                notifyReturnStage(entity, "Supplier Accepted Return",
                        "Replacement inbound order created for return " + entity.getReturnNumber());
            }
            return;
        }

        if ("outbound".equals(flow) && "approved".equals(status)) {
            UUID followupOrderId = createFollowupOutboundOrder(sourceOrder, entity, false, notes);
            if (followupOrderId != null) {
                entity.setFollowupOrderId(followupOrderId);
                entity.setResolution("replacement_outbound_created");
                notifyReturnStage(entity, "Outbound Return Approved",
                        "Replacement outbound order created for return " + entity.getReturnNumber());
            } else {
                entity.setResolution("replacement_pending_no_stock");
                notifyReturnStage(entity, "Replacement Pending",
                        "Return approved but stock unavailable for immediate replacement: " + entity.getReturnNumber());
            }
            return;
        }

        if ("outbound".equals(flow) && "rejected".equals(status) && Boolean.TRUE.equals(entity.getFalseReturnRequest())) {
            UUID followupOrderId = createFollowupOutboundOrder(sourceOrder, entity, true, notes);
            if (followupOrderId != null) {
                entity.setFollowupOrderId(followupOrderId);
                entity.setResolution("false_return_reship_created");
                notifyReturnStage(entity, "False Return Rejected",
                        "Reshipment order created for false return request " + entity.getReturnNumber());
            } else {
                entity.setResolution("false_return_reship_pending_no_stock");
                notifyReturnStage(entity, "False Return - Reship Pending",
                        "False return marked; reship pending stock for " + entity.getReturnNumber());
            }
        }

        if ("inbound".equals(flow) && "supplier_rejected".equals(status)) {
            entity.setSupplierResponseStatus("rejected");
            if (notes != null && !notes.isBlank()) {
                entity.setSupplierResponseNotes(notes);
            }
            entity.setResolution("supplier_rejected_return");
            notifyReturnStage(entity, "Supplier Rejected Return",
                    "Supplier rejected inbound return " + entity.getReturnNumber());
        }

        if ("inbound".equals(flow) && "supplier_accepted".equals(status)) {
            entity.setSupplierResponseStatus("accepted");
            if (notes != null && !notes.isBlank()) {
                entity.setSupplierResponseNotes(notes);
            }
        }

        if ("outbound".equals(flow) && Boolean.TRUE.equals(entity.getFalseReturnRequest())) {
            entity.setCustomerCareFlag(true);
        }

        if ("outbound".equals(sourceOrder.getOrderType()) && "rejected".equals(status)) {
            orderService.updateStatus(sourceOrder.getId(), "shipped");
        }
        if ("outbound".equals(sourceOrder.getOrderType()) && "approved".equals(status)) {
            orderService.updateStatus(sourceOrder.getId(), "returned");
        }
    }

    private UUID createFollowupInboundOrder(Order sourceOrder, ReturnEntity returnEntity, String notes) {
        String newOrderNumber = "IN-REPL-" + sourceOrder.getOrderNumber() + "-" + System.currentTimeMillis();
        Order newOrder = new Order();
        newOrder.setOrderNumber(newOrderNumber);
        newOrder.setOrderType("inbound");
        newOrder.setSupplierId(sourceOrder.getSupplierId());
        newOrder.setWarehouseId(sourceOrder.getWarehouseId());
        newOrder.setPriority(sourceOrder.getPriority());
        newOrder.setOrderDate(java.time.LocalDate.now());
        newOrder.setExpectedDate(sourceOrder.getExpectedDate());
        newOrder.setStatus("pending");
        newOrder.setNotes("Auto replacement for return " + returnEntity.getReturnNumber()
                + (notes != null && !notes.isBlank() ? " | " + notes : ""));

        Order created = orderService.create(newOrder);
        duplicateOrderItems(sourceOrder.getId(), created.getId());
        inboundWorkflowService.createReceivingTasksForOrder(created.getId());
        return created.getId();
    }

    private UUID createFollowupOutboundOrder(Order sourceOrder, ReturnEntity returnEntity, boolean reship, String notes) {
        if (!hasStockForOrder(sourceOrder)) {
            return null;
        }

        String prefix = reship ? "OUT-RESHIP-" : "OUT-REPL-";
        String newOrderNumber = prefix + sourceOrder.getOrderNumber() + "-" + System.currentTimeMillis();
        Order newOrder = new Order();
        newOrder.setOrderNumber(newOrderNumber);
        newOrder.setOrderType("outbound");
        newOrder.setCustomerId(sourceOrder.getCustomerId());
        newOrder.setWarehouseId(sourceOrder.getWarehouseId());
        newOrder.setPriority(sourceOrder.getPriority());
        newOrder.setOrderDate(java.time.LocalDate.now());
        newOrder.setExpectedDate(sourceOrder.getExpectedDate());
        newOrder.setStatus("pending");
        newOrder.setNotes((reship ? "Auto reship for false return " : "Auto replacement for return ")
                + returnEntity.getReturnNumber()
                + (notes != null && !notes.isBlank() ? " | " + notes : ""));

        Order created = orderService.create(newOrder);
        duplicateOrderItems(sourceOrder.getId(), created.getId());
        outboundWorkflowService.createPickingTasksForOrder(created.getId());
        return created.getId();
    }

    private void duplicateOrderItems(UUID sourceOrderId, UUID targetOrderId) {
        List<OrderItemEntity> sourceItems = orderItemRepository.findByOrderId(sourceOrderId);
        for (OrderItemEntity sourceItem : sourceItems) {
            OrderItem item = new OrderItem();
            item.setOrderId(targetOrderId);
            item.setMaterialId(sourceItem.getMaterialId());
            item.setQuantity(sourceItem.getQuantity());
            item.setUnitPrice(sourceItem.getUnitPrice());
            item.setLocationCode(sourceItem.getLocationCode());
            item.setStatus("pending");
            OrderItemEntity entity = new OrderItemEntity();
            entity.setOrderId(item.getOrderId());
            entity.setMaterialId(item.getMaterialId());
            entity.setQuantity(item.getQuantity());
            entity.setUnitPrice(item.getUnitPrice());
            entity.setPickedQuantity(0);
            entity.setPackedQuantity(0);
            entity.setLocationCode(item.getLocationCode());
            entity.setStatus(item.getStatus());
            orderItemRepository.save(entity);
        }
    }

    private boolean hasStockForOrder(Order sourceOrder) {
        if (sourceOrder == null || sourceOrder.getId() == null) {
            return false;
        }
        List<OrderItemEntity> items = orderItemRepository.findByOrderId(sourceOrder.getId());
        for (OrderItemEntity item : items) {
            List<InventoryItem> inventoryItems = inventoryService.findByMaterialAndWarehouse(
                    item.getMaterialId(),
                    sourceOrder.getWarehouseId()
            );
            int totalAvailable = inventoryItems.stream()
                    .mapToInt(inv -> inv.getAvailableQuantity() != null ? inv.getAvailableQuantity() : 0)
                    .sum();
            int required = item.getQuantity() != null ? item.getQuantity() : 0;
            if (totalAvailable < required) {
                return false;
            }
        }
        return true;
    }

    public List<SupplierQualityMetric> getSupplierQualityMetrics() {
        List<ReturnEntity> allReturns = repository.findAll().stream()
                .filter(ret -> "inbound".equalsIgnoreCase(ret.getReturnFlow()))
                .collect(Collectors.toList());

        Map<UUID, SupplierQualityMetricAccumulator> metrics = new HashMap<>();
        for (ReturnEntity ret : allReturns) {
            if (ret.getOriginalOrderId() == null) {
                continue;
            }
            Order order;
            try {
                order = orderService.findById(ret.getOriginalOrderId());
            } catch (Exception ex) {
                continue;
            }
            UUID supplierId = order.getSupplierId();
            if (supplierId == null) continue;
            SupplierQualityMetricAccumulator acc = metrics.computeIfAbsent(supplierId, k -> new SupplierQualityMetricAccumulator());
            acc.totalReturns++;
            String status = ret.getStatus() != null ? ret.getStatus().toLowerCase() : "";
            if ("supplier_accepted".equals(status)) acc.supplierAccepted++;
            if ("supplier_rejected".equals(status)) acc.supplierRejected++;
            if ("rejected".equals(ret.getQcOutcome())) acc.qualityRejected++;
        }

        return metrics.entrySet().stream()
                .map(entry -> {
                    UUID supplierId = entry.getKey();
                    SupplierQualityMetricAccumulator acc = entry.getValue();
                    double rejectionRate = acc.totalReturns == 0 ? 0.0 : (acc.supplierRejected * 100.0) / acc.totalReturns;
                    return new SupplierQualityMetric(
                            supplierId,
                            acc.totalReturns,
                            acc.qualityRejected,
                            acc.supplierAccepted,
                            acc.supplierRejected,
                            rejectionRate
                    );
                })
                .collect(Collectors.toList());
    }

    public List<CustomerReturnMetric> getCustomerReturnMetrics() {
        List<ReturnEntity> allReturns = repository.findAll().stream()
                .filter(ret -> "outbound".equalsIgnoreCase(ret.getReturnFlow()))
                .collect(Collectors.toList());

        Map<UUID, CustomerReturnMetricAccumulator> metrics = new HashMap<>();
        for (ReturnEntity ret : allReturns) {
            if (ret.getOriginalOrderId() == null) continue;
            Order order;
            try {
                order = orderService.findById(ret.getOriginalOrderId());
            } catch (Exception ex) {
                continue;
            }
            UUID customerId = order.getCustomerId();
            if (customerId == null) continue;
            CustomerReturnMetricAccumulator acc = metrics.computeIfAbsent(customerId, k -> new CustomerReturnMetricAccumulator());
            acc.totalReturnRequests++;
            String status = ret.getStatus() != null ? ret.getStatus().toLowerCase() : "";
            if ("approved".equals(status)) acc.approvedReturns++;
            if (Boolean.TRUE.equals(ret.getFalseReturnRequest())) acc.falseReturnRequests++;
            if ("rejected".equals(status) && !Boolean.TRUE.equals(ret.getFalseReturnRequest())) acc.actualRejectedReturns++;
        }

        return metrics.entrySet().stream()
                .map(entry -> {
                    UUID customerId = entry.getKey();
                    CustomerReturnMetricAccumulator acc = entry.getValue();
                    double falseRate = acc.totalReturnRequests == 0 ? 0.0 : (acc.falseReturnRequests * 100.0) / acc.totalReturnRequests;
                    return new CustomerReturnMetric(
                            customerId,
                            acc.totalReturnRequests,
                            acc.approvedReturns,
                            acc.actualRejectedReturns,
                            acc.falseReturnRequests,
                            falseRate
                    );
                })
                .collect(Collectors.toList());
    }

    public record SupplierQualityMetric(
            UUID supplierId,
            int totalReturns,
            int qualityRejectedCases,
            int supplierAcceptedCount,
            int supplierRejectedCount,
            double supplierRejectionRatePercent
    ) {}

    public record CustomerReturnMetric(
            UUID customerId,
            int totalReturnRequests,
            int approvedReturns,
            int actualRejectedReturns,
            int falseReturnRequests,
            double falseReturnRatePercent
    ) {}

    private static class SupplierQualityMetricAccumulator {
        int totalReturns;
        int qualityRejected;
        int supplierAccepted;
        int supplierRejected;
    }

    private static class CustomerReturnMetricAccumulator {
        int totalReturnRequests;
        int approvedReturns;
        int actualRejectedReturns;
        int falseReturnRequests;
    }
}
