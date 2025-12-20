package com.optiwms.coreapi.returns;

import com.optiwms.coreapp.returns.ReturnService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/returns")
public class ReturnController {

    private final ReturnService service;

    public ReturnController(ReturnService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ReturnDto>> list() {
        var data = service.listAll().stream()
                .map(r -> new ReturnDto(
                        r.getId(),
                        r.getReturnNumber(),
                        r.getOriginalOrderId(),
                        r.getCustomerId(),
                        r.getWarehouseId(),
                        r.getReturnDate(),
                        r.getReason(),
                        r.getStatus(),
                        r.getResolution(),
                        r.getReceivedBy(),
                        r.getInspectedBy()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReturnDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var returnObj = service.findById(id);
            return ResponseEntity.ok(new ReturnDto(
                    returnObj.getId(),
                    returnObj.getReturnNumber(),
                    returnObj.getOriginalOrderId(),
                    returnObj.getCustomerId(),
                    returnObj.getWarehouseId(),
                    returnObj.getReturnDate(),
                    returnObj.getReason(),
                    returnObj.getStatus(),
                    returnObj.getResolution(),
                    returnObj.getReceivedBy(),
                    returnObj.getInspectedBy()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<ReturnDto> register(@RequestBody CreateReturnRequest request) {
        try {
            var returnObj = new com.optiwms.domain.returns.Return();
            returnObj.setReturnNumber(request.returnNumber());
            returnObj.setOriginalOrderId(request.originalOrderId());
            returnObj.setCustomerId(request.customerId());
            returnObj.setWarehouseId(request.warehouseId());
            returnObj.setReturnDate(request.returnDate());
            returnObj.setReason(request.reason());
            returnObj.setStatus(request.status());
            returnObj.setReceivedBy(request.receivedBy());

            var created = service.register(returnObj);
            return ResponseEntity.ok(new ReturnDto(
                    created.getId(),
                    created.getReturnNumber(),
                    created.getOriginalOrderId(),
                    created.getCustomerId(),
                    created.getWarehouseId(),
                    created.getReturnDate(),
                    created.getReason(),
                    created.getStatus(),
                    created.getResolution(),
                    created.getReceivedBy(),
                    created.getInspectedBy()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReturnDto> update(@PathVariable @NonNull java.util.UUID id, @RequestBody UpdateReturnRequest request) {
        try {
            var returnObj = new com.optiwms.domain.returns.Return();
            returnObj.setOriginalOrderId(request.originalOrderId());
            returnObj.setCustomerId(request.customerId());
            returnObj.setWarehouseId(request.warehouseId());
            returnObj.setReturnDate(request.returnDate());
            returnObj.setReason(request.reason());
            returnObj.setStatus(request.status());
            returnObj.setResolution(request.resolution());

            var updated = service.update(id, returnObj);
            return ResponseEntity.ok(new ReturnDto(
                    updated.getId(),
                    updated.getReturnNumber(),
                    updated.getOriginalOrderId(),
                    updated.getCustomerId(),
                    updated.getWarehouseId(),
                    updated.getReturnDate(),
                    updated.getReason(),
                    updated.getStatus(),
                    updated.getResolution(),
                    updated.getReceivedBy(),
                    updated.getInspectedBy()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/process")
    public ResponseEntity<ReturnDto> process(@PathVariable @NonNull java.util.UUID id) {
        try {
            var returnObj = service.process(id);
            return ResponseEntity.ok(new ReturnDto(
                    returnObj.getId(),
                    returnObj.getReturnNumber(),
                    returnObj.getOriginalOrderId(),
                    returnObj.getCustomerId(),
                    returnObj.getWarehouseId(),
                    returnObj.getReturnDate(),
                    returnObj.getReason(),
                    returnObj.getStatus(),
                    returnObj.getResolution(),
                    returnObj.getReceivedBy(),
                    returnObj.getInspectedBy()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/inspect")
    public ResponseEntity<ReturnDto> inspect(@PathVariable @NonNull java.util.UUID id, @RequestBody InspectReturnRequest request) {
        try {
            var inspectedBy = Objects.requireNonNull(request.inspectedBy(), "inspectedBy cannot be null");
            var returnObj = service.inspect(id, inspectedBy, request.resolution());
            return ResponseEntity.ok(new ReturnDto(
                    returnObj.getId(),
                    returnObj.getReturnNumber(),
                    returnObj.getOriginalOrderId(),
                    returnObj.getCustomerId(),
                    returnObj.getWarehouseId(),
                    returnObj.getReturnDate(),
                    returnObj.getReason(),
                    returnObj.getStatus(),
                    returnObj.getResolution(),
                    returnObj.getReceivedBy(),
                    returnObj.getInspectedBy()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record ReturnDto(
            java.util.UUID id,
            String returnNumber,
            java.util.UUID originalOrderId,
            java.util.UUID customerId,
            java.util.UUID warehouseId,
            java.time.LocalDate returnDate,
            String reason,
            String status,
            String resolution,
            java.util.UUID receivedBy,
            java.util.UUID inspectedBy
    ) {}

    public record CreateReturnRequest(
            String returnNumber,
            java.util.UUID originalOrderId,
            java.util.UUID customerId,
            java.util.UUID warehouseId,
            java.time.LocalDate returnDate,
            String reason,
            String status,
            java.util.UUID receivedBy
    ) {}

    public record UpdateReturnRequest(
            java.util.UUID originalOrderId,
            java.util.UUID customerId,
            java.util.UUID warehouseId,
            java.time.LocalDate returnDate,
            String reason,
            String status,
            String resolution
    ) {}

    public record InspectReturnRequest(java.util.UUID inspectedBy, String resolution) {}
}

