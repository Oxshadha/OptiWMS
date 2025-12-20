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

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class PickingService {

    private final TaskService taskService;
    private final OrderService orderService;
    private final OrderItemRepository orderItemRepository;
    private final InventoryService inventoryService;

    public PickingService(TaskService taskService,
                         OrderService orderService,
                         OrderItemRepository orderItemRepository,
                         InventoryService inventoryService) {
        this.taskService = taskService;
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional
    public PickingResult completePicking(@NonNull UUID taskId, List<PickedItem> pickedItems) {
        Task task = taskService.findById(taskId);
        
        if (!"picking".equals(task.getTaskType())) {
            throw new RuntimeException("Task is not a picking task");
        }

        var referenceId = task.getReferenceId();
        if (referenceId == null) {
            throw new RuntimeException("Task has no associated order");
        }
        Order order = orderService.findById(referenceId);
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(order.getId());

        // Update order items with picked quantities
        for (PickedItem pickedItem : pickedItems) {
            OrderItemEntity orderItem = orderItems.stream()
                    .filter(item -> item.getMaterialId().equals(pickedItem.materialId()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Order item not found"));

            BigDecimal currentPicked = orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : BigDecimal.ZERO;
            orderItem.setPickedQuantity(currentPicked.add(pickedItem.quantity()));
            orderItem.setStatus("picked");
            orderItemRepository.save(orderItem);

            // Update inventory (reduce available quantity)
            var warehouseId = order.getWarehouseId();
            var materialId = pickedItem.materialId();
            if (warehouseId != null && materialId != null) {
                updateInventory(warehouseId, materialId, pickedItem.quantity(), pickedItem.locationCode());
            }
        }

        taskService.updateStatus(taskId, "completed");
        var orderId = order.getId();
        if (orderId != null) {
            orderService.updateStatus(orderId, "picking");
        }

        return new PickingResult(true, "Picking completed successfully", taskId);
    }

    private void updateInventory(@NonNull UUID warehouseId, @NonNull UUID materialId, BigDecimal quantity, String locationCode) {
        List<InventoryItem> existing = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        
        if (existing.isEmpty()) {
            throw new RuntimeException("Inventory not found for material: " + materialId);
        }

        InventoryItem inventoryItem = existing.get(0);
        BigDecimal newAvailable = inventoryItem.getAvailableQuantity().subtract(quantity);
        if (newAvailable.compareTo(BigDecimal.ZERO) < 0) {
            throw new RuntimeException("Insufficient inventory for material: " + materialId);
        }
        
        inventoryItem.setAvailableQuantity(newAvailable);
        inventoryItem.setReservedQuantity(inventoryItem.getReservedQuantity().add(quantity));
        inventoryService.createOrUpdate(inventoryItem);
    }

    public record PickedItem(UUID materialId, BigDecimal quantity, String locationCode) {}

    public record PickingResult(boolean success, String message, UUID taskId) {}
}

