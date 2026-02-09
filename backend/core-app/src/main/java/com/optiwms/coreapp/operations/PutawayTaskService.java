package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.coreapp.operations.LocationSuggestionService;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Service for creating putaway tasks after receiving.
 * 
 * This is CRITICAL for the workflow:
 * 1. Items are received → inventory created (no location yet)
 * 2. Putaway tasks are created automatically
 * 3. Worker completes putaway → items assigned to bin locations
 * 4. Inventory gets locationCode → shows in warehouse layout
 */
@Service
public class PutawayTaskService {

    private final TaskService taskService;
    private final OrderService orderService;
    private final OrderItemRepository orderItemRepository;
    private final MaterialService materialService;
    private final LocationSuggestionService locationSuggestionService;

    public PutawayTaskService(
            TaskService taskService,
            OrderService orderService,
            OrderItemRepository orderItemRepository,
            MaterialService materialService,
            LocationSuggestionService locationSuggestionService) {
        this.taskService = taskService;
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.materialService = materialService;
        this.locationSuggestionService = locationSuggestionService;
    }

    /**
     * Create putaway tasks for received items in an inbound order.
     * Called automatically after receiving is completed.
     */
    @Transactional
    public void createPutawayTasksForReceivedOrder(UUID orderId, UUID warehouseId) {
        Order order = orderService.findById(orderId);
        
        if (!"inbound".equals(order.getOrderType())) {
            return; // Only create putaway tasks for inbound orders
        }

        if (warehouseId == null) {
            warehouseId = order.getWarehouseId();
        }

        if (warehouseId == null) {
            throw new RuntimeException("Warehouse ID is required to create putaway tasks");
        }

        // Get all order items that have been received
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(orderId);
        
        if (orderItems.isEmpty()) {
            return; // No items to put away
        }

        // Create putaway task for each received item
        for (OrderItemEntity item : orderItems) {
            // Only create tasks for items that have been received (picked_quantity > 0 for inbound)
            Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
            if (receivedQty <= 0) {
                continue; // Skip items that haven't been received yet
            }

            // Get material details
            Material material;
            try {
                material = materialService.findById(item.getMaterialId());
            } catch (Exception e) {
                // Material not found - skip this item
                continue;
            }

            // Suggest optimal location (with AI support if available)
            String suggestedLocation = null;
            try {
                com.optiwms.coreapp.operations.LocationSuggestionService.LocationSuggestion suggestion = 
                        locationSuggestionService.suggestPutawayLocation(
                                warehouseId,
                                item.getMaterialId(),
                                receivedQty,
                                material.getMaterialType() != null ? material.getMaterialType() : "product"
                        );
                suggestedLocation = suggestion.getLocationCode();
            } catch (Exception e) {
                // Location suggestion failed - create task without suggested location
                // Worker will need to select location manually
            }

            // Create putaway task
            Task putawayTask = new Task();
            putawayTask.setTaskNumber(generateTaskNumber("PUT", order.getOrderNumber()));
            putawayTask.setTaskType("putaway");
            putawayTask.setWarehouseId(warehouseId);
            putawayTask.setAssignedTo(null); // Unassigned - first come first serve
            putawayTask.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
            putawayTask.setStatus("pending");
            putawayTask.setReferenceType("order");
            putawayTask.setReferenceId(orderId);
            putawayTask.setLocationCode(suggestedLocation); // Suggested location (worker can change)
            putawayTask.setNotes(String.format("Put away %s units of %s%s", 
                    receivedQty,
                    material.getMaterialCode() != null ? material.getMaterialCode() : "Item",
                    suggestedLocation != null ? " to location " + suggestedLocation : " (location to be selected)"));
            
            if (order.getExpectedDate() != null) {
                putawayTask.setDueDate(order.getExpectedDate().atStartOfDay());
            } else {
                putawayTask.setDueDate(LocalDateTime.now().plusDays(1));
            }

            taskService.create(putawayTask);
        }
    }

    /**
     * Create putaway task for blind received items (no order).
     */
    @Transactional
    public void createPutawayTaskForBlindReceive(UUID warehouseId, UUID materialId, Integer quantity) {
        if (warehouseId == null || materialId == null || quantity == null || quantity <= 0) {
            throw new RuntimeException("Invalid parameters for putaway task creation");
        }

        // Get material details
        Material material;
        try {
            material = materialService.findById(materialId);
        } catch (Exception e) {
            throw new RuntimeException("Material not found: " + materialId);
        }

        // Suggest optimal location
        String suggestedLocation = null;
        try {
            com.optiwms.coreapp.operations.LocationSuggestionService.LocationSuggestion suggestion = 
                    locationSuggestionService.suggestPutawayLocation(
                            warehouseId,
                            materialId,
                            quantity,
                            material.getMaterialType() != null ? material.getMaterialType() : "product"
                    );
            suggestedLocation = suggestion.getLocationCode();
        } catch (Exception e) {
            // Location suggestion failed - create task without suggested location
        }

        // Create putaway task
        Task putawayTask = new Task();
        putawayTask.setTaskNumber(generateTaskNumber("PUT", "BLIND"));
        putawayTask.setTaskType("putaway");
        putawayTask.setWarehouseId(warehouseId);
        putawayTask.setAssignedTo(null); // Unassigned - first come first serve
        putawayTask.setPriority("normal");
        putawayTask.setStatus("pending");
        putawayTask.setReferenceType(null);
        putawayTask.setReferenceId(null);
        putawayTask.setLocationCode(suggestedLocation);
        putawayTask.setNotes(String.format("Put away %s units of %s%s", 
                quantity,
                material.getMaterialCode() != null ? material.getMaterialCode() : "Item",
                suggestedLocation != null ? " to location " + suggestedLocation : " (location to be selected)"));
        putawayTask.setDueDate(LocalDateTime.now().plusDays(1));

        taskService.create(putawayTask);
    }

    /**
     * Generate unique task number
     */
    private String generateTaskNumber(String prefix, String orderNumber) {
        String timestamp = String.valueOf(System.currentTimeMillis());
        return prefix + "-" + orderNumber + "-" + timestamp.substring(timestamp.length() - 6);
    }
}
