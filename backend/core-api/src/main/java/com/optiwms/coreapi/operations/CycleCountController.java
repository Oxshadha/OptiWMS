package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.CycleCountService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/operations/cycle-counts")
public class CycleCountController {

    private final CycleCountService service;

    public CycleCountController(CycleCountService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<CycleCountDto>> listAll() {
        List<CycleCountDto> counts = service.listAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(counts);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CycleCountDto> getById(@PathVariable UUID id) {
        try {
            CycleCountService.CycleCount count = service.findById(id);
            return ResponseEntity.ok(toDto(count));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<CycleCountDto> create(@RequestBody CreateCycleCountRequest request) {
        try {
            CycleCountService.CycleCount cycleCount = new CycleCountService.CycleCount();
            cycleCount.setCountNumber(request.countNumber());
            cycleCount.setWarehouseId(UUID.fromString(request.warehouseId()));
            cycleCount.setLocationCode(request.locationCode());
            cycleCount.setScheduledDate(
                    request.scheduledDate() != null
                            ? java.time.LocalDate.parse(request.scheduledDate())
                            : java.time.LocalDate.now()
            );
            if (request.assignedWorkers() != null && !request.assignedWorkers().isEmpty()) {
                UUID[] workerIds = request.assignedWorkers().stream().map(UUID::fromString).toArray(UUID[]::new);
                cycleCount.setAssignedWorkers(workerIds);
            }
            cycleCount.setStatus(request.status() != null ? request.status() : "scheduled");
            cycleCount.setNotes(request.notes());

            CycleCountService.CycleCount created = service.create(cycleCount);
            return ResponseEntity.ok(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<CycleCountDto> update(
            @PathVariable UUID id,
            @RequestBody UpdateCycleCountRequest request
    ) {
        try {
            CycleCountService.CycleCount updated = service.update(
                    id,
                    request.scheduledDate() != null ? java.time.LocalDate.parse(request.scheduledDate()) : null,
                    request.status(),
                    request.notes()
            );
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<CycleCountDto> cancel(
            @PathVariable UUID id,
            @RequestBody CancelCycleCountRequest request
    ) {
        try {
            CycleCountService.CycleCount updated = service.update(
                    id,
                    null,
                    "cancelled",
                    request.reason()
            );
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/review")
    public ResponseEntity<CycleCountDto> review(
            @PathVariable UUID id,
            @RequestBody ReviewCycleCountRequest request
    ) {
        try {
            CycleCountService.CycleCount updated = service.update(
                    id,
                    null,
                    null,
                    request.notes()
            );
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/record")
    public ResponseEntity<CycleCountResultDto> recordCount(
            @PathVariable UUID id,
            @RequestBody RecordCountRequest request) {
        try {
            var result = service.recordCount(
                    id,
                    UUID.fromString(request.materialId()),
                    new BigDecimal(request.countedQuantity()),
                    UUID.fromString(request.countedBy())
            );
            return ResponseEntity.ok(new CycleCountResultDto(
                    result.success(),
                    result.message(),
                    result.variance().toString(),
                    result.recountRequired(),
                    result.approvalRequired()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new CycleCountResultDto(false, e.getMessage(), null, false, false));
        }
    }

    @PostMapping("/{id}/approve-adjustment")
    public ResponseEntity<CycleCountDto> approveAdjustment(
            @PathVariable UUID id,
            @RequestBody AdjustmentDecisionRequest request
    ) {
        try {
            CycleCountService.CycleCount updated = service.approveAdjustment(
                    id,
                    UUID.fromString(request.approvedBy()),
                    request.notes()
            );
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/reject-adjustment")
    public ResponseEntity<CycleCountDto> rejectAdjustment(
            @PathVariable UUID id,
            @RequestBody AdjustmentDecisionRequest request
    ) {
        try {
            CycleCountService.CycleCount updated = service.rejectAdjustment(
                    id,
                    UUID.fromString(request.approvedBy()),
                    request.notes()
            );
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private CycleCountDto toDto(CycleCountService.CycleCount count) {
        return new CycleCountDto(
                count.getId().toString(),
                count.getCountNumber(),
                count.getWarehouseId().toString(),
                count.getLocationCode(),
                count.getStatus(),
                count.getVariance() != null ? count.getVariance().toString() : null,
                count.getMaterialId() != null ? count.getMaterialId().toString() : null,
                count.getExpectedQuantity() != null ? count.getExpectedQuantity().toString() : null,
                count.getCountedQuantity() != null ? count.getCountedQuantity().toString() : null,
                count.getVariancePercentage() != null ? count.getVariancePercentage().toString() : null,
                count.getAnomalyLevel(),
                count.getAnomalyDetected(),
                count.getApprovalRequired(),
                count.getApprovedBy() != null ? count.getApprovedBy().toString() : null,
                count.getApprovedAt() != null ? count.getApprovedAt().toString() : null,
                count.getApprovalNotes()
        );
    }

    public record RecordCountRequest(String materialId, String countedQuantity, String countedBy) {}
    public record CreateCycleCountRequest(
            String countNumber,
            String warehouseId,
            String locationCode,
            List<String> assignedWorkers,
            String scheduledDate,
            String status,
            String notes
    ) {}
    public record UpdateCycleCountRequest(String scheduledDate, String status, String notes) {}
    public record CancelCycleCountRequest(String reason) {}
    public record ReviewCycleCountRequest(String notes) {}
    public record AdjustmentDecisionRequest(String approvedBy, String notes) {}
    public record CycleCountDto(
            String id,
            String countNumber,
            String warehouseId,
            String locationCode,
            String status,
            String variance,
            String materialId,
            String expectedQuantity,
            String countedQuantity,
            String variancePercentage,
            String anomalyLevel,
            Boolean anomalyDetected,
            Boolean approvalRequired,
            String approvedBy,
            String approvedAt,
            String approvalNotes
    ) {}
    public record CycleCountResultDto(boolean success, String message, String variance, boolean recountRequired, boolean approvalRequired) {}
}
