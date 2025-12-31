package com.optiwms.coreapi.anomalies;

import com.optiwms.coreapp.anomalies.AnomalyService;
import com.optiwms.domain.anomalies.Anomaly;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/anomalies")
public class AnomalyController {

    private final AnomalyService service;

    public AnomalyController(AnomalyService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<AnomalyDto>> listAll(
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity
    ) {
        List<Anomaly> anomalies;
        if (warehouseId != null) {
            anomalies = service.findByWarehouseId(UUID.fromString(warehouseId));
        } else if (status != null) {
            anomalies = service.findByStatus(status);
        } else if (severity != null) {
            anomalies = service.findBySeverity(severity);
        } else {
            anomalies = service.listAll();
        }

        List<AnomalyDto> dtos = anomalies.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AnomalyDto> getById(@PathVariable UUID id) {
        try {
            Anomaly anomaly = service.findById(id);
            return ResponseEntity.ok(toDto(anomaly));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<AnomalyDto> resolve(
            @PathVariable UUID id,
            @RequestBody ResolveAnomalyRequest request
    ) {
        try {
            Anomaly updated = service.updateStatus(
                    id,
                    request.status() != null ? request.status() : "RESOLVED",
                    request.reviewedBy() != null ? UUID.fromString(request.reviewedBy()) : null,
                    request.resolutionNotes()
            );
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

    private AnomalyDto toDto(Anomaly anomaly) {
        return new AnomalyDto(
                anomaly.getId().toString(),
                anomaly.getAnomalyType(),
                anomaly.getMaterialId() != null ? anomaly.getMaterialId().toString() : null,
                anomaly.getWarehouseId() != null ? anomaly.getWarehouseId().toString() : null,
                anomaly.getLocationId() != null ? anomaly.getLocationId().toString() : null,
                anomaly.getDetectedValue() != null ? anomaly.getDetectedValue().toString() : null,
                anomaly.getExpectedValue() != null ? anomaly.getExpectedValue().toString() : null,
                anomaly.getVariancePercentage() != null ? anomaly.getVariancePercentage().toString() : null,
                anomaly.getSeverity(),
                anomaly.getConfidenceScore() != null ? anomaly.getConfidenceScore().toString() : null,
                anomaly.getDescription(),
                anomaly.getStatus(),
                anomaly.getReviewedBy() != null ? anomaly.getReviewedBy().toString() : null,
                anomaly.getReviewedAt() != null ? anomaly.getReviewedAt().toString() : null,
                anomaly.getResolutionNotes()
        );
    }

    public record ResolveAnomalyRequest(
            String status,
            String reviewedBy,
            String resolutionNotes
    ) {}

    public record AnomalyDto(
            String id,
            String anomalyType,
            String materialId,
            String warehouseId,
            String locationId,
            String detectedValue,
            String expectedValue,
            String variancePercentage,
            String severity,
            String confidenceScore,
            String description,
            String status,
            String reviewedBy,
            String reviewedAt,
            String resolutionNotes
    ) {}
}

