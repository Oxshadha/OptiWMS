package com.optiwms.coreapp.operations;

import com.optiwms.domain.operations.ReturnRecord;
import com.optiwms.infra.operations.ReturnEntity;
import com.optiwms.infra.operations.ReturnRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReturnService {

    private final ReturnRepository repository;

    public ReturnService(ReturnRepository repository) {
        this.repository = repository;
    }

    public List<ReturnRecord> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<ReturnRecord> findByOrderId(UUID orderId) {
        return repository.findByOriginalOrderId(orderId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<ReturnRecord> findByCustomerId(UUID customerId) {
        return repository.findByCustomerId(customerId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<ReturnRecord> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public ReturnRecord findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
    }

    @Transactional
    public ReturnRecord create(ReturnRecord returnRecord) {
        if (repository.findByReturnNumber(returnRecord.getReturnNumber()).isPresent()) {
            throw new RuntimeException("Return number already exists: " + returnRecord.getReturnNumber());
        }

        ReturnEntity entity = new ReturnEntity();
        entity.setReturnNumber(returnRecord.getReturnNumber());
        entity.setOriginalOrderId(returnRecord.getOriginalOrderId());
        entity.setCustomerId(returnRecord.getCustomerId());
        entity.setWarehouseId(returnRecord.getWarehouseId());
        entity.setReturnDate(returnRecord.getReturnDate());
        entity.setReason(returnRecord.getReason());
        entity.setStatus(returnRecord.getStatus() != null ? returnRecord.getStatus() : "pending");
        entity.setResolution(returnRecord.getResolution());
        entity.setReceivedBy(returnRecord.getReceivedBy());
        entity.setInspectedBy(returnRecord.getInspectedBy());

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord updateStatus(UUID id, String status) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        entity.setStatus(status);
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord update(ReturnRecord returnRecord) {
        ReturnEntity entity = repository.findById(returnRecord.getId())
                .orElseThrow(() -> new RuntimeException("Return not found: " + returnRecord.getId()));

        entity.setReason(returnRecord.getReason());
        entity.setResolution(returnRecord.getResolution());
        entity.setReceivedBy(returnRecord.getReceivedBy());
        entity.setInspectedBy(returnRecord.getInspectedBy());
        if (returnRecord.getStatus() != null) {
            entity.setStatus(returnRecord.getStatus());
        }

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord approve(UUID id, UUID approvedBy) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        entity.setStatus("approved");
        if (approvedBy != null) {
            entity.setReceivedBy(approvedBy);
        }
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord submitInspection(UUID id, String overallResolution, String notes, UUID inspectedBy) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        String resolution = overallResolution;
        if (notes != null && !notes.isBlank()) {
            resolution = (overallResolution == null || overallResolution.isBlank())
                    ? notes
                    : overallResolution + " | Notes: " + notes;
        }

        entity.setResolution(resolution);
        entity.setStatus("inspected");
        if (inspectedBy != null) {
            entity.setInspectedBy(inspectedBy);
        }
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ReturnRecord assignWorker(UUID id, UUID workerId) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        // No dedicated assignee field exists yet; persist assignment via receivedBy.
        entity.setReceivedBy(workerId);
        if ("pending".equals(entity.getStatus())) {
            entity.setStatus("assigned");
        }
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private ReturnRecord toDomain(ReturnEntity entity) {
        ReturnRecord r = new ReturnRecord();
        r.setId(entity.getId());
        r.setReturnNumber(entity.getReturnNumber());
        r.setOriginalOrderId(entity.getOriginalOrderId());
        r.setCustomerId(entity.getCustomerId());
        r.setWarehouseId(entity.getWarehouseId());
        r.setReturnDate(entity.getReturnDate());
        r.setReason(entity.getReason());
        r.setStatus(entity.getStatus());
        r.setResolution(entity.getResolution());
        r.setReceivedBy(entity.getReceivedBy());
        r.setInspectedBy(entity.getInspectedBy());
        r.setCreatedAt(entity.getCreatedAt());
        return r;
    }
}
