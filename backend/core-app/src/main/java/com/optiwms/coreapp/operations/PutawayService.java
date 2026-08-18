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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.UUID;

@Service
public class PutawayService {
    private static final Pattern PUTAWAY_PROGRESS_PATTERN = Pattern.compile("PUTAWAY_PROGRESS=(\\d+)/(\\d+)");
    private static final Pattern PUTAWAY_HU_QTY_PATTERN = Pattern.compile("PUTAWAY_HU_QTY=(\\d+)");
    private static final Pattern PUTAWAY_SKIP_REASON_PATTERN = Pattern.compile("(?m)^PUTAWAY_SKIP_REASON=.*(?:\\R|$)");

    private final TaskService taskService;
    private final InventoryService inventoryService;
    private final MaterialLocationAssignmentService materialLocationService;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusService orderStatusService;
    private final OrderService orderService;
    private final OperationEventService operationEventService;

    public PutawayService(
            TaskService taskService, 
            InventoryService inventoryService,
            MaterialLocationAssignmentService materialLocationService,
            OrderItemRepository orderItemRepository,
            OrderStatusService orderStatusService,
            OrderService orderService,
            OperationEventService operationEventService) {
        this.taskService = taskService;
        this.inventoryService = inventoryService;
        this.materialLocationService = materialLocationService;
        this.orderItemRepository = orderItemRepository;
        this.orderStatusService = orderStatusService;
        this.orderService = orderService;
        this.operationEventService = operationEventService;
    }

    @Transactional
    public PutawayResult completePutaway(UUID taskId, String locationCode, String lpn, Integer quantity, UUID materialId, UUID workerId) {
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
        UUID orderIdForStatusUpdate = null;
        Integer requiredQuantityForTask = null;
        String receivedBatchNumber = null;
        boolean requiresReceivedInventoryMove = false;

        if (task.getReferenceId() != null && "order_item".equals(task.getReferenceType())) {
            OrderItemEntity orderItem = orderItemRepository.findById(task.getReferenceId())
                    .orElseThrow(() -> new RuntimeException("Order item not found for putaway task"));
            orderIdForStatusUpdate = orderItem.getOrderId();
            receivedBatchNumber = orderItem.getBatchNumber();
            requiresReceivedInventoryMove = true;
            var order = orderService.findById(orderIdForStatusUpdate);
            if (!"quality_approved".equals(order.getStatus())
                    && !"putaway_in_progress".equals(order.getStatus())
                    && !"put_away".equals(order.getStatus())) {
                throw new RuntimeException(
                        "Order status is '" + order.getStatus()
                                + "'. Putaway allowed only for 'quality_approved', 'putaway_in_progress', or 'put_away'. "
                                + "Ensure all quality checks for this GRN are approved."
                );
            }
            if (actualMaterialId == null) {
                actualMaterialId = orderItem.getMaterialId();
            }
            // A putaway task is one pallet, so it owes only that pallet's quantity. Falling back
            // to the whole line total would make each of N pallet tasks demand the full receipt.
            Integer handlingUnitQuantity = extractHandlingUnitQuantity(task.getNotes());
            Integer lineQuantity = orderItem.getPickedQuantity() != null
                    ? orderItem.getPickedQuantity()
                    : orderItem.getQuantity();
            if (actualQuantity == null || actualQuantity <= 0) {
                actualQuantity = handlingUnitQuantity != null ? handlingUnitQuantity : lineQuantity;
            }
            requiredQuantityForTask = handlingUnitQuantity != null ? handlingUnitQuantity : lineQuantity;
        }

        if (actualMaterialId == null && task.getReferenceId() != null && "order".equals(task.getReferenceType())) {
            // Try to get material from order item
            List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(task.getReferenceId());
            if (!orderItems.isEmpty()) {
                OrderItemEntity orderItem = orderItems.get(0);
                actualMaterialId = orderItem.getMaterialId();
                orderIdForStatusUpdate = orderItem.getOrderId();
                // Use pickedQuantity (received quantity) for putaway, not ordered quantity
                // pickedQuantity stores the actual received quantity for inbound orders
                actualQuantity = orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : orderItem.getQuantity();
                requiredQuantityForTask = actualQuantity;
            }
        }

        if (actualMaterialId == null) {
            throw new RuntimeException("Cannot determine material for putaway task");
        }

        if (actualQuantity == null || actualQuantity <= 0) {
            throw new RuntimeException("Invalid quantity for putaway");
        }

        Integer completedQuantity = extractCompletedQuantity(task.getNotes());
        Integer requiredQuantity = requiredQuantityForTask != null ? requiredQuantityForTask : actualQuantity;
        Integer remaining = Math.max(requiredQuantity - completedQuantity, 0);
        if (remaining <= 0) {
            throw new RuntimeException("Putaway already completed for this task");
        }
        if (actualQuantity > remaining) {
            throw new RuntimeException("Requested putaway quantity exceeds remaining quantity. Remaining: " + remaining);
        }

        // Make variables final for lambda
        final UUID finalMaterialId = actualMaterialId;
        final Integer finalQuantity = actualQuantity;
        final UUID finalWarehouseId = task.getWarehouseId();
        final String finalLocationCode = locationCode;

        List<InventoryItem> receivedInventory = requiresReceivedInventoryMove
                ? findUnlocatedReceivedInventory(finalMaterialId, finalWarehouseId, receivedBatchNumber)
                : List.of();
        if (requiresReceivedInventoryMove) {
            int receivedUnits = receivedInventory.stream()
                    .mapToInt(item -> item.getQuantity() != null ? item.getQuantity() : 0)
                    .sum();
            if (receivedUnits < finalQuantity) {
                throw new RuntimeException(
                        "Insufficient unlocated received inventory for putaway. Available: " + receivedUnits
                                + ", requested: " + finalQuantity);
            }
        }

        // Assign material to location using MaterialLocationAssignmentService
        InventoryItem inventoryItem = materialLocationService.assignMaterialToLocation(
                finalMaterialId,
                finalWarehouseId,
                finalQuantity,
                finalLocationCode
        );
        if (requiresReceivedInventoryMove) {
            consumeUnlocatedReceivedInventory(receivedInventory, finalQuantity);
            if (receivedBatchNumber != null && !receivedBatchNumber.isBlank()
                    && (inventoryItem.getBatchNumber() == null || inventoryItem.getBatchNumber().isBlank())) {
                inventoryItem.setBatchNumber(receivedBatchNumber);
                inventoryService.update(inventoryItem.getId(), inventoryItem);
            }
        }

        // Stamp the bin the pallet actually went into, for partial and full moves alike. Workers
        // can and do override the planned destination; leaving the task pointing at the plan made
        // the route guide release the wrong stop and keep steering them back to a bin they had
        // already emptied their forks into.
        taskService.updateLocationCode(taskId, finalLocationCode);

        Integer newCompletedQuantity = completedQuantity + actualQuantity;
        if (newCompletedQuantity < requiredQuantity) {
            if (workerId != null) {
                operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                        "PUTAWAY",
                        workerId,
                        taskId,
                        orderIdForStatusUpdate,
                        "order_item".equals(task.getReferenceType()) ? task.getReferenceId() : null,
                        finalWarehouseId,
                        finalMaterialId,
                        actualQuantity,
                        task.getStartedAt(),
                        java.time.LocalDateTime.now(),
                        "partial_allocation=true;location=" + finalLocationCode
                ));
            }
            String notesWithoutSkip = clearSkipReasonNote(task.getNotes());
            taskService.updateNotes(taskId, upsertPutawayProgressNote(notesWithoutSkip, newCompletedQuantity, requiredQuantity));
            if (workerId != null) {
                taskService.updateStatusWithWorker(taskId, "in_progress", workerId);
            } else {
                taskService.updateStatus(taskId, "in_progress");
            }
            if (orderIdForStatusUpdate != null) {
                var order = orderService.findById(orderIdForStatusUpdate);
                if ("quality_approved".equals(order.getStatus())) {
                    orderService.updateStatus(orderIdForStatusUpdate, "putaway_in_progress");
                }
            }
            return new PutawayResult(
                    true,
                    "Partial putaway saved (" + newCompletedQuantity + "/" + requiredQuantity + "). Continue with remaining quantity.",
                    taskId
            );
        }

        // Complete task with worker attribution for labor productivity analytics.
        String notesWithoutSkip = clearSkipReasonNote(task.getNotes());
        taskService.updateNotes(taskId, upsertPutawayProgressNote(notesWithoutSkip, requiredQuantity, requiredQuantity));
        if (workerId != null) {
            taskService.updateStatusWithWorker(taskId, "completed", workerId);
            operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                    "PUTAWAY",
                    workerId,
                    taskId,
                    orderIdForStatusUpdate,
                    "order_item".equals(task.getReferenceType()) ? task.getReferenceId() : null,
                    finalWarehouseId,
                    finalMaterialId,
                    actualQuantity,
                    task.getStartedAt(),
                    java.time.LocalDateTime.now(),
                    "partial_allocation=false;location=" + finalLocationCode
            ));
        } else {
            taskService.updateStatus(taskId, "completed");
        }

        // CRITICAL: Check if all items in the order are put away and update order status
        if (orderIdForStatusUpdate != null) {
            checkAndUpdateOrderStatusAfterPutaway(orderIdForStatusUpdate);
        }

        return new PutawayResult(true, "Putaway completed successfully. Material assigned to location: " + finalLocationCode, taskId);
    }

    @Transactional
    public PutawayResult skipPutawayItem(UUID taskId, String reason, UUID workerId) {
        Task task = taskService.findById(taskId);
        if (!"putaway".equals(task.getTaskType())) {
            throw new RuntimeException("Task is not a putaway task");
        }
        if ("completed".equals(task.getStatus())) {
            throw new RuntimeException("Completed task cannot be skipped");
        }
        if (reason == null || reason.trim().isEmpty()) {
            throw new RuntimeException("Skip reason is required");
        }

        String normalizedReason = reason.trim();
        if (normalizedReason.length() > 200) {
            throw new RuntimeException("Skip reason must be 200 characters or less");
        }

        taskService.updateNotes(taskId, upsertSkipReasonNote(task.getNotes(), normalizedReason, workerId));
        taskService.updateStatus(taskId, "pending");

        if (task.getReferenceId() != null && "order_item".equals(task.getReferenceType())) {
            OrderItemEntity orderItem = orderItemRepository.findById(task.getReferenceId()).orElse(null);
            if (orderItem != null) {
                try {
                    var order = orderService.findById(orderItem.getOrderId());
                    if ("quality_approved".equals(order.getStatus())) {
                        orderService.updateStatus(orderItem.getOrderId(), "putaway_in_progress");
                    }
                } catch (RuntimeException ignored) {
                }
            }
        }

        return new PutawayResult(true, "Item skipped with reason. Continue with other pending items.", taskId);
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

        // Primary rule: if item-level putaway tasks exist, use task completion as source of truth.
        boolean hasItemLevelTasks = orderItems.stream().anyMatch(item ->
                !taskService.findByTaskTypeAndReference("putaway", "order_item", item.getId()).isEmpty()
        );

        boolean allPutAway;
        if (hasItemLevelTasks) {
            allPutAway = orderItems.stream().allMatch(item -> {
                Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
                if (receivedQty <= 0) {
                    return true; // Not received yet, skip
                }
                List<Task> tasks = taskService.findByTaskTypeAndReference("putaway", "order_item", item.getId());
                if (tasks.isEmpty() || !tasks.stream().allMatch(t -> "completed".equals(t.getStatus()))) {
                    return false;
                }
                // Completing every task is not the same as putting the receipt away. When the
                // planner could not place every pallet it creates tasks only for the pallets that
                // fit, and closing the order on task completion alone stranded the remainder as
                // unlocated stock that picking could never see. Require the work to actually cover
                // what was received.
                int putAwayUnits = tasks.stream()
                        .mapToInt(task -> extractCompletedQuantity(task.getNotes()))
                        .sum();
                return putAwayUnits >= receivedQty;
            });
        } else {
            // Backward compatibility: legacy data without item-level tasks.
            UUID warehouseId = null;
            try {
                com.optiwms.domain.orders.Order order = orderService.findById(orderId);
                warehouseId = order.getWarehouseId();
            } catch (Exception e) {
                if (!orderItems.isEmpty()) {
                    List<InventoryItem> inventory = inventoryService.findByMaterial(orderItems.get(0).getMaterialId());
                    if (!inventory.isEmpty()) {
                        warehouseId = inventory.get(0).getWarehouseId();
                    }
                }
            }
            if (warehouseId == null) {
                return;
            }

            final UUID finalWarehouseId = warehouseId;
            allPutAway = orderItems.stream().allMatch(item -> {
                Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
                if (receivedQty <= 0) {
                    return true;
                }

                List<InventoryItem> inventoryItems = inventoryService.findByMaterialAndWarehouse(
                        item.getMaterialId(),
                        finalWarehouseId
                );

                int totalWithLocation = inventoryItems.stream()
                        .filter(inv -> inv.getLocationCode() != null && !inv.getLocationCode().isEmpty())
                        .mapToInt(inv -> inv.getQuantity() != null ? inv.getQuantity() : 0)
                        .sum();

                return totalWithLocation >= receivedQty;
            });
        }

        // Check if all received items have been put away
        if (allPutAway) {
            // Update order status to "put_away" or "ready_for_picking"
            orderStatusService.updateStatusAfterPutaway(orderId);
        } else {
            com.optiwms.domain.orders.Order order = orderService.findById(orderId);
            if ("quality_approved".equals(order.getStatus())) {
                orderService.updateStatus(orderId, "putaway_in_progress");
            }
        }
    }

    public record PutawayResult(boolean success, String message, UUID taskId) {}

    private List<InventoryItem> findUnlocatedReceivedInventory(
            UUID materialId,
            UUID warehouseId,
            String batchNumber) {
        return inventoryService.findByMaterialAndWarehouse(materialId, warehouseId).stream()
                .filter(item -> item.getLocationCode() == null || item.getLocationCode().isBlank())
                .filter(item -> item.getQuantity() != null && item.getQuantity() > 0)
                .filter(item -> batchNumber == null || batchNumber.isBlank()
                        || batchNumber.equals(item.getBatchNumber()))
                .sorted(java.util.Comparator.comparing(
                        InventoryItem::getCreatedAt,
                        java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())))
                .toList();
    }

    private void consumeUnlocatedReceivedInventory(List<InventoryItem> sourceInventory, int quantity) {
        int remaining = quantity;
        for (InventoryItem source : sourceInventory) {
            if (remaining <= 0) break;
            int sourceQuantity = source.getQuantity() != null ? source.getQuantity() : 0;
            int moved = Math.min(sourceQuantity, remaining);
            source.setQuantity(sourceQuantity - moved);
            int sourceAvailable = source.getAvailableQuantity() != null ? source.getAvailableQuantity() : sourceQuantity;
            source.setAvailableQuantity(Math.max(sourceAvailable - moved, 0));
            if (source.getQuantity() == 0) {
                source.setStatus("depleted");
            }
            inventoryService.update(source.getId(), source);
            remaining -= moved;
        }
        if (remaining > 0) {
            throw new RuntimeException("Failed to move the complete received quantity into storage");
        }
    }

    /**
     * Reads the pallet quantity this task is responsible for, written by PutawayTaskService.
     * Returns null for legacy line-scoped tasks created before per-pallet splitting.
     */
    private Integer extractHandlingUnitQuantity(String notes) {
        return PutawayTaskNotes.handlingUnitQuantity(notes).orElse(null);
    }

    private Integer extractCompletedQuantity(String notes) {
        return PutawayTaskNotes.completedQuantity(notes);
    }

    private String upsertPutawayProgressNote(String existingNotes, Integer completed, Integer required) {
        String progress = "PUTAWAY_PROGRESS=" + completed + "/" + required;
        if (existingNotes == null || existingNotes.isBlank()) {
            return progress;
        }
        Matcher matcher = PUTAWAY_PROGRESS_PATTERN.matcher(existingNotes);
        if (matcher.find()) {
            return matcher.replaceFirst(progress);
        }
        return existingNotes + "\n" + progress;
    }

    private String upsertSkipReasonNote(String existingNotes, String reason, UUID workerId) {
        String encodedReason = URLEncoder.encode(reason, StandardCharsets.UTF_8);
        String marker = "PUTAWAY_SKIP_REASON=" + encodedReason;
        if (workerId != null) {
            marker += ";workerId=" + workerId;
        }
        marker += ";at=" + java.time.LocalDateTime.now();

        String base = clearSkipReasonNote(existingNotes);
        if (base == null || base.isBlank()) {
            return marker;
        }
        return base + "\n" + marker;
    }

    private String clearSkipReasonNote(String existingNotes) {
        if (existingNotes == null || existingNotes.isBlank()) {
            return existingNotes;
        }
        String cleaned = PUTAWAY_SKIP_REASON_PATTERN.matcher(existingNotes).replaceAll("");
        return cleaned.strip();
    }
}
