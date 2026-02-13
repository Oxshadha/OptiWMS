package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.PackingService;
import com.optiwms.domain.operations.PackingRecord;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/packing")
public class PackingController {

    private final PackingService service;

    public PackingController(PackingService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<PackingRecordDto>> listAll(
            @RequestParam(required = false) String orderId,
            @RequestParam(required = false) String orderNumber,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String packerId
    ) {
        List<PackingRecord> records;
        if (orderId != null) {
            UUID orderUuid = parseOptionalUuid(orderId);
            records = orderUuid != null ? service.findByOrderId(orderUuid) : List.of();
        } else if (orderNumber != null) {
            records = service.findByOrderNumber(orderNumber);
        } else if (status != null) {
            records = service.findByStatus(status);
        } else if (packerId != null) {
            UUID packerUuid = parseOptionalUuid(packerId);
            records = packerUuid != null ? service.findByPackerId(packerUuid) : List.of();
        } else {
            records = service.listAll();
        }

        List<PackingRecordDto> dtos = records.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PackingRecordDto> getById(@PathVariable UUID id) {
        PackingRecord record = service.findById(id);
        return ResponseEntity.ok(toDto(record));
    }

    @PostMapping
    public ResponseEntity<PackingRecordDto> create(@RequestBody CreatePackingRecordRequest request) {
        PackingRecord record = new PackingRecord();
        record.setOrderId(parseOptionalUuid(request.orderId()));
        record.setOrderNumber(request.orderNumber());
        record.setPackagingTypeId(parseOptionalUuid(request.packagingTypeId()));
        record.setBoxType(request.boxType());
        record.setBoxDimensions(request.boxDimensions());
        record.setDunnageMaterials(request.dunnageMaterials());
        record.setHasFragileItems(request.hasFragileItems());
        record.setActualWeightKg(parseOptionalBigDecimal(request.actualWeightKg()));
        record.setDimensionalWeightKg(parseOptionalBigDecimal(request.dimensionalWeightKg()));
        record.setChargeableWeightKg(parseOptionalBigDecimal(request.chargeableWeightKg()));
        record.setTrackingNumber(request.trackingNumber());
        record.setShippingLabelUrl(request.shippingLabelUrl());
        record.setPackingSlipUrl(request.packingSlipUrl());
        record.setPackingNotes(request.packingNotes());
        record.setPackingPhotos(request.packingPhotos());
        record.setPackerId(parseOptionalUuid(request.packerId()));
        record.setStatus(request.status() != null ? request.status() : "in_progress");

        PackingRecord created = service.create(record);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PackingRecordDto> update(@PathVariable UUID id, @RequestBody UpdatePackingRecordRequest request) {
        PackingRecord record = service.findById(id);
        if (request.boxType() != null) record.setBoxType(request.boxType());
        if (request.boxDimensions() != null) record.setBoxDimensions(request.boxDimensions());
        if (request.dunnageMaterials() != null) record.setDunnageMaterials(request.dunnageMaterials());
        if (request.hasFragileItems() != null) record.setHasFragileItems(request.hasFragileItems());
        if (request.actualWeightKg() != null) record.setActualWeightKg(parseOptionalBigDecimal(request.actualWeightKg()));
        if (request.dimensionalWeightKg() != null) record.setDimensionalWeightKg(parseOptionalBigDecimal(request.dimensionalWeightKg()));
        if (request.chargeableWeightKg() != null) record.setChargeableWeightKg(parseOptionalBigDecimal(request.chargeableWeightKg()));
        if (request.trackingNumber() != null) record.setTrackingNumber(request.trackingNumber());
        if (request.packingNotes() != null) record.setPackingNotes(request.packingNotes());
        if (request.packerId() != null) record.setPackerId(parseOptionalUuid(request.packerId()));
        if (request.status() != null) record.setStatus(request.status());

        PackingRecord updated = service.update(record);
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<PackingRecordDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody UpdateStatusRequest request
    ) {
        UUID workerId = parseOptionalUuid(request.workerId());
        PackingRecord updated = service.updateStatusWithWorker(id, request.status(), workerId);
        return ResponseEntity.ok(toDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private PackingRecordDto toDto(PackingRecord record) {
        return new PackingRecordDto(
                record.getId().toString(),
                record.getOrderId() != null ? record.getOrderId().toString() : null,
                record.getOrderNumber(),
                record.getPackagingTypeId() != null ? record.getPackagingTypeId().toString() : null,
                record.getBoxType(),
                record.getBoxDimensions(),
                record.getDunnageMaterials(),
                record.getHasFragileItems(),
                record.getActualWeightKg() != null ? record.getActualWeightKg().toString() : null,
                record.getDimensionalWeightKg() != null ? record.getDimensionalWeightKg().toString() : null,
                record.getChargeableWeightKg() != null ? record.getChargeableWeightKg().toString() : null,
                record.getTrackingNumber(),
                record.getShippingLabelUrl(),
                record.getPackingSlipUrl(),
                record.getPackingNotes(),
                record.getPackingPhotos(),
                record.getPackerId() != null ? record.getPackerId().toString() : null,
                record.getStatus(),
                record.getStartedAt() != null ? record.getStartedAt().toString() : null,
                record.getCompletedAt() != null ? record.getCompletedAt().toString() : null
        );
    }

    public record CreatePackingRecordRequest(
            String orderId,
            String orderNumber,
            String packagingTypeId,
            String boxType,
            String boxDimensions,
            String dunnageMaterials,
            Boolean hasFragileItems,
            String actualWeightKg,
            String dimensionalWeightKg,
            String chargeableWeightKg,
            String trackingNumber,
            String shippingLabelUrl,
            String packingSlipUrl,
            String packingNotes,
            String packingPhotos,
            String packerId,
            String status
    ) {}

    public record UpdatePackingRecordRequest(
            String boxType,
            String boxDimensions,
            String dunnageMaterials,
            Boolean hasFragileItems,
            String actualWeightKg,
            String dimensionalWeightKg,
            String chargeableWeightKg,
            String trackingNumber,
            String packingNotes,
            String packerId,
            String status
    ) {}

    public record UpdateStatusRequest(String status, String workerId) {}

    public record PackingRecordDto(
            String id,
            String orderId,
            String orderNumber,
            String packagingTypeId,
            String boxType,
            String boxDimensions,
            String dunnageMaterials,
            Boolean hasFragileItems,
            String actualWeightKg,
            String dimensionalWeightKg,
            String chargeableWeightKg,
            String trackingNumber,
            String shippingLabelUrl,
            String packingSlipUrl,
            String packingNotes,
            String packingPhotos,
            String packerId,
            String status,
            String startedAt,
            String completedAt
    ) {}

    private UUID parseOptionalUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private BigDecimal parseOptionalBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
