package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OutboundOrderWorkflowService;
import com.optiwms.coreapp.operations.TaskOperationService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import com.optiwms.infra.orders.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PickingService {

    private final TaskService taskService;
    private final OrderService orderService;
    private final OrderItemRepository orderItemRepository;
    private final OrderRepository orderRepository;
    private final InventoryService inventoryService;
    private final OutboundOrderWorkflowService workflowService;
    private final TaskOperationService taskOperationService;

    public PickingService(TaskService taskService,
                         OrderService orderService,
                         OrderItemRepository orderItemRepository,
                         OrderRepository orderRepository,
                         InventoryService inventoryService,
                         OutboundOrderWorkflowService workflowService,
                         TaskOperationService taskOperationService) {
        this.taskService = taskService;
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.orderRepository = orderRepository;
        this.inventoryService = inventoryService;
        this.workflowService = workflowService;
        this.taskOperationService = taskOperationService;
    }

    @Transactional
    public PickingResult completePicking(UUID taskId, List<PickedItem> pickedItems, UUID workerId) {
        Task task = taskService.findById(taskId);
        
        if (!"picking".equals(task.getTaskType())) {
            throw new RuntimeException("Task is not a picking task");
        }

        if (task.getReferenceId() == null) {
            throw new RuntimeException("Task has no associated order");
        }

        Order order = orderService.findById(task.getReferenceId());
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(order.getId());

        // Update order items with picked quantities
        for (PickedItem pickedItem : pickedItems) {
            OrderItemEntity orderItem = orderItems.stream()
                    .filter(item -> item.getMaterialId().equals(pickedItem.materialId()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Order item not found"));

            Integer currentPicked = orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : 0;
            // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
            Integer pickedQty = (int) Math.ceil(pickedItem.quantity().doubleValue());
            orderItem.setPickedQuantity(currentPicked + pickedQty);
            orderItem.setStatus("picked");
            orderItemRepository.save(orderItem);

            // Update inventory (reduce available quantity)
            updateInventory(order.getWarehouseId(), pickedItem.materialId(), pickedItem.quantity(), pickedItem.locationCode());
        }

        // Complete task using centralized service (updates task status and worker records)
        taskOperationService.completeTask(taskId, workerId, "picked");
        
        // Update order status through workflow service (checks if all items are picked)
        workflowService.updateOrderStatusIfNeeded(order.getId());

        return new PickingResult(true, "Picking completed successfully", taskId);
    }

    private void updateInventory(UUID warehouseId, UUID materialId, BigDecimal quantity, String locationCode) {
        List<InventoryItem> existing = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        
        if (existing.isEmpty()) {
            throw new RuntimeException("Inventory not found for material: " + materialId);
        }

        // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
        Integer qtyInteger = (int) Math.ceil(quantity.doubleValue());
        
        InventoryItem inventoryItem = existing.get(0);
        Integer newAvailable = (inventoryItem.getAvailableQuantity() != null ? inventoryItem.getAvailableQuantity() : 0) - qtyInteger;
        if (newAvailable < 0) {
            throw new RuntimeException("Insufficient inventory for material: " + materialId);
        }
        
        inventoryItem.setAvailableQuantity(newAvailable);
        inventoryItem.setReservedQuantity((inventoryItem.getReservedQuantity() != null ? inventoryItem.getReservedQuantity() : 0) + qtyInteger);
        inventoryService.createOrUpdate(inventoryItem);
    }

    public record PickedItem(UUID materialId, BigDecimal quantity, String locationCode) {}

    public record PickingResult(boolean success, String message, UUID taskId) {}
}

