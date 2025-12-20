package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PutawayService {

    private final TaskService taskService;
    private final InventoryService inventoryService;
    private final OrderService orderService;
    private final OrderItemRepository orderItemRepository;

    public PutawayService(TaskService taskService,
                         InventoryService inventoryService,
                         OrderService orderService,
                         OrderItemRepository orderItemRepository) {
        this.taskService = taskService;
        this.inventoryService = inventoryService;
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
    }

    @Transactional
    public PutawayResult completePutaway(@NonNull UUID taskId, String locationCode, String lpn) {
        Task task = taskService.findById(taskId);
        
        if (!"putaway".equals(task.getTaskType())) {
            throw new RuntimeException("Task is not a putaway task");
        }

        if (!"pending".equals(task.getStatus()) && !"in_progress".equals(task.getStatus())) {
            throw new RuntimeException("Task cannot be completed in current status: " + task.getStatus());
        }

        // Update inventory location based on task reference and location code
        if (locationCode != null && !locationCode.isBlank()) {
            updateInventoryLocation(task, locationCode, lpn);
        }
        
        taskService.updateStatus(taskId, "completed");

        return new PutawayResult(true, "Putaway completed successfully", taskId);
    }

    private void updateInventoryLocation(Task task, String locationCode, String lpn) {
        var referenceId = task.getReferenceId();
        var warehouseId = task.getWarehouseId();
        
        if (referenceId == null || warehouseId == null) {
            throw new RuntimeException("Task missing required reference or warehouse information");
        }

        // For putaway tasks, reference is typically an inbound order
        // Find the order and update inventory location for all materials in that order
        try {
            Order order = orderService.findById(referenceId);
            if (!"inbound".equals(order.getOrderType())) {
                throw new RuntimeException("Putaway task reference is not an inbound order");
            }

            // Get order items and update inventory location for each
            List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(referenceId);
            
            for (OrderItemEntity orderItem : orderItems) {
                var materialId = orderItem.getMaterialId();
                if (materialId == null) {
                    continue;
                }

                // Find inventory items for this material and warehouse
                List<InventoryItem> inventoryItems = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
                
                // Update location for items that match the LPN (if provided) or all items if no LPN
                for (InventoryItem item : inventoryItems) {
                    // In a full implementation, we'd match by LPN here
                    // For now, update location if it's not already set or matches the task location
                    if (item.getLocationCode() == null || item.getLocationCode().isBlank()) {
                        item.setLocationCode(locationCode);
                        inventoryService.createOrUpdate(item);
                    } else if (lpn != null && !lpn.isBlank()) {
                        // If LPN is provided, we could match by LPN in the future
                        // For now, update location if location matches task location or is empty
                        item.setLocationCode(locationCode);
                        inventoryService.createOrUpdate(item);
                    }
                }
            }
        } catch (RuntimeException e) {
            // If order not found or other error, log but don't fail the putaway
            // In production, you might want to handle this differently
            throw new RuntimeException("Failed to update inventory location: " + e.getMessage(), e);
        }
    }

    public record PutawayResult(boolean success, String message, UUID taskId) {}
}

