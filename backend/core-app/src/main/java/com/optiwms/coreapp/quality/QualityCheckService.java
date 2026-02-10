package com.optiwms.coreapp.quality;

import com.optiwms.coreapp.operations.PutawayTaskService;
import com.optiwms.coreapp.operations.ReturnService;
import com.optiwms.coreapp.operations.GrnService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.domain.quality.QualityCheck;
import com.optiwms.domain.operations.ReturnRecord;
import com.optiwms.infra.quality.QualityCheckEntity;
import com.optiwms.infra.quality.QualityCheckRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class QualityCheckService {

    private final QualityCheckRepository repository;
    private final OrderService orderService;
    private final PutawayTaskService putawayTaskService;
    private final ReturnService returnService;
    private final GrnService grnService;

    public QualityCheckService(
            QualityCheckRepository repository,
            OrderService orderService,
            PutawayTaskService putawayTaskService,
            ReturnService returnService,
            GrnService grnService) {
        this.repository = repository;
        this.orderService = orderService;
        this.putawayTaskService = putawayTaskService;
        this.returnService = returnService;
        this.grnService = grnService;
    }

    public List<QualityCheck> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<QualityCheck> findByGrnId(UUID grnId) {
        return repository.findByGrnId(grnId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<QualityCheck> findByOrderId(UUID orderId) {
        return grnService.findByOrderId(orderId).stream()
                .flatMap(grn -> repository.findByGrnId(grn.getId()).stream())
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<QualityCheck> findByMaterialId(UUID materialId) {
        return repository.findByMaterialId(materialId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public QualityCheck findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Quality check not found: " + id));
    }

    @Transactional
    public QualityCheck create(QualityCheck qualityCheck) {
        QualityCheckEntity entity = toEntity(qualityCheck);
        entity = repository.save(entity);
        return toDomain(entity);
    }

    @Transactional
    public QualityCheck update(QualityCheck qualityCheck) {
        QualityCheckEntity entity = repository.findById(qualityCheck.getId())
                .orElseThrow(() -> new RuntimeException("Quality check not found: " + qualityCheck.getId()));
        
        if (qualityCheck.getQtyReceived() != null) entity.setQtyReceived(qualityCheck.getQtyReceived());
        if (qualityCheck.getQtyPassed() != null) entity.setQtyPassed(qualityCheck.getQtyPassed());
        if (qualityCheck.getQtyRejected() != null) entity.setQtyRejected(qualityCheck.getQtyRejected());
        if (qualityCheck.getRejectionReason() != null) entity.setRejectionReason(qualityCheck.getRejectionReason());
        if (qualityCheck.getApprovalStatus() != null) entity.setApprovalStatus(qualityCheck.getApprovalStatus());
        if (qualityCheck.getApprovedBy() != null) entity.setApprovedBy(qualityCheck.getApprovedBy());
        if (qualityCheck.getApprovedAt() != null) entity.setApprovedAt(qualityCheck.getApprovedAt());
        
        entity = repository.save(entity);
        return toDomain(entity);
    }

    @Transactional
    public QualityCheck approve(UUID id, UUID approvedBy) {
        QualityCheckEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Quality check not found: " + id));
        entity.setApprovalStatus("APPROVED");
        entity.setApprovedBy(approvedBy);
        entity.setApprovedAt(OffsetDateTime.now());
        entity.setRejectionReason(null);
        if (entity.getQtyPassed() == null || entity.getQtyPassed().compareTo(BigDecimal.ZERO) <= 0) {
            entity.setQtyPassed(entity.getQtyReceived() != null ? entity.getQtyReceived() : BigDecimal.ZERO);
        }
        entity.setQtyRejected(BigDecimal.ZERO);
        entity = repository.save(entity);

        if (entity.getGrnId() != null) {
            UUID grnId = entity.getGrnId();
            List<QualityCheckEntity> allChecks = repository.findByGrnId(grnId);
            boolean allApproved = !allChecks.isEmpty()
                    && allChecks.stream().allMatch(check -> "APPROVED".equalsIgnoreCase(check.getApprovalStatus()));

            if (allApproved) {
                UUID orderId = grnService.findById(grnId).getPoId();
                if (orderId == null) {
                    return toDomain(entity);
                }
                var order = orderService.findById(orderId);
                orderService.updateStatus(orderId, "quality_approved");
                putawayTaskService.createPutawayTasksForReceivedOrder(orderId, order.getWarehouseId());
                grnService.updateStatus(grnId, "COMPLETED");
            }
        }

        return toDomain(entity);
    }

    @Transactional
    public QualityCheck reject(UUID id, String rejectionReason, UUID reviewedBy) {
        QualityCheckEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Quality check not found: " + id));
        entity.setApprovalStatus("REJECTED");
        entity.setApprovedBy(reviewedBy);
        entity.setApprovedAt(OffsetDateTime.now());
        entity.setRejectionReason(rejectionReason);
        if (entity.getQtyRejected() == null || entity.getQtyRejected().compareTo(BigDecimal.ZERO) <= 0) {
            entity.setQtyRejected(entity.getQtyReceived() != null ? entity.getQtyReceived() : BigDecimal.ZERO);
        }
        entity.setQtyPassed(BigDecimal.ZERO);
        entity = repository.save(entity);

        if (entity.getGrnId() != null) {
            UUID grnId = entity.getGrnId();
            UUID orderId = grnService.findById(grnId).getPoId();
            if (orderId == null) {
                return toDomain(entity);
            }
            var order = orderService.findById(orderId);
            orderService.updateStatus(orderId, "quality_rejected");

            List<ReturnRecord> existingReturns = returnService.findByOrderId(orderId);
            boolean hasOpenReturn = existingReturns.stream().anyMatch(ret -> {
                String status = ret.getStatus();
                return status == null
                        || (!"completed".equalsIgnoreCase(status)
                        && !"closed".equalsIgnoreCase(status)
                        && !"cancelled".equalsIgnoreCase(status));
            });

            if (!hasOpenReturn) {
                ReturnRecord returnRecord = new ReturnRecord();
                returnRecord.setReturnNumber("RET-AUTO-" + System.currentTimeMillis());
                returnRecord.setOriginalOrderId(orderId);
                returnRecord.setCustomerId(order.getCustomerId());
                returnRecord.setWarehouseId(order.getWarehouseId());
                returnRecord.setReturnDate(LocalDate.now());
                returnRecord.setReason(
                        "Auto-created from quality rejection"
                                + (rejectionReason != null && !rejectionReason.isBlank() ? ": " + rejectionReason : "")
                );
                returnRecord.setStatus("pending");
                returnService.create(returnRecord);
            }

            orderService.updateStatus(orderId, "return_initiated");
            grnService.updateStatus(grnId, "REJECTED");
        }

        return toDomain(entity);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private QualityCheck toDomain(QualityCheckEntity entity) {
        QualityCheck check = new QualityCheck();
        check.setId(entity.getId());
        check.setGrnId(entity.getGrnId());
        check.setMaterialId(entity.getMaterialId());
        check.setQtyReceived(entity.getQtyReceived());
        check.setQtyPassed(entity.getQtyPassed());
        check.setQtyRejected(entity.getQtyRejected());
        check.setRejectionReason(entity.getRejectionReason());
        check.setApprovalStatus(entity.getApprovalStatus());
        check.setApprovedBy(entity.getApprovedBy());
        check.setApprovedAt(entity.getApprovedAt());
        check.setCheckedBy(entity.getCheckedBy());
        check.setCheckDate(entity.getCheckDate());
        return check;
    }

    private QualityCheckEntity toEntity(QualityCheck check) {
        QualityCheckEntity entity = new QualityCheckEntity();
        if (check.getId() != null) entity.setId(check.getId());
        entity.setGrnId(check.getGrnId());
        entity.setMaterialId(check.getMaterialId());
        entity.setQtyReceived(check.getQtyReceived() != null ? check.getQtyReceived() : BigDecimal.ZERO);
        entity.setQtyPassed(check.getQtyPassed() != null ? check.getQtyPassed() : BigDecimal.ZERO);
        entity.setQtyRejected(check.getQtyRejected() != null ? check.getQtyRejected() : BigDecimal.ZERO);
        entity.setRejectionReason(check.getRejectionReason());
        entity.setApprovalStatus(check.getApprovalStatus() != null ? check.getApprovalStatus() : "PENDING");
        entity.setApprovedBy(check.getApprovedBy());
        entity.setApprovedAt(check.getApprovedAt());
        entity.setCheckedBy(check.getCheckedBy());
        entity.setCheckDate(check.getCheckDate() != null ? check.getCheckDate() : OffsetDateTime.now());
        return entity;
    }
}
