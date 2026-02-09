package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.CycleCountService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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
        CycleCountService.CycleCount count = service.findById(id);
        return ResponseEntity.ok(toDto(count));
    }

    @PostMapping
    public ResponseEntity<CycleCountDto> create(@Valid @RequestBody CreateCycleCountRequest request) {
        CycleCountService.CycleCount cycleCount = new CycleCountService.CycleCount();
        cycleCount.setCountNumber(request.countNumber());
        cycleCount.setWarehouseId(UUID.fromString(request.warehouseId()));
        cycleCount.setLocationCode(request.locationCode());
        cycleCount.setScheduledDate(
                request.scheduledDate() != null
                        ? java.time.LocalDate.parse(request.scheduledDate())
                        : java.time.LocalDate.now()
        );
        cycleCount.setStatus(request.status() != null ? request.status() : "scheduled");
        cycleCount.setNotes(request.notes());

        CycleCountService.CycleCount created = service.create(cycleCount);
        return ResponseEntity.ok(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CycleCountDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCycleCountRequest request
    ) {
        CycleCountService.CycleCount updated = service.update(
                id,
                request.scheduledDate() != null ? java.time.LocalDate.parse(request.scheduledDate()) : null,
                request.status(),
                request.notes()
        );
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<CycleCountDto> cancel(
            @PathVariable UUID id,
            @Valid @RequestBody CancelCycleCountRequest request
    ) {
        CycleCountService.CycleCount updated = service.update(
                id,
                null,
                "cancelled",
                request.reason()
        );
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/review")
    public ResponseEntity<CycleCountDto> review(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewCycleCountRequest request
    ) {
        CycleCountService.CycleCount updated = service.update(
                id,
                null,
                null,
                request.notes()
        );
        return ResponseEntity.ok(toDto(updated));
    }

    @PostMapping("/{id}/record")
    public ResponseEntity<CycleCountResultDto> recordCount(
            @PathVariable UUID id,
            @Valid @RequestBody RecordCountRequest request) {
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
                    result.variance().toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new CycleCountResultDto(false, e.getMessage(), null));
        }
    }

    private CycleCountDto toDto(CycleCountService.CycleCount count) {
        return new CycleCountDto(
                count.getId().toString(),
                count.getCountNumber(),
                count.getWarehouseId().toString(),
                count.getLocationCode(),
                count.getStatus(),
                count.getVariance() != null ? count.getVariance().toString() : null
        );
    }

    public record RecordCountRequest(
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String materialId,
            @NotBlank @Pattern(regexp = "^\\d+(\\.\\d+)?$") String countedQuantity,
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String countedBy
    ) {}
    public record CreateCycleCountRequest(
            @NotBlank String countNumber,
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String warehouseId,
            @NotBlank String locationCode,
            String scheduledDate,
            @Pattern(regexp = "(?i)scheduled|in_progress|completed|cancelled") String status,
            String notes
    ) {}
    public record UpdateCycleCountRequest(
            String scheduledDate,
            @Pattern(regexp = "(?i)scheduled|in_progress|completed|cancelled") String status,
            String notes
    ) {}
    public record CancelCycleCountRequest(@NotBlank String reason) {}
    public record ReviewCycleCountRequest(String notes) {}
    public record CycleCountDto(String id, String countNumber, String warehouseId, String locationCode, String status, String variance) {}
    public record CycleCountResultDto(boolean success, String message, String variance) {}
}
