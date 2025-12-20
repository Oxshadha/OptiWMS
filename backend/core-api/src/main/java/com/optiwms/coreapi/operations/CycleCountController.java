package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.CycleCountService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
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
    public ResponseEntity<CycleCountDto> getById(@PathVariable @NonNull UUID id) {
        try {
            CycleCountService.CycleCount count = service.findById(id);
            return ResponseEntity.ok(toDto(count));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/record")
    public ResponseEntity<CycleCountResultDto> recordCount(
            @PathVariable @NonNull UUID id,
            @RequestBody RecordCountRequest request) {
        try {
            var materialId = UUID.fromString(request.materialId());
            var countedBy = UUID.fromString(request.countedBy());
            var result = service.recordCount(
                    id,
                    materialId,
                    new BigDecimal(request.countedQuantity()),
                    countedBy
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

    public record RecordCountRequest(String materialId, String countedQuantity, String countedBy) {}
    public record CycleCountDto(String id, String countNumber, String warehouseId, String locationCode, String status, String variance) {}
    public record CycleCountResultDto(boolean success, String message, String variance) {}
}

