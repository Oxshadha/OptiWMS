package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.coreapp.operations.CycleCountService;
import com.optiwms.domain.notifications.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/operations/cycle-counts")
public class CycleCountController {

    private final CycleCountService service;
    private final NotificationService notificationService;

    public CycleCountController(CycleCountService service, NotificationService notificationService) {
        this.service = service;
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<CycleCountDto>> listAll() {
        List<CycleCountDto> counts = service.listAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(counts);
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedCycleCountResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);

        Page<CycleCountService.CycleCount> countPage = service.findPaged(
                warehouseId,
                status,
                q,
                PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy).and(Sort.by(direction, "id")))
        );

        List<CycleCountDto> data = countPage.getContent().stream().map(this::toDto).toList();
        return ResponseEntity.ok(new PagedCycleCountResponse(
                data,
                countPage.getNumber(),
                countPage.getSize(),
                countPage.getTotalElements(),
                countPage.getTotalPages()
        ));
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
            notifyCycleCountEvent(
                    "Cycle Count Scheduled",
                    "Cycle count " + created.getCountNumber() + " was scheduled.",
                    created,
                    "scheduled"
            );
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
                    request.assignedWorkers() != null
                            ? request.assignedWorkers().stream().map(UUID::fromString).toArray(UUID[]::new)
                            : null,
                    request.status(),
                    request.notes()
            );
            notifyCycleCountEvent(
                    "Cycle Count Updated",
                    "Cycle count " + updated.getCountNumber() + " was updated.",
                    updated,
                    "updated"
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
                    null,
                    "cancelled",
                    request.reason()
            );
            notifyCycleCountEvent(
                    "Cycle Count Cancelled",
                    "Cycle count " + updated.getCountNumber() + " was cancelled.",
                    updated,
                    "cancelled"
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
            try {
                CycleCountService.CycleCount count = service.findById(id);
                notifyCycleCountEvent(
                        "Cycle Count Recorded",
                        "A count was recorded for " + count.getCountNumber() + ".",
                        count,
                        "recorded"
                );
            } catch (RuntimeException ignored) {
            }
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
            notifyCycleCountEvent(
                    "Cycle Count Adjustment Approved",
                    "Adjustment for cycle count " + updated.getCountNumber() + " was approved.",
                    updated,
                    "adjustment_approved"
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
            notifyCycleCountEvent(
                    "Cycle Count Adjustment Rejected",
                    "Adjustment for cycle count " + updated.getCountNumber() + " was rejected.",
                    updated,
                    "adjustment_rejected"
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
                count.getScheduledDate() != null ? count.getScheduledDate().toString() : null,
                count.getAssignedWorkers() != null
                        ? java.util.Arrays.stream(count.getAssignedWorkers()).map(UUID::toString).toList()
                        : java.util.List.of(),
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
                count.getApprovalNotes(),
                count.getCountedBy() != null ? count.getCountedBy().toString() : null,
                count.getCountedAt() != null ? count.getCountedAt().toString() : null,
                count.getNotes()
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
    public record UpdateCycleCountRequest(
            String scheduledDate,
            List<String> assignedWorkers,
            String status,
            String notes
    ) {}
    public record CancelCycleCountRequest(String reason) {}
    public record ReviewCycleCountRequest(String notes) {}
    public record AdjustmentDecisionRequest(String approvedBy, String notes) {}
    public record CycleCountDto(
            String id,
            String countNumber,
            String warehouseId,
            String locationCode,
            String scheduledDate,
            List<String> assignedWorkers,
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
            String approvalNotes,
            String countedBy,
            String countedAt,
            String notes
    ) {}
    public record CycleCountResultDto(boolean success, String message, String variance, boolean recountRequired, boolean approvalRequired) {}

    public record PagedCycleCountResponse(
            List<CycleCountDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) return "createdAt";
        return switch (sortBy) {
            case "id", "countNumber", "warehouseId", "locationCode", "scheduledDate", "status", "countedAt", "createdAt", "updatedAt" -> sortBy;
            default -> "createdAt";
        };
    }

    private void notifyCycleCountEvent(
            String title,
            String message,
            CycleCountService.CycleCount count,
            String eventType
    ) {
        try {
            Notification notification = new Notification();
            notification.setUserId(null);
            notification.setAudienceRoles("admin,warehouse_manager,inbound_coordinator");
            notification.setWarehouseId(count.getWarehouseId());
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setNotificationType("cycle_count");
            notification.setRead(false);
            notification.setActionUrl("/admin/cycle-counts/" + count.getId());
            notification.setMetadata(
                    "{\"cycleCountId\":\"" + count.getId() + "\",\"countNumber\":\"" + count.getCountNumber() + "\",\"status\":\"" + count.getStatus() + "\",\"event\":\"" + eventType + "\"}"
            );
            notification.setCreatedAt(OffsetDateTime.now());
            notificationService.create(notification);
        } catch (Exception ignored) {
            // Notifications must not block cycle count workflows.
        }
    }
}
