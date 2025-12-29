package com.optiwms.coreapp.operations;

import com.optiwms.domain.operations.PackingRecord;
import com.optiwms.infra.operations.PackingRecordEntity;
import com.optiwms.infra.operations.PackingRecordRepository;
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
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByOrderId(UUID orderId) {
        return repository.findByOrderId(orderId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByOrderNumber(String orderNumber) {
        return repository.findByOrderNumber(orderNumber).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<PackingRecord> findByPackerId(UUID packerId) {
        return repository.findByPackerId(packerId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public PackingRecord findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + id));
    }

    @Transactional
    public PackingRecord create(PackingRecord packingRecord) {
        PackingRecordEntity entity = new PackingRecordEntity();
        entity.setOrderId(packingRecord.getOrderId());
        entity.setOrderNumber(packingRecord.getOrderNumber());
        entity.setPackagingTypeId(packingRecord.getPackagingTypeId());
        entity.setBoxType(packingRecord.getBoxType());
        entity.setBoxDimensions(packingRecord.getBoxDimensions());
        entity.setDunnageMaterials(packingRecord.getDunnageMaterials());
        entity.setHasFragileItems(packingRecord.getHasFragileItems() != null ? packingRecord.getHasFragileItems() : false);
        entity.setActualWeightKg(packingRecord.getActualWeightKg());
        entity.setDimensionalWeightKg(packingRecord.getDimensionalWeightKg());
        entity.setChargeableWeightKg(packingRecord.getChargeableWeightKg());
        entity.setTrackingNumber(packingRecord.getTrackingNumber());
        entity.setShippingLabelUrl(packingRecord.getShippingLabelUrl());
        entity.setPackingSlipUrl(packingRecord.getPackingSlipUrl());
        entity.setPackingNotes(packingRecord.getPackingNotes());
        entity.setPackingPhotos(packingRecord.getPackingPhotos());
        entity.setPackerId(packingRecord.getPackerId());
        entity.setStatus(packingRecord.getStatus() != null ? packingRecord.getStatus() : "in_progress");
        entity.setStartedAt(packingRecord.getStartedAt() != null ? packingRecord.getStartedAt() : LocalDateTime.now());

        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public PackingRecord updateStatus(UUID id, String status) {
        PackingRecordEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + id));
        entity.setStatus(status);
        if ("completed".equals(status) && entity.getCompletedAt() == null) {
            entity.setCompletedAt(LocalDateTime.now());
        }
        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public PackingRecord update(PackingRecord packingRecord) {
        PackingRecordEntity entity = repository.findById(packingRecord.getId())
                .orElseThrow(() -> new RuntimeException("Packing record not found: " + packingRecord.getId()));

        if (packingRecord.getBoxType() != null) entity.setBoxType(packingRecord.getBoxType());
        if (packingRecord.getBoxDimensions() != null) entity.setBoxDimensions(packingRecord.getBoxDimensions());
        if (packingRecord.getDunnageMaterials() != null) entity.setDunnageMaterials(packingRecord.getDunnageMaterials());
        if (packingRecord.getHasFragileItems() != null) entity.setHasFragileItems(packingRecord.getHasFragileItems());
        if (packingRecord.getActualWeightKg() != null) entity.setActualWeightKg(packingRecord.getActualWeightKg());
        if (packingRecord.getDimensionalWeightKg() != null) entity.setDimensionalWeightKg(packingRecord.getDimensionalWeightKg());
        if (packingRecord.getChargeableWeightKg() != null) entity.setChargeableWeightKg(packingRecord.getChargeableWeightKg());
        if (packingRecord.getTrackingNumber() != null) entity.setTrackingNumber(packingRecord.getTrackingNumber());
        if (packingRecord.getPackingNotes() != null) entity.setPackingNotes(packingRecord.getPackingNotes());
        if (packingRecord.getStatus() != null) entity.setStatus(packingRecord.getStatus());

        PackingRecordEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private PackingRecord toDomain(PackingRecordEntity entity) {
        PackingRecord p = new PackingRecord();
        p.setId(entity.getId());
        p.setOrderId(entity.getOrderId());
        p.setOrderNumber(entity.getOrderNumber());
        p.setPackagingTypeId(entity.getPackagingTypeId());
        p.setBoxType(entity.getBoxType());
        p.setBoxDimensions(entity.getBoxDimensions());
        p.setDunnageMaterials(entity.getDunnageMaterials());
        p.setHasFragileItems(entity.getHasFragileItems());
        p.setActualWeightKg(entity.getActualWeightKg());
        p.setDimensionalWeightKg(entity.getDimensionalWeightKg());
        p.setChargeableWeightKg(entity.getChargeableWeightKg());
        p.setTrackingNumber(entity.getTrackingNumber());
        p.setShippingLabelUrl(entity.getShippingLabelUrl());
        p.setPackingSlipUrl(entity.getPackingSlipUrl());
        p.setPackingNotes(entity.getPackingNotes());
        p.setPackingPhotos(entity.getPackingPhotos());
        p.setPackerId(entity.getPackerId());
        p.setStatus(entity.getStatus());
        p.setStartedAt(entity.getStartedAt());
        p.setCompletedAt(entity.getCompletedAt());
        p.setCreatedAt(entity.getCreatedAt());
        p.setUpdatedAt(entity.getUpdatedAt());
        return p;
    }
}

