package com.optiwms.coreapi.anomalies;

import com.optiwms.coreapp.anomalies.AnomalyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/anomalies")
public class AnomalyController {

    private final AnomalyService service;

    public AnomalyController(AnomalyService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<AnomalyDto>> list() {
        var data = service.listAll().stream()
                .map(a -> new AnomalyDto(
                        a.getId(),
                        a.getAnomalyNumber(),
                        a.getAnomalyType(),
                        a.getWarehouseId(),
                        a.getMaterialId(),
                        a.getLocationCode(),
                        a.getSeverity(),
                        a.getStatus(),
                        a.getDescription(),
                        a.getResolution(),
                        a.getDetectedBy(),
                        a.getResolvedBy(),
                        a.getDetectedAt(),
                        a.getResolvedAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AnomalyDto> getById(@PathVariable java.util.UUID id) {
        try {
            var anomaly = service.findById(id);
            return ResponseEntity.ok(new AnomalyDto(
                    anomaly.getId(),
                    anomaly.getAnomalyNumber(),
                    anomaly.getAnomalyType(),
                    anomaly.getWarehouseId(),
                    anomaly.getMaterialId(),
                    anomaly.getLocationCode(),
                    anomaly.getSeverity(),
                    anomaly.getStatus(),
                    anomaly.getDescription(),
                    anomaly.getResolution(),
                    anomaly.getDetectedBy(),
                    anomaly.getResolvedBy(),
                    anomaly.getDetectedAt(),
                    anomaly.getResolvedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<AnomalyDto> resolve(@PathVariable java.util.UUID id, @RequestBody ResolveAnomalyRequest request) {
        try {
            var anomaly = service.resolve(id, request.resolvedBy(), request.resolution());
            return ResponseEntity.ok(new AnomalyDto(
                    anomaly.getId(),
                    anomaly.getAnomalyNumber(),
                    anomaly.getAnomalyType(),
                    anomaly.getWarehouseId(),
                    anomaly.getMaterialId(),
                    anomaly.getLocationCode(),
                    anomaly.getSeverity(),
                    anomaly.getStatus(),
                    anomaly.getDescription(),
                    anomaly.getResolution(),
                    anomaly.getDetectedBy(),
                    anomaly.getResolvedBy(),
                    anomaly.getDetectedAt(),
                    anomaly.getResolvedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record AnomalyDto(
            java.util.UUID id,
            String anomalyNumber,
            String anomalyType,
            java.util.UUID warehouseId,
            java.util.UUID materialId,
            String locationCode,
            String severity,
            String status,
            String description,
            String resolution,
            java.util.UUID detectedBy,
            java.util.UUID resolvedBy,
            java.time.LocalDateTime detectedAt,
            java.time.LocalDateTime resolvedAt
    ) {}

    public record ResolveAnomalyRequest(
            java.util.UUID resolvedBy,
            String resolution
    ) {}
}

