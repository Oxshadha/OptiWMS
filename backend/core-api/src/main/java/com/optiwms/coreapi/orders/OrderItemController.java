package com.optiwms.coreapi.orders;

import com.optiwms.coreapp.orders.OrderItemService;
import com.optiwms.domain.orders.OrderItem;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderItemController {

    private final OrderItemService orderItemService;

    public OrderItemController(OrderItemService orderItemService) {
        this.orderItemService = orderItemService;
    }

    @GetMapping("/{orderId}/items")
    public ResponseEntity<List<OrderItemDto>> getByOrderId(@PathVariable UUID orderId) {
        List<OrderItem> items = orderItemService.findByOrderId(orderId);
        List<OrderItemDto> dtos = items.stream()
                .map(this::toDto)
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
        // Filter to only items that have been received (picked_quantity > 0)
        List<PutawayItemDto> putawayItems = items.stream()
                .filter(item -> item.getPickedQuantity() != null && item.getPickedQuantity() > 0)
                .map(item -> {
                    // Get suggested location from material location assignment or task
                    String suggestedLocation = null; // Will be populated from task or material location service
                    return new PutawayItemDto(
                            item.getId().toString(),
                            item.getMaterialId().toString(),
                            item.getPickedQuantity(), // Received quantity
                            item.getQuantity(), // Ordered quantity
                            suggestedLocation,
                            item.getStatus()
                    );
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(putawayItems);
    }

    @PostMapping("/{orderId}/items")
    public ResponseEntity<OrderItemDto> create(@PathVariable UUID orderId, @RequestBody CreateOrderItemRequest request) {
        OrderItem item = new OrderItem();
        item.setOrderId(orderId);
        item.setMaterialId(UUID.fromString(request.materialId()));
        item.setQuantity(request.quantity());
        item.setUnitPrice(request.unitPrice() != null ? new java.math.BigDecimal(request.unitPrice()) : null);
        item.setLocationCode(request.locationCode());
        item.setStatus("pending");

        OrderItem created = orderItemService.create(item);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(toDto(created));
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
        item.setStatus(request.status());

        OrderItem updated = orderItemService.update(itemId, item);
        return ResponseEntity.ok(toDto(updated));
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
            String status
    ) {}

    public record CreateOrderItemRequest(
            String materialId,
            Integer quantity,
            String unitPrice,
            String locationCode
    ) {}

    public record UpdateOrderItemRequest(
            Integer quantity,
            String unitPrice,
            String locationCode,
            String status
    ) {}

    public record PutawayItemDto(
            String itemId,
            String materialId,
            Integer receivedQuantity,
            Integer orderedQuantity,
            String suggestedLocation,
            String status
    ) {}
}
