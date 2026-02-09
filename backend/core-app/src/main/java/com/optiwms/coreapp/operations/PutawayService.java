package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.operations.MaterialLocationAssignmentService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OrderStatusService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PutawayService {

    private final TaskService taskService;
    private final InventoryService inventoryService;
    private final MaterialLocationAssignmentService materialLocationService;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusService orderStatusService;
    private final OrderService orderService;

    public PutawayService(
            TaskService taskService, 
            InventoryService inventoryService,
            MaterialLocationAssignmentService materialLocationService,
            OrderItemRepository orderItemRepository,
            OrderStatusService orderStatusService,
            OrderService orderService) {
        this.taskService = taskService;
        this.inventoryService = inventoryService;
        this.materialLocationService = materialLocationService;
        this.orderItemRepository = orderItemRepository;
        this.orderStatusService = orderStatusService;
        this.orderService = orderService;
    }

    @Transactional
    public PutawayResult completePutaway(UUID taskId, String locationCode, String lpn, Integer quantity, UUID materialId) {
        Task task = taskService.findById(taskId);
        
        if (!"putaway".equals(task.getTaskType())) {
            throw new RuntimeException("Task is not a putaway task");
        }

        if (!"pending".equals(task.getStatus()) && !"in_progress".equals(task.getStatus())) {
            throw new RuntimeException("Task cannot be completed in current status: " + task.getStatus());
        }

        // Get material ID from task reference (if task references an order item)
        UUID actualMaterialId = materialId;
        Integer actualQuantity = quantity;
        
        if (actualMaterialId == null && task.getReferenceId() != null && "order".equals(task.getReferenceType())) {
            // Try to get material from order item
            List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(task.getReferenceId());
            if (!orderItems.isEmpty()) {
                OrderItemEntity orderItem = orderItems.get(0);
                actualMaterialId = orderItem.getMaterialId();
                // Use pickedQuantity (received quantity) for putaway, not ordered quantity
                // pickedQuantity stores the actual received quantity for inbound orders
                actualQuantity = orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : orderItem.getQuantity();
            }
        }

        if (actualMaterialId == null) {
            throw new RuntimeException("Cannot determine material for putaway task");
        }

        if (actualQuantity == null || actualQuantity <= 0) {
            throw new RuntimeException("Invalid quantity for putaway");
        }

        // Make variables final for lambda
        final UUID finalMaterialId = actualMaterialId;
        final Integer finalQuantity = actualQuantity;
        final UUID finalWarehouseId = task.getWarehouseId();
        final String finalLocationCode = locationCode;

        // Assign material to location using MaterialLocationAssignmentService
        InventoryItem inventoryItem = materialLocationService.assignMaterialToLocation(
                finalMaterialId,
                finalWarehouseId,
                finalQuantity,
                finalLocationCode
        );
        
        inventoryService.createOrUpdate(inventoryItem);

        // Complete task using centralized service (updates task status)
        // Note: Putaway doesn't track worker in order, only in task
        taskService.updateStatus(taskId, "completed");

        // CRITICAL: Check if all items in the order are put away and update order status
        if (task.getReferenceId() != null && "order".equals(task.getReferenceType())) {
            checkAndUpdateOrderStatusAfterPutaway(task.getReferenceId());
        }

        return new PutawayResult(true, "Putaway completed successfully. Material assigned to location: " + finalLocationCode, taskId);
    }

    /**
     * Check if all items in an order are put away and update order status
     */
    @Transactional
    private void checkAndUpdateOrderStatusAfterPutaway(UUID orderId) {
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(orderId);
        if (orderItems.isEmpty()) {
            return;
        }

        // Get warehouse ID from order
        UUID warehouseId = null;
        try {
            com.optiwms.domain.orders.Order order = orderService.findById(orderId);
            warehouseId = order.getWarehouseId();
        } catch (Exception e) {
            // If we can't get order, try to get warehouse from inventory
            if (!orderItems.isEmpty()) {
                List<InventoryItem> inventory = inventoryService.findByMaterial(orderItems.get(0).getMaterialId());
                if (!inventory.isEmpty()) {
                    warehouseId = inventory.get(0).getWarehouseId();
                }
            }
        }

        if (warehouseId == null) {
            return; // Can't determine warehouse
        }

        final UUID finalWarehouseId = warehouseId; // Make final for lambda

        // Check if all received items have been put away (have location_code in inventory)
        boolean allPutAway = orderItems.stream().allMatch(item -> {
            Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
            if (receivedQty <= 0) {
                return true; // Not received yet, skip
            }

            // Check if inventory has location_code for this material
            List<InventoryItem> inventoryItems = inventoryService.findByMaterialAndWarehouse(
                    item.getMaterialId(),
                    finalWarehouseId
            );

            // Check if at least received quantity has location_code
            int totalWithLocation = inventoryItems.stream()
                    .filter(inv -> inv.getLocationCode() != null && !inv.getLocationCode().isEmpty())
                    .mapToInt(inv -> inv.getQuantity() != null ? inv.getQuantity() : 0)
                    .sum();

            return totalWithLocation >= receivedQty;
        });

        if (allPutAway) {
            // Update order status to "put_away" or "ready_for_picking"
            orderStatusService.updateStatusAfterPutaway(orderId);
        }
    }

    public record PutawayResult(boolean success, String message, UUID taskId) {}
}

