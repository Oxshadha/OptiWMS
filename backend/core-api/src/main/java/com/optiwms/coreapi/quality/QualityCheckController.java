package com.optiwms.coreapi.quality;

import com.optiwms.coreapp.quality.QualityCheckService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/quality-checks")
public class QualityCheckController {

    private final QualityCheckService service;

    public QualityCheckController(QualityCheckService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<QualityCheckDto>> list() {
        var data = service.listAll().stream()
                .map(q -> new QualityCheckDto(
                        q.getId(),
                        q.getCheckNumber(),
                        q.getOrderId(),
                        q.getMaterialId(),
                        q.getWarehouseId(),
                        q.getCheckType(),
                        q.getStatus(),
                        q.getResult(),
                        q.getNotes(),
                        q.getCheckedBy(),
                        q.getCheckedAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<QualityCheckDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var check = service.findById(id);
            return ResponseEntity.ok(new QualityCheckDto(
                    check.getId(),
                    check.getCheckNumber(),
                    check.getOrderId(),
                    check.getMaterialId(),
                    check.getWarehouseId(),
                    check.getCheckType(),
                    check.getStatus(),
                    check.getResult(),
                    check.getNotes(),
                    check.getCheckedBy(),
                    check.getCheckedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<QualityCheckDto> create(@RequestBody CreateQualityCheckRequest request) {
        try {
            var check = new com.optiwms.domain.quality.QualityCheck();
            check.setCheckNumber(request.checkNumber());
            check.setOrderId(request.orderId());
            check.setMaterialId(request.materialId());
            check.setWarehouseId(request.warehouseId());
            check.setCheckType(request.checkType());
            check.setStatus(request.status());
            check.setResult(request.result());
            check.setNotes(request.notes());
            check.setCheckedBy(request.checkedBy());
            check.setCheckedAt(request.checkedAt());

            var created = service.create(check);
            return ResponseEntity.ok(new QualityCheckDto(
                    created.getId(),
                    created.getCheckNumber(),
                    created.getOrderId(),
                    created.getMaterialId(),
                    created.getWarehouseId(),
                    created.getCheckType(),
                    created.getStatus(),
                    created.getResult(),
                    created.getNotes(),
                    created.getCheckedBy(),
                    created.getCheckedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<QualityCheckDto> update(@PathVariable @NonNull java.util.UUID id, @RequestBody UpdateQualityCheckRequest request) {
        try {
            var check = new com.optiwms.domain.quality.QualityCheck();
            check.setOrderId(request.orderId());
            check.setMaterialId(request.materialId());
            check.setWarehouseId(request.warehouseId());
            check.setCheckType(request.checkType());
            check.setStatus(request.status());
            check.setResult(request.result());
            check.setNotes(request.notes());
            check.setCheckedBy(request.checkedBy());
            check.setCheckedAt(request.checkedAt());

            var updated = service.update(id, check);
            return ResponseEntity.ok(new QualityCheckDto(
                    updated.getId(),
                    updated.getCheckNumber(),
                    updated.getOrderId(),
                    updated.getMaterialId(),
                    updated.getWarehouseId(),
                    updated.getCheckType(),
                    updated.getStatus(),
                    updated.getResult(),
                    updated.getNotes(),
                    updated.getCheckedBy(),
                    updated.getCheckedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record QualityCheckDto(
            java.util.UUID id,
            String checkNumber,
            java.util.UUID orderId,
            java.util.UUID materialId,
            java.util.UUID warehouseId,
            String checkType,
            String status,
            String result,
            String notes,
            java.util.UUID checkedBy,
            java.time.LocalDateTime checkedAt
    ) {}

    public record CreateQualityCheckRequest(
            String checkNumber,
            java.util.UUID orderId,
            java.util.UUID materialId,
            java.util.UUID warehouseId,
            String checkType,
            String status,
            String result,
            String notes,
            java.util.UUID checkedBy,
            java.time.LocalDateTime checkedAt
    ) {}

    public record UpdateQualityCheckRequest(
            java.util.UUID orderId,
            java.util.UUID materialId,
            java.util.UUID warehouseId,
            String checkType,
            String status,
            String result,
            String notes,
            java.util.UUID checkedBy,
            java.time.LocalDateTime checkedAt
    ) {}
}

