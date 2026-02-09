package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.LocationService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.master.Location;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Centralized service for common task operations across picking, putaway, and receiving.
 * 
 * Provides:
 * - Task claiming (first-come-first-serve)
 * - Location verification
 * - Status updates with worker tracking
 * - Order status updates
 */
@Service
public class TaskOperationService {

    private static final Logger logger = LoggerFactory.getLogger(TaskOperationService.class);

    private final TaskService taskService;
    private final OrderService orderService;
    private final LocationService locationService;

    public TaskOperationService(
            TaskService taskService,
            OrderService orderService,
            LocationService locationService) {
        this.taskService = taskService;
        this.orderService = orderService;
        this.locationService = locationService;
    }

    /**
     * Claim a task (first come first serve) - locks it for the worker.
     * This implements the "first come first serve" mechanism where
     * when a worker selects a task, it becomes locked and other workers can't see it.
     * 
     * Works for: picking, putaway, receiving tasks
     */
    @Transactional
    public Task claimTask(UUID taskId, UUID workerId) {
        Task task = taskService.findById(taskId);
        
        // Check if task is already assigned to another worker
        if (task.getAssignedTo() != null && !task.getAssignedTo().equals(workerId)) {
            throw new RuntimeException("Task is already assigned to another worker");
        }

        // Check if task status allows claiming (must be pending)
        if (!"pending".equals(task.getStatus())) {
            throw new RuntimeException("Task cannot be claimed. Current status: " + task.getStatus());
        }

        // Assign task to worker and change status to "assigned" (locks it)
        Task assignedTask = taskService.assignTask(taskId, workerId, "system");
        
        logger.info("Task {} claimed by worker {}", taskId, workerId);
        
        // Update order status if needed (picking/receiving started)
        if (assignedTask.getReferenceId() != null && "order".equals(assignedTask.getReferenceType())) {
            updateOrderStatusIfNeeded(assignedTask.getReferenceId(), assignedTask.getTaskType());
        }
        
        return assignedTask;
    }

    /**
     * Verify that a scanned location matches the task's expected location.
     * 
     * @param taskId Task ID
     * @param scannedLocationCode Location code scanned by worker
     * @return true if location matches, false otherwise
     */
    public boolean verifyLocation(UUID taskId, String scannedLocationCode) {
        Task task = taskService.findById(taskId);
        
        if (task.getLocationCode() == null || task.getLocationCode().isEmpty()) {
            // Task has no location assigned - allow any location
            return true;
        }
        
        if (scannedLocationCode == null || scannedLocationCode.isEmpty()) {
            return false;
        }
        
        // Normalize both codes for comparison (case-insensitive, ignore special chars)
        String normalizedTask = normalizeLocationCode(task.getLocationCode());
        String normalizedScanned = normalizeLocationCode(scannedLocationCode);
        
        // Exact match or contains match
        return normalizedTask.equals(normalizedScanned) || 
               normalizedTask.contains(normalizedScanned) || 
               normalizedScanned.contains(normalizedTask);
    }

    /**
     * Normalize location code for comparison (case-insensitive, alphanumeric only)
     */
    private String normalizeLocationCode(String locationCode) {
        if (locationCode == null) {
            return "";
        }
        return locationCode.toUpperCase().replaceAll("[^A-Z0-9]", "");
    }

    /**
     * Get location details for a task (for optimal path calculation)
     */
    public Location getTaskLocation(UUID taskId) {
        Task task = taskService.findById(taskId);
        
        if (task.getLocationCode() == null || task.getLocationCode().isEmpty()) {
            return null;
        }
        
        return locationService.findByLocationCodeOptional(task.getLocationCode()).orElse(null);
    }

    /**
     * Complete a task and update worker records.
     * 
     * @param taskId Task ID
     * @param workerId Worker who completed the task
     * @param operationType Operation type: "picked", "received", "putaway"
     */
    @Transactional
    public void completeTask(UUID taskId, UUID workerId, String operationType) {
        Task task = taskService.findById(taskId);
        
        // Update task status with worker record
        taskService.updateStatusWithWorker(taskId, "completed", workerId);
        
        logger.info("Task {} completed by worker {} (operation: {})", taskId, workerId, operationType);
        
        // Store worker record in order if task references an order
        if (task.getReferenceId() != null && "order".equals(task.getReferenceType())) {
            // Map operation type to order field
            String orderOperation = mapOperationToOrderField(operationType);
            if (orderOperation != null) {
                orderService.updateWorkerRecord(task.getReferenceId(), workerId, orderOperation);
            }
        }
    }

    /**
     * Map task operation type to order worker record field
     */
    private String mapOperationToOrderField(String operationType) {
        return switch (operationType.toLowerCase()) {
            case "picked", "picking" -> "picked";
            case "received", "receiving" -> "received";
            case "putaway" -> null; // Putaway doesn't track in order
            case "packed", "packing" -> "packed";
            case "shipped", "shipping" -> "shipped";
            default -> null;
        };
    }

    /**
     * Update order status based on task completion.
     * Called when tasks are claimed or completed.
     */
    @Transactional
    public void updateOrderStatusIfNeeded(UUID orderId, String taskType) {
        try {
            Order order = orderService.findById(orderId);
            String currentStatus = order.getStatus();
            
            // For outbound orders: pending -> picking -> picked
            if ("outbound".equals(order.getOrderType())) {
                if ("picking".equals(taskType)) {
                    if ("pending".equals(currentStatus)) {
                        orderService.updateStatus(orderId, "picking");
                    }
                }
            }
            
            // For inbound orders: pending -> receiving -> received
            if ("inbound".equals(order.getOrderType())) {
                if ("receiving".equals(taskType)) {
                    if ("pending".equals(currentStatus)) {
                        orderService.updateStatus(orderId, "receiving");
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to update order status for order {}: {}", orderId, e.getMessage());
        }
    }

    /**
     * Get available tasks for a worker (unassigned tasks in their warehouse).
     * 
     * @param warehouseId Worker's warehouse ID
     * @param taskType Task type: "picking", "putaway", "receiving"
     * @return List of available (unassigned) tasks
     */
    public List<Task> getAvailableTasksForWorker(UUID warehouseId, String taskType) {
        return taskService.findByWarehouseAndTypeAndStatus(warehouseId, taskType, "pending");
    }

    /**
     * Check if a task can be claimed by a worker.
     */
    public boolean canClaimTask(UUID taskId, UUID workerId) {
        try {
            Task task = taskService.findById(taskId);
            
            // Must be pending status
            if (!"pending".equals(task.getStatus())) {
                return false;
            }
            
            // Must be unassigned or assigned to this worker
            return task.getAssignedTo() == null || task.getAssignedTo().equals(workerId);
        } catch (Exception e) {
            logger.warn("Error checking if task can be claimed: {}", e.getMessage());
            return false;
        }
    }
}
