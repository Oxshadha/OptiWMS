package com.optiwms.coreapi.orders;

import com.optiwms.coreapp.orders.OrderItemService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.operations.MaterialLocationAssignmentService;
import com.optiwms.coreapp.operations.PutawayCapacityPlanningService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.SupplierMaterialService;
import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import com.optiwms.domain.orders.OrderItem;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.master.Material;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderItemController {

    private final OrderItemService orderItemService;
    private final OrderService orderService;
    private final MaterialLocationAssignmentService materialLocationService;
    private final PutawayCapacityPlanningService putawayCapacityPlanningService;
    private final MaterialService materialService;
    private final SupplierMaterialService supplierMaterialService;
    private final MaterialDefaultLocationService materialDefaultLocationService;

    public OrderItemController(
            OrderItemService orderItemService,
            OrderService orderService,
            MaterialLocationAssignmentService materialLocationService,
            PutawayCapacityPlanningService putawayCapacityPlanningService,
            MaterialService materialService,
            SupplierMaterialService supplierMaterialService,
            MaterialDefaultLocationService materialDefaultLocationService) {
        this.orderItemService = orderItemService;
        this.orderService = orderService;
        this.materialLocationService = materialLocationService;
        this.putawayCapacityPlanningService = putawayCapacityPlanningService;
        this.materialService = materialService;
        this.supplierMaterialService = supplierMaterialService;
        this.materialDefaultLocationService = materialDefaultLocationService;
    }

    @GetMapping("/{orderId}/items")
    public ResponseEntity<List<OrderItemDto>> getByOrderId(@PathVariable UUID orderId) {
        List<OrderItem> items = orderItemService.findByOrderId(orderId);
        List<OrderItemDto> dtos = items.stream()
                .map(this::toDtoWithMaterial)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get order items for putaway - includes suggested locations
     * For putaway workers to see items in an order that need putaway
     */
    @GetMapping("/{orderId}/putaway-items")
    public ResponseEntity<List<PutawayItemDto>> getPutawayItems(@PathVariable UUID orderId) {
        List<OrderItem> items = orderItemService.findByOrderId(orderId);
        Order order = orderService.findById(orderId);
        // Filter to only items that have been received (picked_quantity > 0)
        List<PutawayItemDto> putawayItems = items.stream()
                .filter(item -> item.getPickedQuantity() != null && item.getPickedQuantity() > 0)
                .map(item -> {
                    String suggestedLocation = null;
                    List<String> existingLocations = java.util.List.of();
                    PutawaySplitPlanDto splitPlan = null;
                    String materialCode = null;
                    String materialName = null;
                    try {
                        Material material = materialService.findById(item.getMaterialId());
                        materialCode = material.getMaterialCode();
                        materialName = material.getDescription();
                    } catch (Exception ignored) {
                        // Material lookup best-effort
                    }
                    try {
                        existingLocations = materialLocationService
                                .findMaterialLocations(item.getMaterialId(), order.getWarehouseId())
                                .stream()
                                .map(MaterialLocationAssignmentService.LocationInventory::locationCode)
                                .distinct()
                                .collect(java.util.stream.Collectors.toList());
                        suggestedLocation = materialLocationService.suggestLocationForPutaway(
                                item.getMaterialId(),
                                order.getWarehouseId(),
                                item.getPickedQuantity() != null ? item.getPickedQuantity() : item.getQuantity()
                        );
                        Integer putawayQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : item.getQuantity();
                        if (putawayQty != null && putawayQty > 0) {
                            var plan = putawayCapacityPlanningService.suggestSplitPlan(
                                    order.getWarehouseId(),
                                    item.getMaterialId(),
                                    putawayQty,
                                    suggestedLocation
                            );
                            splitPlan = toPutawaySplitPlanDto(plan);
                        }
                    } catch (Exception ignored) {
                        // Suggestions best-effort; do not break putaway list
                    }
                    return new PutawayItemDto(
                            item.getId().toString(),
                            item.getMaterialId().toString(),
                            materialCode,
                            materialName,
                            item.getPickedQuantity(), // Received quantity
                            item.getQuantity(), // Ordered quantity
                            suggestedLocation,
                            existingLocations,
                            item.getStatus(),
                            splitPlan
                    );
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(putawayItems);
    }

    @PostMapping("/{orderId}/items")
    public ResponseEntity<OrderItemDto> create(@PathVariable UUID orderId, @RequestBody CreateOrderItemRequest request) {
        UUID materialId = UUID.fromString(request.materialId());
        Order order = orderService.findById(orderId);
        if ("inbound".equalsIgnoreCase(order.getOrderType())) {
            UUID supplierId = order.getSupplierId();
            if (supplierId == null) {
                throw new IllegalArgumentException("Inbound order is missing supplier");
            }
            if (!supplierMaterialService.hasAnyMaterialLink(supplierId)) {
                throw new IllegalArgumentException(
                        "No materials are linked to the selected supplier. Link supplier materials first."
                );
            }
            if (!supplierMaterialService.isMaterialLinked(supplierId, materialId)) {
                throw new IllegalArgumentException(
                        "Selected material is not linked to the supplier for this inbound order."
                );
            }

            var primaryDefault = materialDefaultLocationService.getPrimaryLocation(materialId, order.getWarehouseId());
            String preferredLocationCode = primaryDefault != null ? primaryDefault.getLocationCode() : null;
            var splitPlan = putawayCapacityPlanningService.suggestSplitPlan(
                    order.getWarehouseId(),
                    materialId,
                    request.quantity(),
                    preferredLocationCode
            );
            if (!splitPlan.feasible()) {
                String notes = splitPlan.notes() != null ? String.join(" ", splitPlan.notes()) : "";
                String message = "Insufficient storage capacity for inbound item quantity " + request.quantity()
                        + " in warehouse. " + notes;
                throw new IllegalArgumentException(message.trim());
            }
        }

        OrderItem item = new OrderItem();
        item.setOrderId(orderId);
        item.setMaterialId(materialId);
        item.setQuantity(request.quantity());
        item.setUnitPrice(request.unitPrice() != null ? new java.math.BigDecimal(request.unitPrice()) : null);
        item.setLocationCode(request.locationCode());
        item.setBatchNumber(request.batchNumber());
        item.setManufactureDate(request.manufactureDate());
        item.setExpiryDate(request.expiryDate());
        item.setStatus("pending");

        OrderItem created = orderItemService.create(item);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(toDtoWithMaterial(created));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<OrderItemDto> update(
            @PathVariable UUID itemId,
            @RequestBody UpdateOrderItemRequest request
    ) {
        OrderItem item = new OrderItem();
        item.setQuantity(request.quantity());
        item.setUnitPrice(request.unitPrice() != null ? new java.math.BigDecimal(request.unitPrice()) : null);
        item.setLocationCode(request.locationCode());
        item.setBatchNumber(request.batchNumber());
        item.setManufactureDate(request.manufactureDate());
        item.setExpiryDate(request.expiryDate());
        item.setStatus(request.status());

        OrderItem updated = orderItemService.update(itemId, item);
        return ResponseEntity.ok(toDtoWithMaterial(updated));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> delete(@PathVariable UUID itemId) {
        orderItemService.deleteById(itemId);
        return ResponseEntity.noContent().build();
    }

    private OrderItemDto toDto(OrderItem item) {
        return new OrderItemDto(
                item.getId().toString(),
                item.getOrderId().toString(),
                item.getMaterialId().toString(),
                item.getQuantity(),
                item.getUnitPrice() != null ? item.getUnitPrice().toString() : null,
                item.getPickedQuantity(),
                item.getPackedQuantity(),
                item.getLocationCode(),
                item.getBatchNumber(),
                item.getManufactureDate(),
                item.getExpiryDate(),
                null,
                null,
                item.getStatus()
        );
    }

    private OrderItemDto toDtoWithMaterial(OrderItem item) {
        String materialCode = null;
        String materialName = null;
        try {
            Material material = materialService.findById(item.getMaterialId());
            materialCode = material.getMaterialCode();
            materialName = material.getDescription();
        } catch (Exception ignored) {
            // Best effort: keep dto fields null if material lookup fails
        }
        return new OrderItemDto(
                item.getId().toString(),
                item.getOrderId().toString(),
                item.getMaterialId().toString(),
                item.getQuantity(),
                item.getUnitPrice() != null ? item.getUnitPrice().toString() : null,
                item.getPickedQuantity(),
                item.getPackedQuantity(),
                item.getLocationCode(),
                item.getBatchNumber(),
                item.getManufactureDate(),
                item.getExpiryDate(),
                materialCode,
                materialName,
                item.getStatus()
        );
    }

    public record OrderItemDto(
            String id,
            String orderId,
            String materialId,
            Integer quantity,
            String unitPrice,
            Integer pickedQuantity,
            Integer packedQuantity,
            String locationCode,
            String batchNumber,
            java.time.LocalDate manufactureDate,
            java.time.LocalDate expiryDate,
            String materialCode,
            String materialName,
            String status
    ) {}

    public record CreateOrderItemRequest(
            String materialId,
            Integer quantity,
            String unitPrice,
            String locationCode,
            String batchNumber,
            java.time.LocalDate manufactureDate,
            java.time.LocalDate expiryDate
    ) {}

    public record UpdateOrderItemRequest(
            Integer quantity,
            String unitPrice,
            String locationCode,
            String batchNumber,
            java.time.LocalDate manufactureDate,
            java.time.LocalDate expiryDate,
            String status
    ) {}

    public record PutawayItemDto(
            String itemId,
            String materialId,
            String materialCode,
            String materialName,
            Integer receivedQuantity,
            Integer orderedQuantity,
            String suggestedLocation,
            List<String> existingLocations,
            String status,
            PutawaySplitPlanDto splitPlan
    ) {}

    public record PutawaySplitPlanDto(
            boolean feasible,
            int requestedQuantity,
            int plannedQuantity,
            int unplannedQuantity,
            List<PutawaySplitLineDto> allocations,
            List<String> notes
    ) {}

    public record PutawaySplitLineDto(
            String locationCode,
            int allocatedQuantity,
            String reason
    ) {}

    private PutawaySplitPlanDto toPutawaySplitPlanDto(PutawayCapacityPlanningService.SplitPlanResult plan) {
        return new PutawaySplitPlanDto(
                plan.feasible(),
                plan.requestedQuantity(),
                plan.plannedQuantity(),
                plan.unplannedQuantity(),
                plan.allocations().stream()
                        .map(line -> new PutawaySplitLineDto(
                                line.locationCode(),
                                line.allocatedQuantity(),
                                line.reason()
                        ))
                        .collect(Collectors.toList()),
                plan.notes()
        );
    }
}
