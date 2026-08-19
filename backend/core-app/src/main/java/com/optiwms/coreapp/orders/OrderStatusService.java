package com.optiwms.coreapp.orders;

import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.tasks.Task;
import com.optiwms.domain.orders.Order;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Centralized service for managing order status updates.
 * Handles status transitions: pending → received → put_away → picked → shipped
 */
@Service
public class OrderStatusService {

    private final OrderService orderService;
    private final OrderItemRepository orderItemRepository;
    private final TaskService taskService;

    public OrderStatusService(OrderService orderService, OrderItemRepository orderItemRepository,
            TaskService taskService) {
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.taskService = taskService;
    }

    /**
     * Check and update order status after receiving items
     * Status: pending → received (when all items received)
     */
    @Transactional
    public void updateStatusAfterReceiving(UUID orderId) {
        Order order = orderService.findById(orderId);
        if (!"inbound".equals(order.getOrderType())) {
            return; // Only for inbound orders
        }

        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(orderId);
        if (orderItems.isEmpty()) {
            return;
        }

        // Check if all items are received
        boolean allReceived = orderItems.stream().allMatch(item -> {
            Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
            Integer orderedQty = item.getQuantity() != null ? item.getQuantity().intValue() : 0;
            return receivedQty >= orderedQty && "received".equals(item.getStatus());
        });

        if (allReceived) {
            orderService.updateStatus(orderId, "received");
        } else {
            // Check if any items are received
            boolean anyReceived = orderItems.stream().anyMatch(item -> {
                Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
                return receivedQty > 0;
            });
            if (anyReceived) {
                orderService.updateStatus(orderId, "partially_received");
            }
        }
    }

    /**
     * Check and update order status after putaway
     * Status: received → put_away (when all items put away)
     */
    @Transactional
    public void updateStatusAfterPutaway(UUID orderId) {
        Order order = orderService.findById(orderId);
        if (!"inbound".equals(order.getOrderType())) {
            return; // Only for inbound orders
        }

        // Update status to "put_away" - this is called when all items are confirmed put away
        if ("quality_approved".equals(order.getStatus())
                || "putaway_in_progress".equals(order.getStatus())
                || "received".equals(order.getStatus())
                || "partially_received".equals(order.getStatus())) {
            orderService.updateStatus(orderId, "put_away");
        }
    }

    /**
     * Check and update order status after picking
     * Status: put_away → picked (when all items picked)
     */
    @Transactional
    public void updateStatusAfterPicking(UUID orderId) {
        Order order = orderService.findById(orderId);
        if (!"outbound".equals(order.getOrderType())) {
            return; // Only for outbound orders
        }

        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(orderId);
        if (orderItems.isEmpty()) {
            return;
        }

        // Check if all items are picked
        boolean allPicked = orderItems.stream().allMatch(item -> {
            Integer pickedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
            Integer orderedQty = item.getQuantity() != null ? item.getQuantity().intValue() : 0;
            return pickedQty >= orderedQty;
        });

        if (allPicked) {
            orderService.updateStatus(orderId, "picked");
        }
    }

    /**
     * Check and update order status after shipping
     * Status: picked → shipped (when all items shipped)
     */
    @Transactional
    public void updateStatusAfterShipping(UUID orderId) {
        Order order = orderService.findById(orderId);
        if (!"outbound".equals(order.getOrderType())) {
            return; // Only for outbound orders
        }

        // Shipping status is typically updated manually or via shipment service
        // This method can be enhanced based on shipment tracking
    }

    /**
     * Get orders that need putaway (received but not yet put away)
     */
    public List<Order> getOrdersNeedingPutaway(UUID warehouseId) {
        // Get inbound orders that are received or partially_received
        List<Order> receivedOrders = orderService.findByType("inbound").stream()
                .filter(order -> warehouseId == null || warehouseId.equals(order.getWarehouseId()))
                .filter(order -> "quality_approved".equals(order.getStatus()) || "putaway_in_progress".equals(order.getStatus()))
                .toList();

        // Only orders with work actually left to do.
        //
        // Having received stock is not the same as having putaway outstanding: an order whose
        // pallets have all been put away kept matching on received quantity alone, so finished
        // orders stayed in the worker's list forever and there was no way to tell what was still
        // owed from what was already done.
        return receivedOrders.stream()
                .filter(order -> hasOutstandingPutaway(order.getId()))
                .toList();
    }

    /** True when some received line still has a putaway task open, or has no task at all yet. */
    private boolean hasOutstandingPutaway(UUID orderId) {
        List<OrderItemEntity> items = orderItemRepository.findByOrderId(orderId);
        return items.stream().anyMatch(item -> {
            Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
            if (receivedQty <= 0) {
                return false;
            }
            List<Task> tasks = taskService.findByTaskTypeAndReference("putaway", "order_item", item.getId());
            if (tasks.isEmpty()) {
                // Received but not yet planned: still the worker's problem.
                return true;
            }
            return tasks.stream().anyMatch(task -> !"completed".equalsIgnoreCase(task.getStatus()));
        });
    }
}
