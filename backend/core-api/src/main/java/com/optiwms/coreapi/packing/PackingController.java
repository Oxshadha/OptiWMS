package com.optiwms.coreapi.packing;

import com.optiwms.coreapp.packing.PackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/packing")
public class PackingController {

    private final PackingService service;

    public PackingController(PackingService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<PackingDto>> list() {
        var data = service.listAll().stream()
                .map(p -> new PackingDto(
                        p.getId(),
                        p.getOrderId(),
                        p.getOrderNumber(),
                        p.getPackagingTypeId(),
                        p.getBoxType(),
                        p.getBoxDimensions(),
                        p.getDunnageMaterials(),
                        p.getHasFragileItems(),
                        p.getActualWeightKg(),
                        p.getDimensionalWeightKg(),
                        p.getChargeableWeightKg(),
                        p.getTrackingNumber(),
                        p.getShippingLabelUrl(),
                        p.getPackingSlipUrl(),
                        p.getPackingNotes(),
                        p.getPackingPhotos(),
                        p.getPackerId(),
                        p.getStatus(),
                        p.getStartedAt(),
                        p.getCompletedAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PackingDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var packing = service.findById(id);
            return ResponseEntity.ok(new PackingDto(
                    packing.getId(),
                    packing.getOrderId(),
                    packing.getOrderNumber(),
                    packing.getPackagingTypeId(),
                    packing.getBoxType(),
                    packing.getBoxDimensions(),
                    packing.getDunnageMaterials(),
                    packing.getHasFragileItems(),
                    packing.getActualWeightKg(),
                    packing.getDimensionalWeightKg(),
                    packing.getChargeableWeightKg(),
                    packing.getTrackingNumber(),
                    packing.getShippingLabelUrl(),
                    packing.getPackingSlipUrl(),
                    packing.getPackingNotes(),
                    packing.getPackingPhotos(),
                    packing.getPackerId(),
                    packing.getStatus(),
                    packing.getStartedAt(),
                    packing.getCompletedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/queue")
    public ResponseEntity<List<PackingDto>> getQueue() {
        var data = service.getQueue().stream()
                .map(p -> new PackingDto(
                        p.getId(),
                        p.getOrderId(),
                        p.getOrderNumber(),
                        p.getPackagingTypeId(),
                        p.getBoxType(),
                        p.getBoxDimensions(),
                        p.getDunnageMaterials(),
                        p.getHasFragileItems(),
                        p.getActualWeightKg(),
                        p.getDimensionalWeightKg(),
                        p.getChargeableWeightKg(),
                        p.getTrackingNumber(),
                        p.getShippingLabelUrl(),
                        p.getPackingSlipUrl(),
                        p.getPackingNotes(),
                        p.getPackingPhotos(),
                        p.getPackerId(),
                        p.getStatus(),
                        p.getStartedAt(),
                        p.getCompletedAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @PostMapping
    public ResponseEntity<PackingDto> create(@RequestBody CreatePackingRequest request) {
        try {
            var packing = new com.optiwms.domain.packing.PackingRecord();
            packing.setOrderId(request.orderId());
            packing.setOrderNumber(request.orderNumber());
            packing.setPackagingTypeId(request.packagingTypeId());
            packing.setBoxType(request.boxType());
            packing.setBoxDimensions(request.boxDimensions());
            packing.setDunnageMaterials(request.dunnageMaterials());
            packing.setHasFragileItems(request.hasFragileItems());
            packing.setActualWeightKg(request.actualWeightKg());
            packing.setDimensionalWeightKg(request.dimensionalWeightKg());
            packing.setChargeableWeightKg(request.chargeableWeightKg());
            packing.setTrackingNumber(request.trackingNumber());
            packing.setShippingLabelUrl(request.shippingLabelUrl());
            packing.setPackingSlipUrl(request.packingSlipUrl());
            packing.setPackingNotes(request.packingNotes());
            packing.setPackingPhotos(request.packingPhotos());
            packing.setPackerId(request.packerId());
            packing.setStatus(request.status());

            var created = service.create(packing);
            return ResponseEntity.ok(new PackingDto(
                    created.getId(),
                    created.getOrderId(),
                    created.getOrderNumber(),
                    created.getPackagingTypeId(),
                    created.getBoxType(),
                    created.getBoxDimensions(),
                    created.getDunnageMaterials(),
                    created.getHasFragileItems(),
                    created.getActualWeightKg(),
                    created.getDimensionalWeightKg(),
                    created.getChargeableWeightKg(),
                    created.getTrackingNumber(),
                    created.getShippingLabelUrl(),
                    created.getPackingSlipUrl(),
                    created.getPackingNotes(),
                    created.getPackingPhotos(),
                    created.getPackerId(),
                    created.getStatus(),
                    created.getStartedAt(),
                    created.getCompletedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<PackingDto> complete(@PathVariable @NonNull java.util.UUID id) {
        try {
            var packing = service.complete(id);
            return ResponseEntity.ok(new PackingDto(
                    packing.getId(),
                    packing.getOrderId(),
                    packing.getOrderNumber(),
                    packing.getPackagingTypeId(),
                    packing.getBoxType(),
                    packing.getBoxDimensions(),
                    packing.getDunnageMaterials(),
                    packing.getHasFragileItems(),
                    packing.getActualWeightKg(),
                    packing.getDimensionalWeightKg(),
                    packing.getChargeableWeightKg(),
                    packing.getTrackingNumber(),
                    packing.getShippingLabelUrl(),
                    packing.getPackingSlipUrl(),
                    packing.getPackingNotes(),
                    packing.getPackingPhotos(),
                    packing.getPackerId(),
                    packing.getStatus(),
                    packing.getStartedAt(),
                    packing.getCompletedAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record PackingDto(
            java.util.UUID id,
            java.util.UUID orderId,
            String orderNumber,
            java.util.UUID packagingTypeId,
            String boxType,
            String boxDimensions,
            String dunnageMaterials,
            Boolean hasFragileItems,
            java.math.BigDecimal actualWeightKg,
            java.math.BigDecimal dimensionalWeightKg,
            java.math.BigDecimal chargeableWeightKg,
            String trackingNumber,
            String shippingLabelUrl,
            String packingSlipUrl,
            String packingNotes,
            String packingPhotos,
            java.util.UUID packerId,
            String status,
            java.time.LocalDateTime startedAt,
            java.time.LocalDateTime completedAt
    ) {}

    public record CreatePackingRequest(
            java.util.UUID orderId,
            String orderNumber,
            java.util.UUID packagingTypeId,
            String boxType,
            String boxDimensions,
            String dunnageMaterials,
            Boolean hasFragileItems,
            java.math.BigDecimal actualWeightKg,
            java.math.BigDecimal dimensionalWeightKg,
            java.math.BigDecimal chargeableWeightKg,
            String trackingNumber,
            String shippingLabelUrl,
            String packingSlipUrl,
            String packingNotes,
            String packingPhotos,
            java.util.UUID packerId,
            String status
    ) {}
}

