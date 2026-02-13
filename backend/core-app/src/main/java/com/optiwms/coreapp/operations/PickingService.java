package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.anomalies.AnomalyService;
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
    private final AnomalyService anomalyService;

    public PickingService(TaskService taskService,
                         OrderService orderService,
                         OrderItemRepository orderItemRepository,
                         OrderRepository orderRepository,
                         InventoryService inventoryService,
                         OutboundOrderWorkflowService workflowService,
                         TaskOperationService taskOperationService,
                         AnomalyService anomalyService) {
        this.taskService = taskService;
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.orderRepository = orderRepository;
        this.inventoryService = inventoryService;
        this.workflowService = workflowService;
        this.taskOperationService = taskOperationService;
        this.anomalyService = anomalyService;
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

    @Transactional
    public PickingIssueResult reportPickingIssue(
            UUID taskId,
            UUID materialId,
            String locationCode,
            BigDecimal requestedQuantity,
            BigDecimal availableQuantity,
            String reason,
            UUID workerId
    ) {
        Task task = taskService.findById(taskId);
        if (!"picking".equals(task.getTaskType())) {
            throw new RuntimeException("Task is not a picking task");
        }

        BigDecimal safeRequested = requestedQuantity != null ? requestedQuantity : BigDecimal.ZERO;
        BigDecimal safeAvailable = availableQuantity != null ? availableQuantity : BigDecimal.ZERO;
        BigDecimal variance = safeRequested.compareTo(BigDecimal.ZERO) > 0
                ? safeRequested.subtract(safeAvailable)
                        .divide(safeRequested, 4, java.math.RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        if (variance.compareTo(BigDecimal.ZERO) < 0) {
            variance = BigDecimal.ZERO;
        }

        String severity;
        if (variance.compareTo(new BigDecimal("75")) >= 0) {
            severity = "critical";
        } else if (variance.compareTo(new BigDecimal("40")) >= 0) {
            severity = "high";
        } else if (variance.compareTo(new BigDecimal("20")) >= 0) {
            severity = "medium";
        } else {
            severity = "low";
        }

        String summary = String.format(
                "Picking issue on task %s at %s. Requested: %s, Available: %s. Reason: %s",
                task.getTaskNumber(),
                locationCode != null ? locationCode : "N/A",
                safeRequested,
                safeAvailable,
                reason != null ? reason : "Not provided"
        );

        var anomaly = anomalyService.create(
                "PICKING_SHORTAGE",
                materialId,
                task.getWarehouseId(),
                safeAvailable,
                safeRequested,
                variance,
                severity,
                summary
        );

        String existingNotes = task.getNotes() != null ? task.getNotes() + "\n" : "";
        String reasonValue = reason != null ? reason.trim() : "";
        String updatedNotes = existingNotes + String.format(
                "PICKING_ISSUE=%s|REQ=%s|AVL=%s|LOC=%s|REASON=%s|ANOMALY_ID=%s",
                java.time.LocalDateTime.now(),
                safeRequested,
                safeAvailable,
                locationCode != null ? locationCode : "",
                reasonValue.replace("\n", " ").replace("\r", " "),
                anomaly.getId()
        );
        taskService.updateNotes(taskId, updatedNotes);

        if ("pending".equals(task.getStatus()) && workerId != null) {
            taskService.assignTask(taskId, workerId, "system");
        }
        if (("pending".equals(task.getStatus()) || "assigned".equals(task.getStatus())) && workerId != null) {
            taskService.updateStatusWithWorker(taskId, "in_progress", workerId);
        }

        return new PickingIssueResult(true, "Picking issue reported", anomaly.getId(), taskId);
    }

    private void updateInventory(UUID warehouseId, UUID materialId, BigDecimal quantity, String locationCode) {
        List<InventoryItem> existing = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        
        if (existing.isEmpty()) {
            throw new RuntimeException("Inventory not found for material: " + materialId);
        }

        // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
        Integer qtyInteger = (int) Math.ceil(quantity.doubleValue());
        
        InventoryItem inventoryItem = existing.stream()
                .filter(item -> locationCode != null && locationCode.equals(item.getLocationCode()))
                .findFirst()
                .orElse(existing.get(0));

        Integer reserved = inventoryItem.getReservedQuantity() != null ? inventoryItem.getReservedQuantity() : 0;
        Integer onHand = inventoryItem.getQuantity() != null ? inventoryItem.getQuantity() : 0;

        if (reserved < qtyInteger) {
            throw new RuntimeException("Insufficient reserved inventory for material: " + materialId + " at location: " + locationCode);
        }
        if (onHand < qtyInteger) {
            throw new RuntimeException("Insufficient on-hand inventory for material: " + materialId);
        }

        inventoryItem.setReservedQuantity(reserved - qtyInteger);
        inventoryItem.setQuantity(onHand - qtyInteger);
        inventoryService.createOrUpdate(inventoryItem);
    }

    public record PickedItem(UUID materialId, BigDecimal quantity, String locationCode) {}

    public record PickingResult(boolean success, String message, UUID taskId) {}

    public record PickingIssueResult(boolean success, String message, UUID anomalyId, UUID taskId) {}
}
