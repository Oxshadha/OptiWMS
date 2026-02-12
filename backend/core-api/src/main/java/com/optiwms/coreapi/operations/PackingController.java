package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.PackingService;
import com.optiwms.domain.operations.PackingRecord;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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
            records = service.findByOrderId(UUID.fromString(orderId));
        } else if (orderNumber != null) {
            records = service.findByOrderNumber(orderNumber);
        } else if (status != null) {
            records = service.findByStatus(status);
        } else if (packerId != null) {
            records = service.findByPackerId(UUID.fromString(packerId));
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
    public ResponseEntity<PackingRecordDto> create(@Valid @RequestBody CreatePackingRecordRequest request) {
        PackingRecord record = new PackingRecord();
        record.setOrderId(request.orderId() != null ? UUID.fromString(request.orderId()) : null);
        record.setOrderNumber(request.orderNumber());
        record.setPackagingTypeId(request.packagingTypeId() != null ? UUID.fromString(request.packagingTypeId()) : null);
        record.setBoxType(request.boxType());
        record.setBoxDimensions(request.boxDimensions());
        record.setDunnageMaterials(request.dunnageMaterials());
        record.setHasFragileItems(request.hasFragileItems());
        record.setActualWeightKg(request.actualWeightKg() != null ? new BigDecimal(request.actualWeightKg()) : null);
        record.setDimensionalWeightKg(request.dimensionalWeightKg() != null ? new BigDecimal(request.dimensionalWeightKg()) : null);
        record.setChargeableWeightKg(request.chargeableWeightKg() != null ? new BigDecimal(request.chargeableWeightKg()) : null);
        record.setTrackingNumber(request.trackingNumber());
        record.setShippingLabelUrl(request.shippingLabelUrl());
        record.setPackingSlipUrl(request.packingSlipUrl());
        record.setPackingNotes(request.packingNotes());
        record.setPackingPhotos(request.packingPhotos());
        record.setPackerId(request.packerId() != null ? UUID.fromString(request.packerId()) : null);
        record.setStatus(request.status() != null ? request.status() : "in_progress");

        PackingRecord created = service.create(record);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PackingRecordDto> update(@PathVariable UUID id, @Valid @RequestBody UpdatePackingRecordRequest request) {
        PackingRecord record = service.findById(id);
        if (request.boxType() != null) record.setBoxType(request.boxType());
        if (request.boxDimensions() != null) record.setBoxDimensions(request.boxDimensions());
        if (request.dunnageMaterials() != null) record.setDunnageMaterials(request.dunnageMaterials());
        if (request.hasFragileItems() != null) record.setHasFragileItems(request.hasFragileItems());
        if (request.actualWeightKg() != null) record.setActualWeightKg(new BigDecimal(request.actualWeightKg()));
        if (request.dimensionalWeightKg() != null) record.setDimensionalWeightKg(new BigDecimal(request.dimensionalWeightKg()));
        if (request.chargeableWeightKg() != null) record.setChargeableWeightKg(new BigDecimal(request.chargeableWeightKg()));
        if (request.trackingNumber() != null) record.setTrackingNumber(request.trackingNumber());
        if (request.packingNotes() != null) record.setPackingNotes(request.packingNotes());
        if (request.status() != null) record.setStatus(request.status());

        PackingRecord updated = service.update(record);
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<PackingRecordDto> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStatusRequest request
    ) {
        UUID workerId = request.workerId() != null ? UUID.fromString(request.workerId()) : null;
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
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String orderId,
            String orderNumber,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String packagingTypeId,
            String boxType,
            String boxDimensions,
            String dunnageMaterials,
            Boolean hasFragileItems,
            @Pattern(regexp = "^-?\\d+(\\.\\d+)?$") String actualWeightKg,
            @Pattern(regexp = "^-?\\d+(\\.\\d+)?$") String dimensionalWeightKg,
            @Pattern(regexp = "^-?\\d+(\\.\\d+)?$") String chargeableWeightKg,
            String trackingNumber,
            String shippingLabelUrl,
            String packingSlipUrl,
            String packingNotes,
            String packingPhotos,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String packerId,
            @Pattern(regexp = "^[A-Za-z_]+$") String status
    ) {}

    public record UpdatePackingRecordRequest(
            String boxType,
            String boxDimensions,
            String dunnageMaterials,
            Boolean hasFragileItems,
            @Pattern(regexp = "^-?\\d+(\\.\\d+)?$") String actualWeightKg,
            @Pattern(regexp = "^-?\\d+(\\.\\d+)?$") String dimensionalWeightKg,
            @Pattern(regexp = "^-?\\d+(\\.\\d+)?$") String chargeableWeightKg,
            String trackingNumber,
            String packingNotes,
            @Pattern(regexp = "^[A-Za-z_]+$") String status
    ) {}

    public record UpdateStatusRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z_]+$") String status,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String workerId
    ) {}

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
}
