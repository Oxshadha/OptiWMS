package com.optiwms.coreapp.anomalies;

import com.optiwms.domain.anomalies.Anomaly;
import com.optiwms.infra.anomalies.AnomalyEntity;
import com.optiwms.infra.anomalies.AnomalyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
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

    public Anomaly findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Anomaly not found: " + id));
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
        return anomaly;
    }
}

