package com.optiwms.coreapp.anomalies;

import com.optiwms.domain.anomalies.Anomaly;
import com.optiwms.infra.anomalies.AnomalyEntity;
import com.optiwms.infra.anomalies.AnomalyRepository;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Anomaly findById(@NonNull UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Anomaly not found: " + id));
    }

    public List<Anomaly> findByStatus(String status) {
        return repository.findByStatus(status).stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Transactional
    public Anomaly resolve(@NonNull UUID id, @NonNull UUID resolvedBy, String resolution) {
        AnomalyEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Anomaly not found: " + id));
        entity.setStatus("resolved");
        entity.setResolvedBy(resolvedBy);
        entity.setResolution(resolution);
        entity.setResolvedAt(LocalDateTime.now());
        AnomalyEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    private Anomaly toDomain(AnomalyEntity entity) {
        Anomaly anomaly = new Anomaly();
        anomaly.setId(entity.getId());
        anomaly.setAnomalyNumber(entity.getAnomalyNumber());
        anomaly.setAnomalyType(entity.getAnomalyType());
        anomaly.setWarehouseId(entity.getWarehouseId());
        anomaly.setMaterialId(entity.getMaterialId());
        anomaly.setLocationCode(entity.getLocationCode());
        anomaly.setSeverity(entity.getSeverity());
        anomaly.setStatus(entity.getStatus());
        anomaly.setDescription(entity.getDescription());
        anomaly.setResolution(entity.getResolution());
        anomaly.setDetectedBy(entity.getDetectedBy());
        anomaly.setResolvedBy(entity.getResolvedBy());
        anomaly.setDetectedAt(entity.getDetectedAt());
        anomaly.setResolvedAt(entity.getResolvedAt());
        return anomaly;
    }
}

