package com.optiwms.coreapi.orders;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OrderStatusService;
import com.optiwms.coreapp.orders.OutboundOrderWorkflowService;
import com.optiwms.coreapp.orders.InboundOrderWorkflowService;
import com.optiwms.domain.orders.Order;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;
    private final OrderStatusService orderStatusService;
    private final OutboundOrderWorkflowService outboundWorkflowService;
    private final InboundOrderWorkflowService inboundWorkflowService;

    public OrderController(OrderService orderService,
                          OrderStatusService orderStatusService,
                          OutboundOrderWorkflowService outboundWorkflowService,
                          InboundOrderWorkflowService inboundWorkflowService) {
        this.orderService = orderService;
        this.orderStatusService = orderStatusService;
        this.outboundWorkflowService = outboundWorkflowService;
        this.inboundWorkflowService = inboundWorkflowService;
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
        Order order = orderService.findById(id);
        return ResponseEntity.ok(toDto(order));
    }

    @GetMapping("/number/{orderNumber}")
    public ResponseEntity<OrderDto> getByOrderNumber(@PathVariable String orderNumber) {
        Order order = orderService.findByOrderNumber(orderNumber);
        return ResponseEntity.ok(toDto(order));
    }

    /**
     * Get orders that need putaway (received but not yet put away)
     * For putaway workers to see available orders
     */
    @GetMapping("/warehouse/{warehouseId}/needs-putaway")
    public ResponseEntity<List<OrderDto>> getOrdersNeedingPutaway(@PathVariable UUID warehouseId) {
        List<Order> orders = orderStatusService.getOrdersNeedingPutaway(warehouseId);
        List<OrderDto> orderDtos = orders.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(orderDtos);
    }

    /**
     * Get orders that need receiving (pending inbound orders)
     * For receiving workers to see available orders
     */
    @GetMapping("/warehouse/{warehouseId}/needs-receiving")
    public ResponseEntity<List<OrderDto>> getOrdersNeedingReceiving(@PathVariable UUID warehouseId) {
        List<Order> orders = orderService.findByType("inbound").stream()
                .filter(order -> warehouseId.equals(order.getWarehouseId()))
                .filter(order -> "pending".equals(order.getStatus()) || "partially_received".equals(order.getStatus()))
                .collect(Collectors.toList());
        List<OrderDto> orderDtos = orders.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(orderDtos);
    }

    @PostMapping
    public ResponseEntity<OrderDto> create(@Valid @RequestBody CreateOrderRequest request) {
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
        
        // Automatically create tasks for orders
        try {
            if ("outbound".equals(created.getOrderType())) {
                // Create picking tasks for outbound orders
                outboundWorkflowService.createPickingTasksForOrder(created.getId());
            } else if ("inbound".equals(created.getOrderType())) {
                // Create receiving tasks for inbound orders (first-come-first-serve)
                inboundWorkflowService.createReceivingTasksForOrder(created.getId());
            }
        } catch (RuntimeException e) {
            // Log error but don't fail order creation
            // Tasks can be created manually if needed
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<OrderDto> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStatusRequest request
    ) {
        Order updated = orderService.updateStatus(id, request.status());
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrderDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrderRequest request
    ) {
        Order order = new Order();
        if (request.expectedDate() != null && !request.expectedDate().isEmpty()) {
            order.setExpectedDate(LocalDate.parse(request.expectedDate()));
        }
        if (request.notes() != null) {
            order.setNotes(request.notes());
        }
        if (request.priority() != null) {
            order.setPriority(request.priority());
        }
        if (request.totalAmount() != null && !request.totalAmount().isEmpty()) {
            order.setTotalAmount(new BigDecimal(request.totalAmount()));
        }
        
        Order updated = orderService.update(id, order);
        return ResponseEntity.ok(toDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        orderService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Manually trigger picking task creation for an existing outbound order.
     * Useful when tasks weren't created automatically or need to be recreated.
     * 
     * Example: POST /api/orders/number/OUT-001768109538570/create-tasks
     */
    @PostMapping("/number/{orderNumber}/create-tasks")
    public ResponseEntity<CreateTasksResponse> createTasksForOrder(@PathVariable String orderNumber) {
        try {
            Order order = orderService.findByOrderNumber(orderNumber);
            
            if (!"outbound".equals(order.getOrderType())) {
                return ResponseEntity.badRequest()
                    .body(new CreateTasksResponse(false, "Only outbound orders can have picking tasks created", 0));
            }
            
            // Check if tasks already exist
            int existingTasks = outboundWorkflowService.getAvailableTasksForWorker(
                order.getWarehouseId(), "picking").stream()
                .filter(task -> order.getId().equals(task.getReferenceId()))
                .toList().size();
            
            // Create picking tasks
            outboundWorkflowService.createPickingTasksForOrder(order.getId());
            
            // Count newly created tasks
            int newTasks = outboundWorkflowService.getAvailableTasksForWorker(
                order.getWarehouseId(), "picking").stream()
                .filter(task -> order.getId().equals(task.getReferenceId()))
                .toList().size();
            
            int createdCount = newTasks - existingTasks;
            
            return ResponseEntity.ok(new CreateTasksResponse(
                true, 
                String.format("Created %d picking task(s) for order %s", createdCount, orderNumber),
                createdCount
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new CreateTasksResponse(false, e.getMessage(), 0));
        }
    }

    /**
     * Manually trigger picking task creation for an existing outbound order by ID.
     */
    @PostMapping("/{id}/create-tasks")
    public ResponseEntity<CreateTasksResponse> createTasksForOrderById(@PathVariable UUID id) {
        try {
            Order order = orderService.findById(id);
            
            if (!"outbound".equals(order.getOrderType())) {
                return ResponseEntity.badRequest()
                    .body(new CreateTasksResponse(false, "Only outbound orders can have picking tasks created", 0));
            }
            
            // Check if tasks already exist
            int existingTasks = outboundWorkflowService.getAvailableTasksForWorker(
                order.getWarehouseId(), "picking").stream()
                .filter(task -> order.getId().equals(task.getReferenceId()))
                .toList().size();
            
            // Create picking tasks
            outboundWorkflowService.createPickingTasksForOrder(order.getId());
            
            // Count newly created tasks
            int newTasks = outboundWorkflowService.getAvailableTasksForWorker(
                order.getWarehouseId(), "picking").stream()
                .filter(task -> order.getId().equals(task.getReferenceId()))
                .toList().size();
            
            int createdCount = newTasks - existingTasks;
            
            return ResponseEntity.ok(new CreateTasksResponse(
                true, 
                String.format("Created %d picking task(s) for order %s", createdCount, order.getOrderNumber()),
                createdCount
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new CreateTasksResponse(false, e.getMessage(), 0));
        }
    }

    @PostMapping("/suppliers/{supplierId}/approve-purchase-orders")
    public ResponseEntity<ApprovePurchaseOrdersResponse> approvePurchaseOrders(
            @PathVariable UUID supplierId,
            @Valid @RequestBody(required = false) ApprovePurchaseOrdersRequest request
    ) {
        try {
            UUID approvedBy = null;
            String note = null;
            if (request != null) {
                approvedBy = request.approvedBy() != null && !request.approvedBy().isBlank()
                        ? UUID.fromString(request.approvedBy())
                        : null;
                note = request.note();
            }

            int approvedCount = orderService.approveInboundPurchaseOrdersBySupplier(supplierId, approvedBy, note);
            return ResponseEntity.ok(new ApprovePurchaseOrdersResponse(
                    supplierId.toString(),
                    approvedCount,
                    String.format("Approved %d pending inbound purchase order(s)", approvedCount)
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ApprovePurchaseOrdersResponse(
                    supplierId.toString(),
                    0,
                    e.getMessage()
            ));
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
            @NotBlank @Size(max = 50) String orderNumber,
            @NotBlank @Pattern(regexp = "(?i)inbound|outbound") String orderType,
            String customerId,
            String supplierId,
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String warehouseId,
            @Pattern(regexp = "^[A-Za-z_]+$") String status,
            @Pattern(regexp = "^[A-Za-z_]+$") String priority,
            @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$") String orderDate,
            @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$") String expectedDate,
            @Pattern(regexp = "^-?\\d+(\\.\\d{1,2})?$") String totalAmount,
            String notes
    ) {}

    public record UpdateStatusRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z_]+$") String status
    ) {}

    public record UpdateOrderRequest(
            @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$") String expectedDate,
            String notes,
            @Pattern(regexp = "^[A-Za-z_]+$") String priority,
            @Pattern(regexp = "^-?\\d+(\\.\\d{1,2})?$") String totalAmount
    ) {}

    public record ApprovePurchaseOrdersRequest(
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String approvedBy,
            String note
    ) {}

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

    public record CreateTasksResponse(boolean success, String message, int tasksCreated) {}

    public record ApprovePurchaseOrdersResponse(
            String supplierId,
            Integer approvedCount,
            String message
    ) {}
}
