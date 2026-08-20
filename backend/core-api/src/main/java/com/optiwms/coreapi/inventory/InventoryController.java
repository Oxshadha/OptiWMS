package com.optiwms.coreapi.inventory;

import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.domain.notifications.Notification;
import com.optiwms.coreapp.inventory.InventoryService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final NotificationService notificationService;
    private final com.optiwms.infra.master.MaterialRepository materialRepository;

    public InventoryController(
            InventoryService inventoryService,
            NotificationService notificationService,
            com.optiwms.infra.master.MaterialRepository materialRepository) {
        this.inventoryService = inventoryService;
        this.notificationService = notificationService;
        this.materialRepository = materialRepository;
    }

    /**
     * Material code and description for the given stock rows, read in one query.
     *
     * <p>The client used to label rows by joining them against the materials reference list, which
     * is deliberately filtered to operational tiers. Anything outside those tiers -- currently about
     * a third of the catalogue, on a null tier -- fell out of the join and rendered as a raw uuid
     * and "Unknown Material". A row's own label must not depend on an unrelated data-quality filter,
     * so it is resolved here against the material by id.
     */
    private java.util.Map<UUID, com.optiwms.infra.master.MaterialEntity> materialsFor(
            List<com.optiwms.domain.inventory.InventoryItem> items) {
        java.util.Set<UUID> ids = items.stream()
                .map(com.optiwms.domain.inventory.InventoryItem::getMaterialId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        if (ids.isEmpty()) {
            return java.util.Map.of();
        }
        java.util.Map<UUID, com.optiwms.infra.master.MaterialEntity> byId = new java.util.HashMap<>();
        materialRepository.findAllById(ids).forEach(material -> byId.put(material.getId(), material));
        return byId;
    }

    @GetMapping
    public ResponseEntity<List<InventoryItemDto>> list(
            @RequestParam(required = false) UUID materialId,
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String materialType
    ) {
        List<com.optiwms.domain.inventory.InventoryItem> items;

        // Filter by materialType (raw_material, packaging_material, product)
        if (materialType != null && warehouseId != null) {
            items = inventoryService.findByWarehouseAndMaterialType(warehouseId, materialType);
        } else if (materialType != null) {
            items = inventoryService.findByMaterialType(materialType);
        } else if (materialId != null && warehouseId != null) {
            items = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        } else if (materialId != null) {
            items = inventoryService.findByMaterial(materialId);
        } else if (warehouseId != null) {
            items = inventoryService.findByWarehouse(warehouseId);
        } else {
            items = inventoryService.listAll();
        }

        var materials = materialsFor(items);
        var data = items.stream()
                .map(item -> toDto(item, materials))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedInventoryResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "sku") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) UUID materialId,
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String materialType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String stockState,
            @RequestParam(defaultValue = "false") boolean includeLegacy,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);
        Sort sort = "id".equals(safeSortBy)
                ? Sort.by(direction, "id")
                : Sort.by(direction, safeSortBy).and(Sort.by(direction, "id"));

        Page<com.optiwms.domain.inventory.InventoryItem> itemPage = inventoryService.findPaged(
                materialId,
                warehouseId,
                materialType,
                status,
                stockState,
                q,
                includeLegacy,
                PageRequest.of(safePage, safeSize, sort)
        );

        var pageMaterials = materialsFor(itemPage.getContent());
        List<InventoryItemDto> data = itemPage.getContent().stream()
                .map(item -> toDto(item, pageMaterials))
                .toList();

        return ResponseEntity.ok(new PagedInventoryResponse(
                data,
                itemPage.getNumber(),
                itemPage.getSize(),
                itemPage.getTotalElements(),
                itemPage.getTotalPages()
        ));
    }

    @GetMapping("/summary")
    public ResponseEntity<InventorySummaryResponse> summary(
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String materialType
    ) {
        var summary = inventoryService.summarize(warehouseId, materialType);
        return ResponseEntity.ok(new InventorySummaryResponse(
                summary.totalItems(),
                summary.inStockItems(),
                summary.lowStockItems(),
                summary.outOfStockItems()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InventoryItemDto> getById(@PathVariable UUID id) {
        try {
            var item = inventoryService.findById(id);
            return ResponseEntity.ok(toDto(item));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/material/{materialId}")
    public ResponseEntity<List<InventoryItemDto>> getByMaterial(@PathVariable UUID materialId) {
        var items = inventoryService.findByMaterial(materialId);
        var batch = materialsFor(items);
        return ResponseEntity.ok(items.stream().map(item -> toDto(item, batch)).toList());
    }

    @GetMapping("/warehouse/{warehouseId}")
    public ResponseEntity<List<InventoryItemDto>> getByWarehouse(@PathVariable UUID warehouseId) {
        var items = inventoryService.findByWarehouse(warehouseId);
        var batch = materialsFor(items);
        return ResponseEntity.ok(items.stream().map(item -> toDto(item, batch)).toList());
    }

    @GetMapping("/location/{locationCode}")
    public ResponseEntity<List<InventoryItemDto>> getByLocation(@PathVariable String locationCode) {
        var items = inventoryService.findByLocationCode(locationCode);
        var batch = materialsFor(items);
        return ResponseEntity.ok(items.stream().map(item -> toDto(item, batch)).toList());
    }

    @PatchMapping("/{id}/quantity")
    public ResponseEntity<InventoryItemDto> updateQuantity(
            @PathVariable UUID id,
            @RequestParam Integer quantityChange
    ) {
        try {
            var item = inventoryService.findById(id);
            var newQuantity = (item.getQuantity() != null ? item.getQuantity() : 0) + quantityChange;
            item.setQuantity(newQuantity);
            if (item.getAvailableQuantity() != null) {
                item.setAvailableQuantity(newQuantity - (item.getReservedQuantity() != null ? item.getReservedQuantity() : 0));
            }
            var updated = inventoryService.update(id, item);
            notifyInventoryEvent(
                    "Inventory Quantity Updated",
                    "Inventory quantity was adjusted at " + updated.getLocationCode() + ".",
                    updated,
                    "quantity_updated"
            );
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        }
    }

    @GetMapping("/quarantined")
    public ResponseEntity<List<QuarantinedItemDto>> getQuarantined(
            @RequestParam(required = false) UUID warehouseId
    ) {
        var items = warehouseId != null 
            ? inventoryService.findQuarantinedByWarehouse(warehouseId)
            : inventoryService.findQuarantined();
        return ResponseEntity.ok(items.stream().map(this::toQuarantinedDto).toList());
    }

    @PostMapping("/quarantined")
    public ResponseEntity<Map<String, Object>> quarantineBin(@RequestBody QuarantineRequest request) {
        try {
            var items = inventoryService.findByLocationCode(request.locationCode());
            if (items.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "No items found at location: " + request.locationCode()));
            }
            
            // Quarantine all items at this location
            for (var item : items) {
                item.setStatus("quarantine");
                inventoryService.update(item.getId(), item);
                notifyInventoryEvent(
                        "Inventory Quarantined",
                        "Inventory at " + item.getLocationCode() + " was moved to quarantine.",
                        item,
                        "quarantined"
                );
            }
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Items quarantined successfully",
                "locationCode", request.locationCode(),
                "itemsQuarantined", items.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/quarantined/{id}/release")
    public ResponseEntity<Map<String, Object>> releaseQuarantine(@PathVariable UUID id) {
        try {
            var item = inventoryService.findById(id);
            if (!"quarantine".equals(item.getStatus())) {
                return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Item is not in quarantine"));
            }
            item.setStatus("active");
            var updated = inventoryService.update(id, item);
            notifyInventoryEvent(
                    "Inventory Released",
                    "Inventory at " + updated.getLocationCode() + " was released from quarantine.",
                    updated,
                    "released"
            );
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Item released from quarantine"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<InventoryItemDto> create(@RequestBody CreateInventoryRequest request) {
        try {
            var item = new com.optiwms.domain.inventory.InventoryItem();
            item.setMaterialId(request.materialId());
            item.setWarehouseId(request.warehouseId());
            item.setLocationCode(request.locationCode());
            item.setLpnCode(request.lpnCode());
            // Convert string quantities to Integer (actual pallet quantities are integers)
            item.setQuantity(request.quantity() != null ? Integer.parseInt(request.quantity()) : 0);
            item.setAvailableQuantity(request.availableQuantity() != null ? Integer.parseInt(request.availableQuantity()) : 
                (request.quantity() != null ? Integer.parseInt(request.quantity()) : 0));
            item.setReservedQuantity(request.reservedQuantity() != null ? Integer.parseInt(request.reservedQuantity()) : 0);
            item.setBufferStock(request.bufferStock() != null ? new java.math.BigDecimal(request.bufferStock()) : null);
            item.setMaxStock(request.maxStock() != null ? new java.math.BigDecimal(request.maxStock()) : null);
            item.setMinStock(request.minStock() != null ? new java.math.BigDecimal(request.minStock()) : null);
            item.setReorderPoint(request.reorderPoint() != null ? new java.math.BigDecimal(request.reorderPoint()) : null);
            item.setStackingQuantity(request.stackQuantity());
            item.setMoq(request.moq() != null ? new java.math.BigDecimal(request.moq()) : null);
            item.setLeadTimeDays(request.leadTimeDays());
            item.setStatus(request.status() != null ? request.status() : "active");
            item.setBatchNumber(request.batchNumber());
            item.setExpiryDate(request.expiryDate());

            var created = inventoryService.createOrUpdate(item);
            notifyInventoryEvent(
                    "Inventory Created",
                    "Inventory was created at " + created.getLocationCode() + ".",
                    created,
                    "created"
            );
            return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<InventoryItemDto> update(@PathVariable UUID id, @RequestBody UpdateInventoryRequest request) {
        try {
            var item = new com.optiwms.domain.inventory.InventoryItem();
            // Update warehouse if provided
            if (request.warehouseId() != null) {
                item.setWarehouseId(UUID.fromString(request.warehouseId()));
            }
            item.setLocationCode(request.locationCode());
            if (request.lpnCode() != null) {
                item.setLpnCode(request.lpnCode());
            }
            // Convert string quantities to Integer (actual pallet quantities are integers)
            item.setQuantity(request.quantity() != null ? Integer.parseInt(request.quantity()) : null);
            item.setAvailableQuantity(request.availableQuantity() != null ? Integer.parseInt(request.availableQuantity()) : null);
            item.setReservedQuantity(request.reservedQuantity() != null ? Integer.parseInt(request.reservedQuantity()) : null);
            item.setBufferStock(request.bufferStock() != null ? new java.math.BigDecimal(request.bufferStock()) : null);
            item.setMaxStock(request.maxStock() != null ? new java.math.BigDecimal(request.maxStock()) : null);
            item.setMinStock(request.minStock() != null ? new java.math.BigDecimal(request.minStock()) : null);
            item.setReorderPoint(request.reorderPoint() != null ? new java.math.BigDecimal(request.reorderPoint()) : null);
            item.setStackingQuantity(request.stackingQuantity());
            item.setMoq(request.moq() != null ? new java.math.BigDecimal(request.moq()) : null);
            item.setLeadTimeDays(request.leadTimeDays());
            item.setStatus(request.status());
            item.setBatchNumber(request.batchNumber());
            item.setExpiryDate(request.expiryDate());

            var updated = inventoryService.update(id, item);
            notifyInventoryEvent(
                    "Inventory Updated",
                    "Inventory at " + updated.getLocationCode() + " was updated.",
                    updated,
                    "updated"
            );
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        }
    }

    // Helper method to convert domain to DTO with String quantities
    /** Single-row mapping; resolves the material label on its own. */
    private InventoryItemDto toDto(com.optiwms.domain.inventory.InventoryItem item) {
        return toDto(item, materialsFor(List.of(item)));
    }

    private InventoryItemDto toDto(
            com.optiwms.domain.inventory.InventoryItem item,
            java.util.Map<UUID, com.optiwms.infra.master.MaterialEntity> materials) {
        com.optiwms.infra.master.MaterialEntity material = item.getMaterialId() != null
                ? materials.get(item.getMaterialId())
                : null;
        return new InventoryItemDto(
                material != null ? material.getMaterialCode() : null,
                material != null ? material.getDescription() : null,
                item.getId(),
                item.getMaterialId(),
                item.getWarehouseId(),
                item.getLocationCode(),
                item.getLpnCode(),
                item.getQuantity() != null ? item.getQuantity().toString() : "0",
                item.getAvailableQuantity() != null ? item.getAvailableQuantity().toString() : "0",
                item.getReservedQuantity() != null ? item.getReservedQuantity().toString() : "0",
                item.getBufferStock() != null ? item.getBufferStock().toString() : null,
                item.getMaxStock() != null ? item.getMaxStock().toString() : null,
                item.getMinStock() != null ? item.getMinStock().toString() : null,
                item.getReorderPoint() != null ? item.getReorderPoint().toString() : null,
                item.getStackingQuantity(),
                item.getMoq() != null ? item.getMoq().toString() : null,
                item.getLeadTimeDays(),
                item.getStatus(),
                item.getMaterialType(),
                item.getBatchNumber(),
                item.getExpiryDate(),
                // Additional planning fields
                item.getBufferDays(),
                item.getLeadTimeMonths() != null ? item.getLeadTimeMonths().toString() : null,
                item.getRopInDays() != null ? item.getRopInDays().toString() : null,
                item.getVarianceDemand() != null ? item.getVarianceDemand().toString() : null,
                item.getVarianceLeadTimeDemand() != null ? item.getVarianceLeadTimeDemand().toString() : null,
                item.getDifference() != null ? item.getDifference().toString() : null,
                item.getOrderDeliveryDays(),
                item.getOrderQuantity() != null ? item.getOrderQuantity().toString() : null,
                item.getPalletRequirement() != null ? item.getPalletRequirement().toString() : null
        );
    }

    private QuarantinedItemDto toQuarantinedDto(com.optiwms.domain.inventory.InventoryItem item) {
        return new QuarantinedItemDto(
                item.getId().toString(),
                item.getMaterialId().toString(), // Using materialId as SKU for now
                item.getLocationCode(),
                item.getQuantity() != null ? item.getQuantity().toString() : "0",
                java.time.OffsetDateTime.now().toString(), // quarantinedAt
                null, // qualityCheckId
                "Quarantined" // reason
        );
    }

    private void notifyInventoryEvent(
            String title,
            String message,
            com.optiwms.domain.inventory.InventoryItem item,
            String eventType
    ) {
        try {
            Notification notification = new Notification();
            notification.setUserId(null);
            notification.setAudienceRoles("admin,warehouse_manager,inbound_coordinator");
            notification.setWarehouseId(item.getWarehouseId());
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setNotificationType("inventory");
            notification.setRead(false);
            notification.setActionUrl("/admin/inventory/" + item.getId());
            notification.setMetadata(
                    "{\"inventoryId\":\"" + item.getId() + "\",\"materialId\":\"" + item.getMaterialId() + "\",\"warehouseId\":\"" + item.getWarehouseId() + "\",\"locationCode\":\"" + item.getLocationCode() + "\",\"status\":\"" + item.getStatus() + "\",\"event\":\"" + eventType + "\"}"
            );
            notification.setCreatedAt(OffsetDateTime.now());
            notificationService.create(notification);
        } catch (Exception ignored) {
            // Notifications must not block inventory operations.
        }
    }

    public record InventoryItemDto(
            /** Label carried on the row so the client never has to join to get it. */
            String materialCode,
            String materialDescription,
            UUID id,
            UUID materialId,
            UUID warehouseId,
            String locationCode,
            String lpnCode,  // License Plate Number
            String quantity,  // Changed to String
            String availableQuantity,  // Changed to String
            String reservedQuantity,  // Changed to String
            String bufferStock,  // Changed to String
            String maxStock,  // Changed to String
            String minStock,  // Changed to String
            String reorderPoint,  // Changed to String
            Integer stackingQuantity,
            String moq,  // Changed to String
            Integer leadTimeDays,
            String status,
            String materialType,  // raw_material, packaging_material, product
            String batchNumber,
            java.time.LocalDate expiryDate,
            // Additional planning fields
            Integer bufferDays,
            String leadTimeMonths,
            String ropInDays,
            String varianceDemand,
            String varianceLeadTimeDemand,
            String difference,
            Integer orderDeliveryDays,
            String orderQuantity,
            String palletRequirement
    ) {}

    public record QuarantinedItemDto(
            String id,
            String sku,
            String locationCode,
            String quantity,
            String quarantinedAt,
            String qualityCheckId,
            String reason
    ) {}

    public record QuarantineRequest(
            String sku,
            String locationCode,
            String qualityCheckId
    ) {}

    public record PagedInventoryResponse(
            List<InventoryItemDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    public record InventorySummaryResponse(
            long totalItems,
            long inStockItems,
            long lowStockItems,
            long outOfStockItems
    ) {}

    public record CreateInventoryRequest(
            UUID materialId,
            UUID warehouseId,
            String locationCode,
            String lpnCode,  // License Plate Number
            String quantity,  // Accept as String, convert to BigDecimal
            String availableQuantity,  // Accept as String
            String reservedQuantity,  // Accept as String
            String bufferStock,  // Accept as String
            String maxStock,  // Accept as String
            String minStock,  // Accept as String
            String reorderPoint,  // Accept as String
            Integer stackQuantity,
            String moq,  // Accept as String
            Integer leadTimeDays,
            String status,
            String batchNumber,
            java.time.LocalDate expiryDate
    ) {}

    public record UpdateInventoryRequest(
            String warehouseId,  // Allow updating warehouse
            String locationCode,
            String lpnCode,  // License Plate Number
            String quantity,  // Accept as String
            String availableQuantity,  // Accept as String
            String reservedQuantity,  // Accept as String
            String bufferStock,  // Accept as String
            String maxStock,  // Accept as String
            String minStock,  // Accept as String
            String reorderPoint,  // Accept as String
            Integer stackingQuantity,
            String moq,  // Accept as String
            Integer leadTimeDays,
            String status,
            String batchNumber,
            java.time.LocalDate expiryDate
    ) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "material.materialCode";
        }
        return switch (sortBy) {
            case "sku" -> "material.materialCode";
            case "name" -> "material.description";
            case "qty" -> "quantity";
            case "location" -> "locationCode";
            case "id", "createdAt", "updatedAt", "locationCode", "status", "quantity", "availableQuantity", "reservedQuantity", "expiryDate", "lastMovementDate" -> sortBy;
            default -> "material.materialCode";
        };
    }
}
