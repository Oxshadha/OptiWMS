package com.optiwms.coreapi.inventory;

import com.optiwms.coreapp.inventory.InventoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public ResponseEntity<List<InventoryItemDto>> list(
            @RequestParam(required = false) UUID materialId,
            @RequestParam(required = false) UUID warehouseId
    ) {
        List<com.optiwms.domain.inventory.InventoryItem> items;

        if (materialId != null && warehouseId != null) {
            items = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        } else if (materialId != null) {
            items = inventoryService.findByMaterial(materialId);
        } else if (warehouseId != null) {
            items = inventoryService.findByWarehouse(warehouseId);
        } else {
            items = inventoryService.listAll();
        }

        var data = items.stream()
                .map(item -> new InventoryItemDto(
                        item.getId(),
                        item.getMaterialId(),
                        item.getWarehouseId(),
                        item.getLocationCode(),
                        item.getQuantity(),
                        item.getAvailableQuantity(),
                        item.getReservedQuantity(),
                        item.getBufferStock(),
                        item.getMaxStock(),
                        item.getMinStock(),
                        item.getReorderPoint(),
                        item.getStackingQuantity(),
                        item.getMoq(),
                        item.getLeadTimeDays(),
                        item.getStatus()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<InventoryItemDto> getById(@PathVariable UUID id) {
        try {
            var item = inventoryService.findById(id);
            return ResponseEntity.ok(new InventoryItemDto(
                    item.getId(),
                    item.getMaterialId(),
                    item.getWarehouseId(),
                    item.getLocationCode(),
                    item.getQuantity(),
                    item.getAvailableQuantity(),
                    item.getReservedQuantity(),
                    item.getBufferStock(),
                    item.getMaxStock(),
                    item.getMinStock(),
                    item.getReorderPoint(),
                    item.getStackingQuantity(),
                    item.getMoq(),
                    item.getLeadTimeDays(),
                    item.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<InventoryItemDto> update(@PathVariable UUID id, @RequestBody UpdateInventoryRequest request) {
        try {
            var item = new com.optiwms.domain.inventory.InventoryItem();
            item.setLocationCode(request.locationCode());
            item.setQuantity(request.quantity());
            item.setAvailableQuantity(request.availableQuantity());
            item.setReservedQuantity(request.reservedQuantity());
            item.setBufferStock(request.bufferStock());
            item.setMaxStock(request.maxStock());
            item.setMinStock(request.minStock());
            item.setReorderPoint(request.reorderPoint());
            item.setStackingQuantity(request.stackingQuantity());
            item.setMoq(request.moq());
            item.setLeadTimeDays(request.leadTimeDays());
            item.setStatus(request.status());

            var updated = inventoryService.update(id, item);
            return ResponseEntity.ok(new InventoryItemDto(
                    updated.getId(),
                    updated.getMaterialId(),
                    updated.getWarehouseId(),
                    updated.getLocationCode(),
                    updated.getQuantity(),
                    updated.getAvailableQuantity(),
                    updated.getReservedQuantity(),
                    updated.getBufferStock(),
                    updated.getMaxStock(),
                    updated.getMinStock(),
                    updated.getReorderPoint(),
                    updated.getStackingQuantity(),
                    updated.getMoq(),
                    updated.getLeadTimeDays(),
                    updated.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record InventoryItemDto(
            UUID id,
            UUID materialId,
            UUID warehouseId,
            String locationCode,
            java.math.BigDecimal quantity,
            java.math.BigDecimal availableQuantity,
            java.math.BigDecimal reservedQuantity,
            java.math.BigDecimal bufferStock,
            java.math.BigDecimal maxStock,
            java.math.BigDecimal minStock,
            java.math.BigDecimal reorderPoint,
            Integer stackingQuantity,
            java.math.BigDecimal moq,
            Integer leadTimeDays,
            String status
    ) {}

    public record UpdateInventoryRequest(
            String locationCode,
            java.math.BigDecimal quantity,
            java.math.BigDecimal availableQuantity,
            java.math.BigDecimal reservedQuantity,
            java.math.BigDecimal bufferStock,
            java.math.BigDecimal maxStock,
            java.math.BigDecimal minStock,
            java.math.BigDecimal reorderPoint,
            Integer stackingQuantity,
            java.math.BigDecimal moq,
            Integer leadTimeDays,
            String status
    ) {}
}

