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
        try {
            List<OrderItem> items = orderItemService.findByOrderId(orderId);
            List<OrderItemDto> dtos = items.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
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
}

