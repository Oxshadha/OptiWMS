package com.optiwms.coreapi.orders;

import com.optiwms.coreapp.orders.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService service;

    public OrderController(OrderService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<OrderDto>> list() {
        var data = service.listAll().stream()
                .map(o -> new OrderDto(
                        o.getId(),
                        o.getOrderNumber(),
                        o.getOrderType(),
                        o.getCustomerId(),
                        o.getSupplierId(),
                        o.getWarehouseId(),
                        o.getStatus(),
                        o.getPriority(),
                        o.getOrderDate(),
                        o.getExpectedDate(),
                        o.getTotalAmount(),
                        o.getNotes()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> getById(@PathVariable java.util.UUID id) {
        try {
            var order = service.findById(id);
            return ResponseEntity.ok(new OrderDto(
                    order.getId(),
                    order.getOrderNumber(),
                    order.getOrderType(),
                    order.getCustomerId(),
                    order.getSupplierId(),
                    order.getWarehouseId(),
                    order.getStatus(),
                    order.getPriority(),
                    order.getOrderDate(),
                    order.getExpectedDate(),
                    order.getTotalAmount(),
                    order.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/inbound")
    public ResponseEntity<List<OrderDto>> listInbound() {
        var data = service.findByType("inbound").stream()
                .map(o -> new OrderDto(
                        o.getId(),
                        o.getOrderNumber(),
                        o.getOrderType(),
                        o.getCustomerId(),
                        o.getSupplierId(),
                        o.getWarehouseId(),
                        o.getStatus(),
                        o.getPriority(),
                        o.getOrderDate(),
                        o.getExpectedDate(),
                        o.getTotalAmount(),
                        o.getNotes()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/outbound")
    public ResponseEntity<List<OrderDto>> listOutbound() {
        var data = service.findByType("outbound").stream()
                .map(o -> new OrderDto(
                        o.getId(),
                        o.getOrderNumber(),
                        o.getOrderType(),
                        o.getCustomerId(),
                        o.getSupplierId(),
                        o.getWarehouseId(),
                        o.getStatus(),
                        o.getPriority(),
                        o.getOrderDate(),
                        o.getExpectedDate(),
                        o.getTotalAmount(),
                        o.getNotes()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @PostMapping
    public ResponseEntity<OrderDto> create(@RequestBody CreateOrderRequest request) {
        try {
            var order = new com.optiwms.domain.orders.Order();
            order.setOrderNumber(request.orderNumber());
            order.setOrderType(request.orderType());
            order.setCustomerId(request.customerId());
            order.setSupplierId(request.supplierId());
            order.setWarehouseId(request.warehouseId());
            order.setStatus(request.status());
            order.setPriority(request.priority());
            order.setOrderDate(request.orderDate());
            order.setExpectedDate(request.expectedDate());
            order.setTotalAmount(request.totalAmount());
            order.setNotes(request.notes());

            var created = service.create(order);
            return ResponseEntity.ok(new OrderDto(
                    created.getId(),
                    created.getOrderNumber(),
                    created.getOrderType(),
                    created.getCustomerId(),
                    created.getSupplierId(),
                    created.getWarehouseId(),
                    created.getStatus(),
                    created.getPriority(),
                    created.getOrderDate(),
                    created.getExpectedDate(),
                    created.getTotalAmount(),
                    created.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrderDto> update(@PathVariable java.util.UUID id, @RequestBody UpdateOrderRequest request) {
        try {
            var order = new com.optiwms.domain.orders.Order();
            order.setOrderNumber(request.orderNumber());
            order.setOrderType(request.orderType());
            order.setCustomerId(request.customerId());
            order.setSupplierId(request.supplierId());
            order.setWarehouseId(request.warehouseId());
            order.setStatus(request.status());
            order.setPriority(request.priority());
            order.setOrderDate(request.orderDate());
            order.setExpectedDate(request.expectedDate());
            order.setTotalAmount(request.totalAmount());
            order.setNotes(request.notes());

            var updated = service.update(id, order);
            return ResponseEntity.ok(new OrderDto(
                    updated.getId(),
                    updated.getOrderNumber(),
                    updated.getOrderType(),
                    updated.getCustomerId(),
                    updated.getSupplierId(),
                    updated.getWarehouseId(),
                    updated.getStatus(),
                    updated.getPriority(),
                    updated.getOrderDate(),
                    updated.getExpectedDate(),
                    updated.getTotalAmount(),
                    updated.getNotes()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable java.util.UUID id) {
        try {
            service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    public record OrderDto(
            java.util.UUID id,
            String orderNumber,
            String orderType,
            java.util.UUID customerId,
            java.util.UUID supplierId,
            java.util.UUID warehouseId,
            String status,
            String priority,
            java.time.LocalDate orderDate,
            java.time.LocalDate expectedDate,
            java.math.BigDecimal totalAmount,
            String notes
    ) {}

    public record CreateOrderRequest(
            String orderNumber,
            String orderType,
            java.util.UUID customerId,
            java.util.UUID supplierId,
            java.util.UUID warehouseId,
            String status,
            String priority,
            java.time.LocalDate orderDate,
            java.time.LocalDate expectedDate,
            java.math.BigDecimal totalAmount,
            String notes
    ) {}

    public record UpdateOrderRequest(
            String orderNumber,
            String orderType,
            java.util.UUID customerId,
            java.util.UUID supplierId,
            java.util.UUID warehouseId,
            String status,
            String priority,
            java.time.LocalDate orderDate,
            java.time.LocalDate expectedDate,
            java.math.BigDecimal totalAmount,
            String notes
    ) {}
}

