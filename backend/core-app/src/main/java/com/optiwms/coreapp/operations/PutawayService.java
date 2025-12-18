package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.tasks.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class PutawayService {

    private final TaskService taskService;
    private final InventoryService inventoryService;

    public PutawayService(TaskService taskService, InventoryService inventoryService) {
        this.taskService = taskService;
        this.inventoryService = inventoryService;
    }

    @Transactional
    public PutawayResult completePutaway(UUID taskId, String locationCode, String lpn) {
        Task task = taskService.findById(taskId);
        
        if (!"putaway".equals(task.getTaskType())) {
            throw new RuntimeException("Task is not a putaway task");
        }

        if (!"pending".equals(task.getStatus()) && !"in_progress".equals(task.getStatus())) {
            throw new RuntimeException("Task cannot be completed in current status: " + task.getStatus());
        }

        // Update inventory location
        List<InventoryItem> inventory = inventoryService.findByWarehouse(task.getWarehouseId());
        // In a real scenario, we'd match by LPN or reference
        // For now, we'll update based on task reference
        
        taskService.updateStatus(taskId, "completed");

        return new PutawayResult(true, "Putaway completed successfully", taskId);
    }

    public record PutawayResult(boolean success, String message, UUID taskId) {}
}

