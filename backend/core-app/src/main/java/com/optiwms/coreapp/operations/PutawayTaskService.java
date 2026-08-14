package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.coreapp.operations.LocationSuggestionService;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final HandlingUnitCapacityService handlingUnitCapacityService;

    public PutawayTaskService(
            TaskService taskService,
            OrderService orderService,
            OrderItemRepository orderItemRepository,
            MaterialService materialService,
            LocationSuggestionService locationSuggestionService,
            HandlingUnitCapacityService handlingUnitCapacityService) {
        this.taskService = taskService;
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.materialService = materialService;
        this.locationSuggestionService = locationSuggestionService;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
    }

    /**
     * Create putaway tasks for received items in an inbound order.
     * Called automatically after receiving is completed.
     */
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

        // Create putaway tasks for each received item, one per pallet (handling unit)
        for (OrderItemEntity item : orderItems) {
            // Only create tasks for items that have been received (picked_quantity > 0 for inbound)
            Integer receivedQty = item.getPickedQuantity() != null ? item.getPickedQuantity() : 0;
            if (receivedQty <= 0) {
                continue; // Skip items that haven't been received yet
            }

            // Pallets already created for this line are skipped individually, so a partial
            // or retried run tops up the missing ones instead of skipping the whole line.
            Set<Integer> existingSequences = taskService
                    .findByTaskTypeAndReference("putaway", "order_item", item.getId())
                    .stream()
                    .map(existing -> existing.getHandlingUnitSeq() != null ? existing.getHandlingUnitSeq() : 1)
                    .collect(Collectors.toSet());

            // Get material details
            Material material = materialService.findById(item.getMaterialId());

            // Honor the capacity-checked destination selected on the inbound line, and plan
            // any quantity that does not fit there into further bins.
            PutawayCapacityPlanningService.SplitPlanResult plan =
                    locationSuggestionService.suggestPutawayPlan(
                            warehouseId,
                            item.getMaterialId(),
                            receivedQty,
                            material.getMaterialType() != null ? material.getMaterialType() : "product",
                            item.getLocationCode());

            if (plan.allocations().isEmpty()) {
                throw new IllegalStateException(
                        "No capacity-valid putaway destination for order item " + item.getId());
            }

            List<HandlingUnitAssignment> handlingUnits = toHandlingUnits(plan, material);

            int sequence = 0;
            for (HandlingUnitAssignment handlingUnit : handlingUnits) {
                sequence++;
                if (existingSequences.contains(sequence)) {
                    continue;
                }

                Task putawayTask = new Task();
                putawayTask.setTaskNumber("PUT-" + item.getId() + "-" + sequence);
                putawayTask.setTaskType("putaway");
                putawayTask.setWarehouseId(warehouseId);
                putawayTask.setAssignedTo(null); // Unassigned - first come first serve
                putawayTask.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
                putawayTask.setStatus("pending");
                putawayTask.setReferenceType("order_item");
                putawayTask.setReferenceId(item.getId());
                putawayTask.setHandlingUnitSeq(sequence);
                putawayTask.setLocationCode(handlingUnit.locationCode()); // Suggested location (worker can change)
                // PUTAWAY_HU_QTY scopes completion accounting to this pallet; without it every
                // task would believe it owes the whole line quantity.
                putawayTask.setNotes(String.format(
                        "orderId=%s; hu=%d/%d; PUTAWAY_HU_QTY=%d; Put away %d units of %s%s",
                        orderId,
                        sequence,
                        handlingUnits.size(),
                        handlingUnit.quantity(),
                        handlingUnit.quantity(),
                        material.getMaterialCode() != null ? material.getMaterialCode() : "Item",
                        handlingUnit.locationCode() != null
                                ? " to location " + handlingUnit.locationCode()
                                : " (location to be selected)"));

                if (order.getExpectedDate() != null) {
                    putawayTask.setDueDate(order.getExpectedDate().atStartOfDay());
                } else {
                    putawayTask.setDueDate(LocalDateTime.now().plusDays(1));
                }

                final int createdSequence = sequence;
                try {
                    taskService.create(putawayTask);
                } catch (DataIntegrityViolationException duplicateOrConstraintFailure) {
                    // A concurrent worker/retry may have inserted the same idempotent
                    // task. Only suppress the exception when that task now exists.
                    boolean createdByAnotherWorker = taskService
                            .findByTaskTypeAndReference("putaway", "order_item", item.getId())
                            .stream()
                            .anyMatch(existing -> existing.getHandlingUnitSeq() != null
                                    && existing.getHandlingUnitSeq() == createdSequence);
                    if (!createdByAnotherWorker) {
                        throw duplicateOrConstraintFailure;
                    }
                }
            }
        }
    }

    /**
     * Expands a destination plan into individual pallet moves.
     *
     * <p>A bin can accept more than one pallet, so an allocation of 60 units at 10 units/pallet is
     * six pallet moves into the same bin. Forklift work is one pallet per trip, so each of those is
     * its own task rather than one task the worker has to run six times.
     */
    private List<HandlingUnitAssignment> toHandlingUnits(
            PutawayCapacityPlanningService.SplitPlanResult plan, Material material) {
        BigDecimal unitsPerPallet = handlingUnitCapacityService.resolveUnitsPerPallet(
                material.getUnitsPerPallet(), material.getPalletSpaces());
        int perPallet = Math.max(unitsPerPallet.setScale(0, RoundingMode.FLOOR).intValue(), 1);

        List<HandlingUnitAssignment> handlingUnits = new ArrayList<>();
        for (PutawayCapacityPlanningService.SplitPlanLine allocation : plan.allocations()) {
            int remaining = allocation.allocatedQuantity();
            while (remaining > 0) {
                int palletQuantity = Math.min(perPallet, remaining);
                handlingUnits.add(new HandlingUnitAssignment(allocation.locationCode(), palletQuantity));
                remaining -= palletQuantity;
            }
        }
        return handlingUnits;
    }

    /** One pallet move: how much goes where. */
    private record HandlingUnitAssignment(String locationCode, int quantity) {
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
