package com.optiwms.coreapp.quality;

import com.optiwms.domain.quality.QualityCheck;
import com.optiwms.infra.quality.QualityCheckEntity;
import com.optiwms.infra.quality.QualityCheckRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class QualityCheckService {

    private final QualityCheckRepository repository;

    public QualityCheckService(QualityCheckRepository repository) {
        this.repository = repository;
    }

    public List<QualityCheck> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public QualityCheck findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Quality check not found: " + id));
    }

    @Transactional
    public QualityCheck create(QualityCheck check) {
        if (check.getCheckNumber() != null && repository.findByCheckNumber(check.getCheckNumber()).isPresent()) {
            throw new RuntimeException("Quality check number already exists: " + check.getCheckNumber());
        }

        QualityCheckEntity entity = new QualityCheckEntity();
        entity.setCheckNumber(check.getCheckNumber());
        entity.setOrderId(check.getOrderId());
        entity.setMaterialId(check.getMaterialId());
        entity.setWarehouseId(check.getWarehouseId());
        entity.setCheckType(check.getCheckType());
        entity.setStatus(check.getStatus() != null ? check.getStatus() : "pending");
        entity.setResult(check.getResult());
        entity.setNotes(check.getNotes());
        entity.setCheckedBy(check.getCheckedBy());
        if (check.getCheckedAt() != null) {
            entity.setCheckedAt(check.getCheckedAt());
        }

        QualityCheckEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public QualityCheck update(UUID id, QualityCheck check) {
        QualityCheckEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Quality check not found: " + id));

        entity.setOrderId(check.getOrderId());
        entity.setMaterialId(check.getMaterialId());
        entity.setWarehouseId(check.getWarehouseId());
        entity.setCheckType(check.getCheckType());
        entity.setStatus(check.getStatus());
        entity.setResult(check.getResult());
        entity.setNotes(check.getNotes());
        entity.setCheckedBy(check.getCheckedBy());
        entity.setCheckedAt(check.getCheckedAt() != null ? check.getCheckedAt() : LocalDateTime.now());

        QualityCheckEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    private QualityCheck toDomain(QualityCheckEntity entity) {
        QualityCheck check = new QualityCheck();
        check.setId(entity.getId());
        check.setCheckNumber(entity.getCheckNumber());
        check.setOrderId(entity.getOrderId());
        check.setMaterialId(entity.getMaterialId());
        check.setWarehouseId(entity.getWarehouseId());
        check.setCheckType(entity.getCheckType());
        check.setStatus(entity.getStatus());
        check.setResult(entity.getResult());
        check.setNotes(entity.getNotes());
        check.setCheckedBy(entity.getCheckedBy());
        check.setCheckedAt(entity.getCheckedAt());
        return check;
    }
}

