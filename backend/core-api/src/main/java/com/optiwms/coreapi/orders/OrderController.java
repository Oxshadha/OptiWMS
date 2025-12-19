package com.optiwms.coreapi.orders;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.domain.orders.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<List<OrderDto>> listAll(
            @RequestParam(required = false) String orderType,
            @RequestParam(required = false) String status
    ) {
        List<Order> orders;
        if (orderType != null) {
            orders = orderService.findByType(orderType);
        } else if (status != null) {
            orders = orderService.findByStatus(status);
        } else {
            orders = orderService.listAll();
        }

        List<OrderDto> orderDtos = orders.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(orderDtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> getById(@PathVariable UUID id) {
        try {
            Order order = orderService.findById(id);
            return ResponseEntity.ok(toDto(order));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/number/{orderNumber}")
    public ResponseEntity<OrderDto> getByOrderNumber(@PathVariable String orderNumber) {
        try {
            Order order = orderService.findByOrderNumber(orderNumber);
            return ResponseEntity.ok(toDto(order));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<OrderDto> create(@RequestBody CreateOrderRequest request) {
        try {
            Order order = new Order();
            order.setOrderNumber(request.orderNumber());
            order.setOrderType(request.orderType());
            order.setCustomerId(request.customerId() != null ? UUID.fromString(request.customerId()) : null);
            order.setSupplierId(request.supplierId() != null ? UUID.fromString(request.supplierId()) : null);
            order.setWarehouseId(UUID.fromString(request.warehouseId()));
            order.setStatus(request.status() != null ? request.status() : "pending");
            order.setPriority(request.priority() != null ? request.priority() : "normal");
            if (request.orderDate() != null && !request.orderDate().isEmpty()) {
                order.setOrderDate(LocalDate.parse(request.orderDate()));
            } else {
                order.setOrderDate(LocalDate.now());
            }
            if (request.expectedDate() != null && !request.expectedDate().isEmpty()) {
                order.setExpectedDate(LocalDate.parse(request.expectedDate()));
            }
            if (request.totalAmount() != null && !request.totalAmount().isEmpty()) {
                order.setTotalAmount(new BigDecimal(request.totalAmount()));
            }
            order.setNotes(request.notes());

            Order created = orderService.create(order);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<OrderDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody UpdateStatusRequest request
    ) {
        try {
            Order updated = orderService.updateStatus(id, request.status());
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private OrderDto toDto(Order order) {
        return new OrderDto(
                order.getId().toString(),
                order.getOrderNumber(),
                order.getOrderType(),
                order.getCustomerId() != null ? order.getCustomerId().toString() : null,
                order.getSupplierId() != null ? order.getSupplierId().toString() : null,
                order.getWarehouseId().toString(),
                order.getStatus(),
                order.getPriority(),
                order.getOrderDate() != null ? order.getOrderDate().toString() : null,
                order.getExpectedDate() != null ? order.getExpectedDate().toString() : null,
                order.getTotalAmount() != null ? order.getTotalAmount().toString() : null,
                order.getNotes()
        );
    }

    public record CreateOrderRequest(
            String orderNumber,
            String orderType,
            String customerId,
            String supplierId,
            String warehouseId,
            String status,
            String priority,
            String orderDate,
            String expectedDate,
            String totalAmount,
            String notes
    ) {}

    public record UpdateStatusRequest(String status) {}

    public record OrderDto(
            String id,
            String orderNumber,
            String orderType,
            String customerId,
            String supplierId,
            String warehouseId,
            String status,
            String priority,
            String orderDate,
            String expectedDate,
            String totalAmount,
            String notes
    ) {}
}

