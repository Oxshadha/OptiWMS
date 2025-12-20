package com.optiwms.coreapp.packing;

import com.optiwms.domain.packing.PackingRecord;
import com.optiwms.infra.packing.PackingRecordEntity;
import com.optiwms.infra.packing.PackingRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PackingService {

    private final PackingRecordRepository repository;

    public PackingService(PackingRecordRepository repository) {
        this.repository = repository;
    }

    public List<PackingRecord> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public PackingRecord findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + id));
    }

    public List<PackingRecord> findByOrderId(UUID orderId) {
        return repository.findByOrderId(orderId).stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<PackingRecord> getQueue() {
        return repository.findByStatus("in_progress").stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Transactional
    public PackingRecord create(PackingRecord packing) {
        PackingRecordEntity entity = new PackingRecordEntity();
        entity.setOrderId(packing.getOrderId());
        entity.setOrderNumber(packing.getOrderNumber());
        entity.setPackagingTypeId(packing.getPackagingTypeId());
        entity.setBoxType(packing.getBoxType());
        entity.setBoxDimensions(packing.getBoxDimensions());
        entity.setDunnageMaterials(packing.getDunnageMaterials());
        entity.setHasFragileItems(packing.getHasFragileItems());
        entity.setActualWeightKg(packing.getActualWeightKg());
        entity.setDimensionalWeightKg(packing.getDimensionalWeightKg());
        entity.setChargeableWeightKg(packing.getChargeableWeightKg());
        entity.setTrackingNumber(packing.getTrackingNumber());
        entity.setShippingLabelUrl(packing.getShippingLabelUrl());
        entity.setPackingSlipUrl(packing.getPackingSlipUrl());
        entity.setPackingNotes(packing.getPackingNotes());
        entity.setPackingPhotos(packing.getPackingPhotos());
        entity.setPackerId(packing.getPackerId());
        entity.setStatus(packing.getStatus() != null ? packing.getStatus() : "in_progress");
        entity.setStartedAt(LocalDateTime.now());

        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public PackingRecord complete(UUID id) {
        PackingRecordEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + id));
        entity.setStatus("completed");
        entity.setCompletedAt(LocalDateTime.now());
        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    private PackingRecord toDomain(PackingRecordEntity entity) {
        PackingRecord packing = new PackingRecord();
        packing.setId(entity.getId());
        packing.setOrderId(entity.getOrderId());
        packing.setOrderNumber(entity.getOrderNumber());
        packing.setPackagingTypeId(entity.getPackagingTypeId());
        packing.setBoxType(entity.getBoxType());
        packing.setBoxDimensions(entity.getBoxDimensions());
        packing.setDunnageMaterials(entity.getDunnageMaterials());
        packing.setHasFragileItems(entity.getHasFragileItems());
        packing.setActualWeightKg(entity.getActualWeightKg());
        packing.setDimensionalWeightKg(entity.getDimensionalWeightKg());
        packing.setChargeableWeightKg(entity.getChargeableWeightKg());
        packing.setTrackingNumber(entity.getTrackingNumber());
        packing.setShippingLabelUrl(entity.getShippingLabelUrl());
        packing.setPackingSlipUrl(entity.getPackingSlipUrl());
        packing.setPackingNotes(entity.getPackingNotes());
        packing.setPackingPhotos(entity.getPackingPhotos());
        packing.setPackerId(entity.getPackerId());
        packing.setStatus(entity.getStatus());
        packing.setStartedAt(entity.getStartedAt());
        packing.setCompletedAt(entity.getCompletedAt());
        return packing;
    }
}

