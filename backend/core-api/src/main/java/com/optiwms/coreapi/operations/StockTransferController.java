package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.StockTransferService;
import com.optiwms.domain.operations.StockTransfer;
import com.optiwms.domain.operations.StockTransferLine;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
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
    public ResponseEntity<StockTransferDto> getById(@PathVariable UUID id) {
        StockTransfer transfer = service.findById(id);
        return ResponseEntity.ok(toDto(transfer));
    }

    @GetMapping("/{id}/lines")
    public ResponseEntity<List<StockTransferLineDto>> getLines(@PathVariable UUID id) {
        return ResponseEntity.ok(
                service.findLinesByTransfer(id).stream()
                        .map(this::toLineDto)
                        .collect(Collectors.toList())
        );
    }

    @GetMapping("/lines/executable")
    public ResponseEntity<List<StockTransferLineDto>> getExecutableLines(
            @RequestParam UUID workerId,
            @RequestParam(required = false) UUID warehouseId
    ) {
        return ResponseEntity.ok(
                service.findExecutableLines(workerId, warehouseId).stream()
                        .map(this::toLineDto)
                        .collect(Collectors.toList())
        );
    }

    @PostMapping
    public ResponseEntity<StockTransferDto> create(@RequestBody CreateStockTransferRequest request) {
        StockTransfer transfer = toDomainCreateRequest(request);
        StockTransfer created = service.create(transfer);
        return ResponseEntity.ok(toDto(created));
    }

    @PostMapping("/multi")
    public ResponseEntity<StockTransferDto> createMulti(@RequestBody CreateStockTransferRequest request) {
        StockTransfer transfer = toDomainCreateRequest(request);
        StockTransfer created = service.create(transfer);
        return ResponseEntity.ok(toDto(created));
    }

    @PostMapping("/{id}/release")
    public ResponseEntity<StockTransferDto> release(@PathVariable UUID id, @RequestBody ReleaseTransferRequest request) {
        StockTransfer transfer = service.release(id, UUID.fromString(request.managerId()));
        return ResponseEntity.ok(toDto(transfer));
    }

    @PostMapping("/lines/{lineId}/assign")
    public ResponseEntity<StockTransferLineDto> assignLine(@PathVariable UUID lineId, @RequestBody AssignLineRequest request) {
        StockTransferLine line = service.assignLine(lineId, UUID.fromString(request.workerId()), request.assignedBy());
        return ResponseEntity.ok(toLineDto(line));
    }

    @PostMapping("/lines/{lineId}/execute")
    public ResponseEntity<StockTransferLineDto> executeLine(@PathVariable UUID lineId, @RequestBody ExecuteLineRequest request) {
        StockTransferLine line = service.executeLine(
                lineId,
                UUID.fromString(request.workerId()),
                request.sourceScanLocation(),
                request.destScanLocation(),
                request.quantity(),
                request.notes()
        );
        return ResponseEntity.ok(toLineDto(line));
    }

    @PostMapping("/lines/{lineId}/skip")
    public ResponseEntity<StockTransferLineDto> skipLine(@PathVariable UUID lineId, @RequestBody SkipLineRequest request) {
        StockTransferLine line = service.skipLine(lineId, UUID.fromString(request.workerId()), request.reason());
        return ResponseEntity.ok(toLineDto(line));
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<StockTransferDto> dispatch(@PathVariable UUID id, @RequestParam UUID userId) {
        StockTransfer transfer = service.dispatch(id, userId);
        return ResponseEntity.ok(toDto(transfer));
    }

    @PostMapping("/{id}/receive")
    public ResponseEntity<StockTransferDto> receive(@PathVariable UUID id, @RequestParam UUID userId) {
        StockTransfer transfer = service.receive(id, userId);
        return ResponseEntity.ok(toDto(transfer));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<StockTransferDto> cancel(@PathVariable UUID id, @RequestBody(required = false) CancelStockTransferRequest request) {
        String reason = request != null ? request.reason() : null;
        StockTransfer transfer = service.cancel(id, reason);
        return ResponseEntity.ok(toDto(transfer));
    }

    private StockTransfer toDomainCreateRequest(CreateStockTransferRequest request) {
        StockTransfer transfer = new StockTransfer();
        transfer.setTransferNumber(request.transferNumber());
        transfer.setTransferType(request.transferType());
        if (request.materialId() != null && !request.materialId().isBlank()) {
            transfer.setMaterialId(UUID.fromString(request.materialId()));
        }
        if (request.sourceWarehouseId() != null && !request.sourceWarehouseId().isBlank()) {
            transfer.setSourceWarehouseId(UUID.fromString(request.sourceWarehouseId()));
        }
        transfer.setSourceLocationCode(request.sourceLocationCode());
        if (request.destWarehouseId() != null && !request.destWarehouseId().isBlank()) {
            transfer.setDestWarehouseId(UUID.fromString(request.destWarehouseId()));
        }
        transfer.setDestLocationCode(request.destLocationCode());
        if (request.quantity() != null && !request.quantity().isBlank()) {
            transfer.setQuantity(Integer.parseInt(request.quantity()));
        }
        transfer.setNotes(request.notes());
        if (request.createdBy() != null && !request.createdBy().isBlank()) {
            transfer.setCreatedBy(UUID.fromString(request.createdBy()));
        }
        transfer.setStatus(request.status() != null ? request.status() : "draft");

        List<StockTransferLine> lines = new ArrayList<>();
        if (request.lines() != null && !request.lines().isEmpty()) {
            int lineNumber = 1;
            for (CreateStockTransferLineRequest lineRequest : request.lines()) {
                StockTransferLine line = new StockTransferLine();
                line.setLineNumber(lineRequest.lineNumber() != null ? lineRequest.lineNumber() : lineNumber);
                line.setMaterialId(UUID.fromString(lineRequest.materialId()));
                line.setSourceWarehouseId(UUID.fromString(lineRequest.sourceWarehouseId()));
                line.setSourceLocationCode(lineRequest.sourceLocationCode());
                line.setDestWarehouseId(UUID.fromString(lineRequest.destWarehouseId()));
                line.setDestLocationCode(lineRequest.destLocationCode());
                line.setRequestedQuantity(Integer.parseInt(lineRequest.quantity()));
                line.setAssignedWorkerId(lineRequest.assignedWorkerId() != null && !lineRequest.assignedWorkerId().isBlank()
                        ? UUID.fromString(lineRequest.assignedWorkerId()) : null);
                line.setStatus(lineRequest.status() != null ? lineRequest.status() : "open");
                line.setNotes(lineRequest.notes());
                lines.add(line);
                lineNumber++;
            }
        }

        transfer.setLines(lines);
        return transfer;
    }

    private StockTransferDto toDto(StockTransfer transfer) {
        return new StockTransferDto(
                transfer.getId().toString(),
                transfer.getTransferNumber(),
                transfer.getTransferType(),
                transfer.getMaterialId() != null ? transfer.getMaterialId().toString() : null,
                transfer.getSourceWarehouseId() != null ? transfer.getSourceWarehouseId().toString() : null,
                transfer.getSourceLocationCode(),
                transfer.getDestWarehouseId() != null ? transfer.getDestWarehouseId().toString() : null,
                transfer.getDestLocationCode(),
                transfer.getQuantity() != null ? transfer.getQuantity().toString() : "0",
                transfer.getStatus(),
                transfer.getNotes(),
                transfer.getCreatedBy() != null ? transfer.getCreatedBy().toString() : null,
                transfer.getReleasedBy() != null ? transfer.getReleasedBy().toString() : null,
                transfer.getReleasedAt() != null ? transfer.getReleasedAt().toString() : null,
                transfer.getLines() != null ? transfer.getLines().stream().map(this::toLineDto).collect(Collectors.toList()) : List.of()
        );
    }

    private StockTransferLineDto toLineDto(StockTransferLine line) {
        return new StockTransferLineDto(
                line.getId().toString(),
                line.getTransferId().toString(),
                line.getLineNumber(),
                line.getMaterialId() != null ? line.getMaterialId().toString() : null,
                line.getSourceWarehouseId() != null ? line.getSourceWarehouseId().toString() : null,
                line.getSourceLocationCode(),
                line.getDestWarehouseId() != null ? line.getDestWarehouseId().toString() : null,
                line.getDestLocationCode(),
                line.getRequestedQuantity(),
                line.getMovedQuantity(),
                line.getStatus(),
                line.getAssignedWorkerId() != null ? line.getAssignedWorkerId().toString() : null,
                line.getNotes()
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
            String status,
            String createdBy,
            String notes,
            List<CreateStockTransferLineRequest> lines
    ) {}

    public record CreateStockTransferLineRequest(
            Integer lineNumber,
            String materialId,
            String sourceWarehouseId,
            String sourceLocationCode,
            String destWarehouseId,
            String destLocationCode,
            String quantity,
            String assignedWorkerId,
            String status,
            String notes
    ) {}

    public record ReleaseTransferRequest(String managerId) {}

    public record AssignLineRequest(String workerId, String assignedBy) {}

    public record ExecuteLineRequest(
            String workerId,
            String sourceScanLocation,
            String destScanLocation,
            Integer quantity,
            String notes
    ) {}

    public record SkipLineRequest(String workerId, String reason) {}

    public record CancelStockTransferRequest(String reason) {}

    public record StockTransferLineDto(
            String id,
            String transferId,
            Integer lineNumber,
            String materialId,
            String sourceWarehouseId,
            String sourceLocationCode,
            String destWarehouseId,
            String destLocationCode,
            Integer requestedQuantity,
            Integer movedQuantity,
            String status,
            String assignedWorkerId,
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
            String notes,
            String createdBy,
            String releasedBy,
            String releasedAt,
            List<StockTransferLineDto> lines
    ) {}
}
