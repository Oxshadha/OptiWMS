package com.optiwms.coreapp.returns;

import com.optiwms.domain.returns.Return;
import com.optiwms.infra.returns.ReturnEntity;
import com.optiwms.infra.returns.ReturnRepository;
import org.springframework.lang.NonNull;
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

    public List<Return> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Return findById(@NonNull UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
    }

    public Return findByReturnNumber(String returnNumber) {
        return repository.findByReturnNumber(returnNumber)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Return not found: " + returnNumber));
    }

    @Transactional
    public Return register(Return returnObj) {
        if (repository.findByReturnNumber(returnObj.getReturnNumber()).isPresent()) {
            throw new RuntimeException("Return number already exists: " + returnObj.getReturnNumber());
        }

        ReturnEntity entity = new ReturnEntity();
        entity.setReturnNumber(returnObj.getReturnNumber());
        entity.setOriginalOrderId(returnObj.getOriginalOrderId());
        entity.setCustomerId(returnObj.getCustomerId());
        entity.setWarehouseId(returnObj.getWarehouseId());
        entity.setReturnDate(returnObj.getReturnDate());
        entity.setReason(returnObj.getReason());
        entity.setStatus(returnObj.getStatus() != null ? returnObj.getStatus() : "pending");
        entity.setReceivedBy(returnObj.getReceivedBy());

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Return update(@NonNull UUID id, Return returnObj) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));

        entity.setOriginalOrderId(returnObj.getOriginalOrderId());
        entity.setCustomerId(returnObj.getCustomerId());
        entity.setWarehouseId(returnObj.getWarehouseId());
        entity.setReturnDate(returnObj.getReturnDate());
        entity.setReason(returnObj.getReason());
        entity.setStatus(returnObj.getStatus());
        entity.setResolution(returnObj.getResolution());

        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Return process(@NonNull UUID id) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        entity.setStatus("processed");
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Return inspect(@NonNull UUID id, @NonNull UUID inspectedBy, String resolution) {
        ReturnEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        entity.setInspectedBy(inspectedBy);
        entity.setResolution(resolution);
        entity.setStatus("inspected");
        ReturnEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    private Return toDomain(ReturnEntity entity) {
        Return returnObj = new Return();
        returnObj.setId(entity.getId());
        returnObj.setReturnNumber(entity.getReturnNumber());
        returnObj.setOriginalOrderId(entity.getOriginalOrderId());
        returnObj.setCustomerId(entity.getCustomerId());
        returnObj.setWarehouseId(entity.getWarehouseId());
        returnObj.setReturnDate(entity.getReturnDate());
        returnObj.setReason(entity.getReason());
        returnObj.setStatus(entity.getStatus());
        returnObj.setResolution(entity.getResolution());
        returnObj.setReceivedBy(entity.getReceivedBy());
        returnObj.setInspectedBy(entity.getInspectedBy());
        return returnObj;
    }
}

