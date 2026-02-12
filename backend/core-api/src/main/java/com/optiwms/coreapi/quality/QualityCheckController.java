package com.optiwms.coreapi.quality;

import com.optiwms.coreapp.quality.QualityCheckService;
import com.optiwms.domain.quality.QualityCheck;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/quality-checks")
public class QualityCheckController {

    private final QualityCheckService service;

    public QualityCheckController(QualityCheckService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<QualityCheckDto>> listAll(
            @RequestParam(required = false) String grnId,
            @RequestParam(required = false) String orderId,
            @RequestParam(required = false) String materialId
    ) {
        List<QualityCheck> checks;
        if (grnId != null) {
            checks = service.findByGrnId(UUID.fromString(grnId));
        } else if (orderId != null) {
            checks = service.findByOrderId(UUID.fromString(orderId));
        } else if (materialId != null) {
            checks = service.findByMaterialId(UUID.fromString(materialId));
        } else {
            checks = service.listAll();
        }

        List<QualityCheckDto> dtos = checks.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<QualityCheckDto> getById(@PathVariable UUID id) {
        try {
            QualityCheck check = service.findById(id);
            return ResponseEntity.ok(toDto(check));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<QualityCheckDto> create(@RequestBody CreateQualityCheckRequest request) {
        try {
            QualityCheck check = new QualityCheck();
            check.setGrnId(request.grnId() != null ? UUID.fromString(request.grnId()) : null);
            check.setMaterialId(request.materialId() != null ? UUID.fromString(request.materialId()) : null);
            check.setQtyReceived(new BigDecimal(request.qtyReceived()));
            check.setQtyPassed(new BigDecimal(request.qtyPassed()));
            check.setQtyRejected(new BigDecimal(request.qtyRejected()));
            check.setRejectionReason(request.rejectionReason());
            check.setCheckedBy(request.checkedBy() != null ? UUID.fromString(request.checkedBy()) : null);
            check.setCheckDate(OffsetDateTime.now());

            QualityCheck created = service.create(check);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<QualityCheckDto> update(@PathVariable UUID id, @RequestBody UpdateQualityCheckRequest request) {
        try {
            QualityCheck check = service.findById(id);
            if (request.qtyReceived() != null) check.setQtyReceived(new BigDecimal(request.qtyReceived()));
            if (request.qtyPassed() != null) check.setQtyPassed(new BigDecimal(request.qtyPassed()));
            if (request.qtyRejected() != null) check.setQtyRejected(new BigDecimal(request.qtyRejected()));
            if (request.rejectionReason() != null) check.setRejectionReason(request.rejectionReason());
            if (request.approvalStatus() != null) check.setApprovalStatus(request.approvalStatus());
            if (request.approvedBy() != null) check.setApprovedBy(UUID.fromString(request.approvedBy()));
            if (request.approvedAt() != null) check.setApprovedAt(OffsetDateTime.parse(request.approvedAt()));

            QualityCheck updated = service.update(check);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<QualityCheckDto> approve(
            @PathVariable UUID id,
            @RequestBody(required = false) ApproveQualityCheckRequest request
    ) {
        try {
            UUID approvedBy = request != null && request.approvedBy() != null
                    ? UUID.fromString(request.approvedBy())
                    : null;
            QualityCheck updated = service.approve(id, approvedBy);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<QualityCheckDto> reject(
            @PathVariable UUID id,
            @RequestBody RejectQualityCheckRequest request
    ) {
        try {
            UUID rejectedBy = request.rejectedBy() != null ? UUID.fromString(request.rejectedBy()) : null;
            QualityCheck updated = service.reject(id, request.rejectionReason(), rejectedBy);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            service.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private QualityCheckDto toDto(QualityCheck check) {
        return new QualityCheckDto(
                check.getId().toString(),
                check.getGrnId() != null ? check.getGrnId().toString() : null,
                check.getMaterialId() != null ? check.getMaterialId().toString() : null,
                check.getQtyReceived() != null ? check.getQtyReceived().toString() : "0",
                check.getQtyPassed() != null ? check.getQtyPassed().toString() : "0",
                check.getQtyRejected() != null ? check.getQtyRejected().toString() : "0",
                check.getRejectionReason(),
                check.getApprovalStatus(),
                check.getApprovedBy() != null ? check.getApprovedBy().toString() : null,
                check.getApprovedAt() != null ? check.getApprovedAt().toString() : null,
                check.getCheckedBy() != null ? check.getCheckedBy().toString() : null,
                check.getCheckDate() != null ? check.getCheckDate().toString() : null
        );
    }

    public record CreateQualityCheckRequest(
            String grnId,
            String materialId,
            String qtyReceived,
            String qtyPassed,
            String qtyRejected,
            String rejectionReason,
            String checkedBy
    ) {}

    public record UpdateQualityCheckRequest(
            String qtyReceived,
            String qtyPassed,
            String qtyRejected,
            String rejectionReason,
            String approvalStatus,
            String approvedBy,
            String approvedAt
    ) {}

    public record ApproveQualityCheckRequest(
            String approvedBy
    ) {}

    public record RejectQualityCheckRequest(
            String rejectionReason,
            String rejectedBy
    ) {}

    public record QualityCheckDto(
            String id,
            String grnId,
            String materialId,
            String qtyReceived,
            String qtyPassed,
            String qtyRejected,
            String rejectionReason,
            String approvalStatus,
            String approvedBy,
            String approvedAt,
            String checkedBy,
            String checkDate
    ) {}
}
