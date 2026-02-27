package com.optiwms.coreapp.anomalies;

import com.optiwms.domain.anomalies.Anomaly;
import com.optiwms.infra.anomalies.AnomalyEntity;
import com.optiwms.infra.anomalies.AnomalyRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AnomalyService {

    private final AnomalyRepository repository;

    public AnomalyService(AnomalyRepository repository) {
        this.repository = repository;
    }

    public List<Anomaly> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Anomaly> findByWarehouseId(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Anomaly> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Anomaly> findBySeverity(String severity) {
        return repository.findBySeverity(severity).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Page<Anomaly> findPaged(
            UUID warehouseId,
            String status,
            String severity,
            String domain,
            String query,
            Pageable pageable
    ) {
        Specification<AnomalyEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (severity != null && !severity.isBlank()) {
                predicates.add(cb.equal(root.get("severity"), severity));
            }
            if (domain != null && !domain.isBlank()) {
                String d = domain.toLowerCase();
                if ("cycle_count".equals(d)) {
                    predicates.add(cb.like(cb.upper(root.get("anomalyType")), "%CYCLE_COUNT%"));
                } else if ("picking".equals(d)) {
                    predicates.add(cb.like(cb.upper(root.get("anomalyType")), "%PICKING%"));
                } else if ("other".equals(d)) {
                    predicates.add(cb.and(
                            cb.notLike(cb.upper(root.get("anomalyType")), "%CYCLE_COUNT%"),
                            cb.notLike(cb.upper(root.get("anomalyType")), "%PICKING%")
                    ));
                }
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("anomalyType")), pattern),
                        cb.like(cb.lower(root.get("severity")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    public Anomaly findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Anomaly not found: " + id));
    }

    @Transactional
    public Anomaly create(
            String anomalyType,
            UUID materialId,
            UUID warehouseId,
            BigDecimal detectedValue,
            BigDecimal expectedValue,
            BigDecimal variancePercentage,
            String severity,
            String description
    ) {
        AnomalyEntity entity = new AnomalyEntity();
        entity.setAnomalyType(anomalyType);
        entity.setMaterialId(materialId);
        entity.setWarehouseId(warehouseId);
        entity.setDetectedValue(detectedValue);
        entity.setExpectedValue(expectedValue);
        entity.setVariancePercentage(variancePercentage);
        entity.setSeverity(severity);
        entity.setDescription(description);
        entity.setStatus("DETECTED");
        entity = repository.save(entity);
        return toDomain(entity);
    }

    @Transactional
    public Anomaly updateStatus(UUID id, String status, UUID reviewedBy, String resolutionNotes) {
        AnomalyEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Anomaly not found: " + id));
        
        entity.setStatus(status);
        if (reviewedBy != null) {
            entity.setReviewedBy(reviewedBy);
            entity.setReviewedAt(OffsetDateTime.now());
        }
        if (resolutionNotes != null) {
            entity.setResolutionNotes(resolutionNotes);
        }
        
        entity = repository.save(entity);
        return toDomain(entity);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private Anomaly toDomain(AnomalyEntity entity) {
        Anomaly anomaly = new Anomaly();
        anomaly.setId(entity.getId());
        anomaly.setAnomalyType(entity.getAnomalyType());
        anomaly.setMaterialId(entity.getMaterialId());
        anomaly.setWarehouseId(entity.getWarehouseId());
        anomaly.setLocationId(entity.getLocationId());
        anomaly.setDetectedValue(entity.getDetectedValue());
        anomaly.setExpectedValue(entity.getExpectedValue());
        anomaly.setVariancePercentage(entity.getVariancePercentage());
        anomaly.setSeverity(entity.getSeverity());
        anomaly.setConfidenceScore(entity.getConfidenceScore());
        anomaly.setDescription(entity.getDescription());
        anomaly.setStatus(entity.getStatus());
        anomaly.setReviewedBy(entity.getReviewedBy());
        anomaly.setReviewedAt(entity.getReviewedAt());
        anomaly.setResolutionNotes(entity.getResolutionNotes());
        anomaly.setCreatedAt(entity.getCreatedAt());
        return anomaly;
    }
}
