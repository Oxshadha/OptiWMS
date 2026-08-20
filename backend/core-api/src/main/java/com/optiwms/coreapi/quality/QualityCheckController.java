package com.optiwms.coreapi.quality;

import com.optiwms.coreapp.quality.QualityCheckService;
import com.optiwms.domain.quality.QualityCheck;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/quality-checks")
public class QualityCheckController {

    private final QualityCheckService service;
    private final MaterialRepository materialRepository;

    public QualityCheckController(QualityCheckService service, MaterialRepository materialRepository) {
        this.service = service;
        this.materialRepository = materialRepository;
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

        Map<UUID, MaterialEntity> materials = loadMaterials(checks);
        List<QualityCheckDto> dtos = checks.stream()
                .map(check -> toDto(check, materials.get(check.getMaterialId())))
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

    /**
     * Bulk-loads the referenced materials so a list response stays a single extra query.
     * Uses the repository directly rather than the operational material list: a check can
     * legitimately point at an archived or untiered material, and it still needs a name.
     */
    private Map<UUID, MaterialEntity> loadMaterials(List<QualityCheck> checks) {
        Set<UUID> ids = checks.stream()
                .map(QualityCheck::getMaterialId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, MaterialEntity> byId = new HashMap<>();
        materialRepository.findAllById(ids).forEach(material -> byId.put(material.getId(), material));
        return byId;
    }

    private QualityCheckDto toDto(QualityCheck check) {
        MaterialEntity material = check.getMaterialId() != null
                ? materialRepository.findById(check.getMaterialId()).orElse(null)
                : null;
        return toDto(check, material);
    }

    private QualityCheckDto toDto(QualityCheck check, MaterialEntity material) {
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
                check.getCheckDate() != null ? check.getCheckDate().toString() : null,
                material != null ? material.getMaterialCode() : null,
                material != null ? material.getDescription() : null
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
            String checkDate,
            String materialCode,
            String materialDescription
    ) {}
}
