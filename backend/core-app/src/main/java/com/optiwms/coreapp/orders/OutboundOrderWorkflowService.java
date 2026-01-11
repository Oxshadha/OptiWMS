package com.optiwms.coreapp.orders;

import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.coreapp.operations.TaskOperationService;
import com.optiwms.coreapp.operations.MaterialLocationAssignmentService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.domain.master.Material;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Centralized service for managing outbound order workflow:
 * - Automatic task creation
 * - Status transitions (pending → picking → picked → packing → ready_to_ship → shipped)
 * - Task assignment and locking
 */
@Service
public class OutboundOrderWorkflowService {

    private final OrderService orderService;
    private final TaskService taskService;
    private final OrderItemRepository orderItemRepository;
    private final MaterialLocationAssignmentService materialLocationService;
    private final MaterialService materialService;
    private final TaskOperationService taskOperationService;

    public OutboundOrderWorkflowService(
            OrderService orderService,
            TaskService taskService,
            OrderItemRepository orderItemRepository,
            MaterialLocationAssignmentService materialLocationService,
            MaterialService materialService,
            TaskOperationService taskOperationService) {
        this.orderService = orderService;
        this.taskService = taskService;
        this.orderItemRepository = orderItemRepository;
        this.materialLocationService = materialLocationService;
        this.materialService = materialService;
        this.taskOperationService = taskOperationService;
    }

    /**
     * Create picking tasks automatically when outbound order is created
     */
    @Transactional
    public void createPickingTasksForOrder(UUID orderId) {
        Order order = orderService.findById(orderId);
        
        if (!"outbound".equals(order.getOrderType())) {
            return; // Only create tasks for outbound orders
        }

        if (order.getWarehouseId() == null) {
            throw new RuntimeException("Order must have a warehouse assigned to create picking tasks");
        }

        // Get all order items
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(orderId);
        
        if (orderItems.isEmpty()) {
            return; // No items to pick
        }

        // Create picking tasks with bin locations for each order item
        for (OrderItemEntity item : orderItems) {
            // Get material details
            Material material;
            try {
                material = materialService.findById(item.getMaterialId());
            } catch (Exception e) {
                // Material not found - skip this item or create task without location
                continue;
            }

            // Find all locations where this material is stored
            List<MaterialLocationAssignmentService.LocationInventory> materialLocations = 
                    materialLocationService.findMaterialLocations(item.getMaterialId(), order.getWarehouseId());

            if (materialLocations.isEmpty()) {
                // Material not in any location yet - create task without location (worker will need to find it)
                Task pickingTask = new Task();
                pickingTask.setTaskNumber(generateTaskNumber("PICK", order.getOrderNumber()));
                pickingTask.setTaskType("picking");
                pickingTask.setWarehouseId(order.getWarehouseId());
                pickingTask.setAssignedTo(null);
                pickingTask.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
                pickingTask.setStatus("pending");
                pickingTask.setReferenceType("order");
                pickingTask.setReferenceId(orderId);
                pickingTask.setLocationCode(null); // No location assigned yet
                pickingTask.setNotes(String.format("Pick %s units of %s (Location: TBD - Material not yet assigned to bin)", 
                        item.getQuantity(), 
                        material.getMaterialCode() != null ? material.getMaterialCode() : "Item"));
                
                if (order.getExpectedDate() != null) {
                    pickingTask.setDueDate(order.getExpectedDate().atStartOfDay());
                } else {
                    pickingTask.setDueDate(LocalDateTime.now().plusDays(1));
                }

                taskService.create(pickingTask);
                continue;
            }

            // Create picking task for each location (or consolidate if quantity fits in one location)
            Integer remainingQuantity = item.getQuantity();
            
            for (MaterialLocationAssignmentService.LocationInventory location : materialLocations) {
                if (remainingQuantity <= 0) break;

                Integer quantityToPick = Math.min(remainingQuantity, location.availableQuantity());
                if (quantityToPick <= 0) continue;

                Task pickingTask = new Task();
                pickingTask.setTaskNumber(generateTaskNumber("PICK", order.getOrderNumber()));
                pickingTask.setTaskType("picking");
                pickingTask.setWarehouseId(order.getWarehouseId());
                pickingTask.setAssignedTo(null); // Unassigned - first come first serve
                pickingTask.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
                pickingTask.setStatus("pending");
                pickingTask.setReferenceType("order");
                pickingTask.setReferenceId(orderId);
                pickingTask.setLocationCode(location.locationCode()); // ✅ Bin location assigned
                pickingTask.setNotes(String.format("Pick %s units of %s from location %s (Area: %s, Row: %s, Bay: %s, Level: %s, Bin: %s)", 
                        quantityToPick,
                        material.getMaterialCode() != null ? material.getMaterialCode() : "Item",
                        location.locationCode(),
                        location.area() != null ? location.area() : "N/A",
                        location.rowNumber() != null ? location.rowNumber() : "N/A",
                        location.bayNumber() != null ? location.bayNumber() : "N/A",
                        location.levelNumber() != null ? location.levelNumber().toString() : "N/A",
                        location.binPosition() != null ? location.binPosition() : "N/A"));
                
                // Set due date based on order expected date
                if (order.getExpectedDate() != null) {
                    pickingTask.setDueDate(order.getExpectedDate().atStartOfDay());
                } else {
                    pickingTask.setDueDate(LocalDateTime.now().plusDays(1));
                }

                taskService.create(pickingTask);
                remainingQuantity -= quantityToPick;
            }

            // If still have remaining quantity, create additional tasks
            if (remainingQuantity > 0) {
                // Use first available location or create task without location
                String fallbackLocation = materialLocations.get(0).locationCode();
                
                Task pickingTask = new Task();
                pickingTask.setTaskNumber(generateTaskNumber("PICK", order.getOrderNumber()));
                pickingTask.setTaskType("picking");
                pickingTask.setWarehouseId(order.getWarehouseId());
                pickingTask.setAssignedTo(null);
                pickingTask.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
                pickingTask.setStatus("pending");
                pickingTask.setReferenceType("order");
                pickingTask.setReferenceId(orderId);
                pickingTask.setLocationCode(fallbackLocation);
                pickingTask.setNotes(String.format("Pick %s units of %s from location %s (Additional quantity - may need multiple locations)", 
                        remainingQuantity,
                        material.getMaterialCode() != null ? material.getMaterialCode() : "Item",
                        fallbackLocation));
                
                if (order.getExpectedDate() != null) {
                    pickingTask.setDueDate(order.getExpectedDate().atStartOfDay());
                } else {
                    pickingTask.setDueDate(LocalDateTime.now().plusDays(1));
                }

                taskService.create(pickingTask);
            }
        }

        // Update order status to indicate tasks are ready
        orderService.updateStatus(orderId, "pending");
    }

    /**
     * Claim a task (first come first serve) - locks it for the worker
     * Delegates to TaskOperationService for centralized logic
     */
    @Transactional
    public Task claimTask(UUID taskId, UUID workerId) {
        return taskOperationService.claimTask(taskId, workerId);
    }

    /**
     * Check if all picking tasks for an order are completed
     */
    public boolean areAllPickingTasksCompleted(UUID orderId) {
        List<Task> pickingTasks = taskService.findByType("picking").stream()
                .filter(task -> orderId.equals(task.getReferenceId()))
                .filter(task -> "order".equals(task.getReferenceType()))
                .toList();

        if (pickingTasks.isEmpty()) {
            return false; // No tasks found
        }

        return pickingTasks.stream()
                .allMatch(task -> "completed".equals(task.getStatus()));
    }

    /**
     * Get available tasks for a worker (unassigned tasks in their warehouse)
     */
    public List<Task> getAvailableTasksForWorker(UUID warehouseId, String taskType) {
        return taskService.findByWarehouseAndTypeAndStatus(warehouseId, taskType, "pending");
    }

    /**
     * Check if all order items are picked
     */
    public boolean areAllOrderItemsPicked(UUID orderId) {
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(orderId);
        
        if (orderItems.isEmpty()) {
            return false;
        }

        return orderItems.stream()
                .allMatch(item -> {
                    Integer pickedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
                    Integer requiredQty = item.getQuantity() != null ? item.getQuantity().intValue() : 0;
                    return pickedQty >= requiredQty;
                });
    }

    /**
     * Update order status based on workflow state
     */
    @Transactional
    public void updateOrderStatusIfNeeded(UUID orderId) {
        Order order = orderService.findById(orderId);
        
        if (!"outbound".equals(order.getOrderType())) {
            return; // Only process outbound orders
        }

        String currentStatus = order.getStatus();
        
        // Check if all items are picked
        if (areAllOrderItemsPicked(orderId) && areAllPickingTasksCompleted(orderId)) {
            if (!"picked".equals(currentStatus) && !"packing".equals(currentStatus) && 
                !"ready_to_ship".equals(currentStatus) && !"shipped".equals(currentStatus)) {
                orderService.updateStatus(orderId, "picked");
            }
        } else if ("pending".equals(currentStatus) || "picking".equals(currentStatus)) {
            // Check if any picking has started
            List<Task> pickingTasks = taskService.findByType("picking").stream()
                    .filter(task -> orderId.equals(task.getReferenceId()))
                    .filter(task -> "order".equals(task.getReferenceType()))
                    .toList();
            
            boolean anyTaskAssigned = pickingTasks.stream()
                    .anyMatch(task -> task.getAssignedTo() != null || 
                                   "assigned".equals(task.getStatus()) || 
                                   "in_progress".equals(task.getStatus()));
            
            if (anyTaskAssigned && "pending".equals(currentStatus)) {
                orderService.updateStatus(orderId, "picking");
            }
        }
    }

    /**
     * Generate unique task number
     */
    private String generateTaskNumber(String prefix, String orderNumber) {
        String timestamp = String.valueOf(System.currentTimeMillis());
        return prefix + "-" + orderNumber + "-" + timestamp.substring(timestamp.length() - 6);
    }
}
