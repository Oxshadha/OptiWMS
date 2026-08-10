package com.optiwms.coreapi.orders;

import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OrderStatusService;
import com.optiwms.coreapp.orders.OutboundOrderWorkflowService;
import com.optiwms.coreapp.orders.InboundOrderWorkflowService;
import com.optiwms.domain.notifications.Notification;
import com.optiwms.domain.orders.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.format.DateTimeParseException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
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
    private final NotificationService notificationService;

    public OrderController(OrderService orderService,
                          OrderStatusService orderStatusService,
                          OutboundOrderWorkflowService outboundWorkflowService,
                          InboundOrderWorkflowService inboundWorkflowService,
                          NotificationService notificationService) {
        this.orderService = orderService;
        this.orderStatusService = orderStatusService;
        this.outboundWorkflowService = outboundWorkflowService;
        this.inboundWorkflowService = inboundWorkflowService;
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<OrderDto>> listAll(
            @RequestParam(required = false) String orderType,
            @RequestParam(required = false) String status
    ) {
        List<Order> orders;
        if (orderType != null && status != null) {
            orders = orderService.findByTypeAndStatus(orderType, status);
        } else if (orderType != null) {
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

    @GetMapping("/paged")
    public ResponseEntity<PagedOrderResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String orderType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) String supplierId,
            @RequestParam(required = false) String customerId,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);

        Page<Order> orderPage = orderService.findPaged(
                orderType,
                status,
                priority,
                warehouseId != null && !warehouseId.isBlank() ? UUID.fromString(warehouseId) : null,
                supplierId != null && !supplierId.isBlank() ? UUID.fromString(supplierId) : null,
                customerId != null && !customerId.isBlank() ? UUID.fromString(customerId) : null,
                q,
                PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy))
        );

        List<OrderDto> data = orderPage.getContent().stream()
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(new PagedOrderResponse(
                data,
                orderPage.getNumber(),
                orderPage.getSize(),
                orderPage.getTotalElements(),
                orderPage.getTotalPages()
        ));
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
    public ResponseEntity<?> create(@RequestBody CreateOrderRequest request) {
        LocalDate orderDate;
        try {
            orderDate = request.orderDate() != null && !request.orderDate().isEmpty()
                    ? LocalDate.parse(request.orderDate())
                    : LocalDate.now();
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid orderDate format. Use YYYY-MM-DD."));
        }

        LocalDate expectedDate = null;
        try {
            if (request.expectedDate() != null && !request.expectedDate().isEmpty()) {
                expectedDate = LocalDate.parse(request.expectedDate());
            }
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid expectedDate format. Use YYYY-MM-DD."));
        }

        if (expectedDate != null && expectedDate.isBefore(orderDate)) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Expected delivery date cannot be before order date."));
        }
        if (orderDate.isBefore(LocalDate.now())) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Order date cannot be in the past."));
        }
        String orderType = request.orderType() == null ? "" : request.orderType().trim().toLowerCase();
        if ("inbound".equals(orderType) && (request.supplierId() == null || request.supplierId().isBlank())) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Inbound orders require a supplier."));
        }
        if ("inbound".equals(orderType) && expectedDate == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Inbound orders require an expected delivery date."));
        }
        if ("outbound".equals(orderType) && (request.customerId() == null || request.customerId().isBlank())) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Outbound orders require a customer."));
        }
        if ("outbound".equals(orderType) && expectedDate == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Outbound orders require a required delivery date."));
        }
        if (!"inbound".equals(orderType) && !"outbound".equals(orderType)) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Order type must be inbound or outbound."));
        }

        Order order = new Order();
        order.setOrderNumber(request.orderNumber());
        order.setOrderType(orderType);
        order.setCustomerId(request.customerId() != null ? UUID.fromString(request.customerId()) : null);
        order.setSupplierId(request.supplierId() != null ? UUID.fromString(request.supplierId()) : null);
        order.setWarehouseId(UUID.fromString(request.warehouseId()));
        order.setStatus(request.status() != null ? request.status() : "pending");
        order.setPriority(request.priority() != null ? request.priority() : "normal");
        order.setOrderDate(orderDate);
        order.setExpectedDate(expectedDate);
        if (request.totalAmount() != null && !request.totalAmount().isEmpty()) {
            order.setTotalAmount(new BigDecimal(request.totalAmount()));
        }
        order.setNotes(request.notes());

        Order created = orderService.create(order);

        // Do not fail order creation if task auto-generation fails.
        if ("outbound".equals(created.getOrderType())) {
            try {
                outboundWorkflowService.createPickingTasksForOrder(created.getId());
            } catch (RuntimeException ignored) {
            }
        } else if ("inbound".equals(created.getOrderType())) {
            try {
                inboundWorkflowService.createReceivingTasksForOrder(created.getId());
            } catch (RuntimeException ignored) {
            }
        }

        notifyOrderEvent(
                "Order Created",
                "Order " + created.getOrderNumber() + " was created.",
                created,
                "created"
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PostMapping("/repair/canonical-numbers")
    public ResponseEntity<OrderService.CanonicalOrderRepairResult> repairCanonicalOrderNumbers(
            @RequestBody(required = false) CanonicalOrderRepairRequest request
    ) {
        boolean dryRun = request == null || request.dryRun();
        return ResponseEntity.ok(orderService.repairCanonicalOrderNumbers(dryRun));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<OrderDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody UpdateStatusRequest request
    ) {
        Order updated = orderService.updateStatus(id, request.status());
        notifyOrderEvent(
                "Order Status Updated",
                "Order " + updated.getOrderNumber() + " moved to " + updated.getStatus() + ".",
                updated,
                "status_updated"
        );
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable UUID id,
            @RequestBody UpdateOrderRequest request
    ) {
        Order existingOrder = orderService.findById(id);
        Order order = new Order();
        if (request.expectedDate() != null && !request.expectedDate().isEmpty()) {
            try {
                LocalDate expectedDate = LocalDate.parse(request.expectedDate());
                if (existingOrder.getOrderDate() != null && expectedDate.isBefore(existingOrder.getOrderDate())) {
                    return ResponseEntity.badRequest()
                            .body(new ErrorResponse("Expected delivery date cannot be before order date."));
                }
                order.setExpectedDate(expectedDate);
            } catch (DateTimeParseException e) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Invalid expectedDate format. Use YYYY-MM-DD."));
            }
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
        Order order = orderService.findByOrderNumber(orderNumber);

        if (!"outbound".equals(order.getOrderType())) {
            return ResponseEntity.badRequest()
                    .body(new CreateTasksResponse(false, "Only outbound orders can have picking tasks created", 0));
        }

        int existingTasks = outboundWorkflowService.getAvailableTasksForWorker(
                order.getWarehouseId(), "picking").stream()
                .filter(task -> order.getId().equals(task.getReferenceId()))
                .toList().size();

        outboundWorkflowService.createPickingTasksForOrder(order.getId());

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
    }

    /**
     * Manually trigger picking task creation for an existing outbound order by ID.
     */
    @PostMapping("/{id}/create-tasks")
    public ResponseEntity<CreateTasksResponse> createTasksForOrderById(@PathVariable UUID id) {
        Order order = orderService.findById(id);

        if (!"outbound".equals(order.getOrderType())) {
            return ResponseEntity.badRequest()
                    .body(new CreateTasksResponse(false, "Only outbound orders can have picking tasks created", 0));
        }

        int existingTasks = outboundWorkflowService.getAvailableTasksForWorker(
                order.getWarehouseId(), "picking").stream()
                .filter(task -> order.getId().equals(task.getReferenceId()))
                .toList().size();

        outboundWorkflowService.createPickingTasksForOrder(order.getId());

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

    public record CanonicalOrderRepairRequest(boolean dryRun) {}

    public record UpdateOrderRequest(
            String expectedDate,
            String notes,
            String priority,
            String totalAmount
    ) {}

    public record ErrorResponse(String message) {}

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

    public record PagedOrderResponse(
            List<OrderDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    public record CreateTasksResponse(boolean success, String message, int tasksCreated) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "createdAt";
        }
        return switch (sortBy) {
            case "createdAt", "updatedAt", "orderDate", "expectedDate", "orderNumber", "status", "priority" -> sortBy;
            default -> "createdAt";
        };
    }

    private void notifyOrderEvent(String title, String message, Order order, String eventType) {
        try {
            Notification notification = new Notification();
            notification.setUserId(null);
            notification.setAudienceRoles("admin,warehouse_manager,inbound_coordinator");
            notification.setWarehouseId(order.getWarehouseId());
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setNotificationType("order");
            notification.setRead(false);
            notification.setActionUrl(resolveOrderActionUrl(order));
            notification.setMetadata(
                    "{\"orderId\":\"" + order.getId() + "\",\"orderNumber\":\"" + order.getOrderNumber() + "\",\"status\":\"" + order.getStatus() + "\",\"event\":\"" + eventType + "\"}"
            );
            notification.setCreatedAt(OffsetDateTime.now());
            notificationService.create(notification);
        } catch (Exception ignored) {
            // Notifications must not block order workflows.
        }
    }

    private String resolveOrderActionUrl(Order order) {
        String orderType = order.getOrderType() != null ? order.getOrderType().toLowerCase() : "";
        if ("outbound".equals(orderType)) {
            return "/admin/orders/outbound/" + order.getId();
        }
        if ("inbound".equals(orderType)) {
            return "/admin/orders/inbound";
        }
        return "/admin/orders";
    }
}
