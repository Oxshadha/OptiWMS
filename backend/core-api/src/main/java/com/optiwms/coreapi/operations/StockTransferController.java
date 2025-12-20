package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.StockTransferService;
import com.optiwms.domain.operations.StockTransfer;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/operations/stock-transfers")
public class StockTransferController {

    private final StockTransferService service;

    public StockTransferController(StockTransferService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<StockTransferDto>> listAll() {
        List<StockTransferDto> transfers = service.listAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(transfers);
    }

    @GetMapping("/{id}")
    public ResponseEntity<StockTransferDto> getById(@PathVariable @NonNull UUID id) {
        try {
            StockTransfer transfer = service.findById(id);
            return ResponseEntity.ok(toDto(transfer));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<StockTransferDto> create(@RequestBody CreateStockTransferRequest request) {
        try {
            StockTransfer transfer = new StockTransfer();
            transfer.setTransferNumber(request.transferNumber());
            transfer.setTransferType(request.transferType());
            transfer.setMaterialId(UUID.fromString(request.materialId()));
            transfer.setSourceWarehouseId(UUID.fromString(request.sourceWarehouseId()));
            transfer.setSourceLocationCode(request.sourceLocationCode());
            transfer.setDestWarehouseId(UUID.fromString(request.destWarehouseId()));
            transfer.setDestLocationCode(request.destLocationCode());
            transfer.setQuantity(new BigDecimal(request.quantity()));
            transfer.setNotes(request.notes());

            StockTransfer created = service.create(transfer);
            return ResponseEntity.ok(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<StockTransferDto> dispatch(@PathVariable @NonNull UUID id, @RequestParam @NonNull UUID userId) {
        try {
            StockTransfer transfer = service.dispatch(id, userId);
            return ResponseEntity.ok(toDto(transfer));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/receive")
    public ResponseEntity<StockTransferDto> receive(@PathVariable @NonNull UUID id, @RequestParam @NonNull UUID userId) {
        try {
            StockTransfer transfer = service.receive(id, userId);
            return ResponseEntity.ok(toDto(transfer));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private StockTransferDto toDto(StockTransfer transfer) {
        return new StockTransferDto(
                transfer.getId().toString(),
                transfer.getTransferNumber(),
                transfer.getTransferType(),
                transfer.getMaterialId().toString(),
                transfer.getSourceWarehouseId().toString(),
                transfer.getSourceLocationCode(),
                transfer.getDestWarehouseId().toString(),
                transfer.getDestLocationCode(),
                transfer.getQuantity().toString(),
                transfer.getStatus(),
                transfer.getNotes()
        );
    }

    public record CreateStockTransferRequest(
            String transferNumber,
            String transferType,
            String materialId,
            String sourceWarehouseId,
            String sourceLocationCode,
            String destWarehouseId,
            String destLocationCode,
            String quantity,
            String notes
    ) {}

    public record StockTransferDto(
            String id,
            String transferNumber,
            String transferType,
            String materialId,
            String sourceWarehouseId,
            String sourceLocationCode,
            String destWarehouseId,
            String destLocationCode,
            String quantity,
            String status,
            String notes
    ) {}
}

