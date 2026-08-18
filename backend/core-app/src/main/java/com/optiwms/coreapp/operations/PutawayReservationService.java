package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.operations.InboundPutawayAllocationEntity;
import com.optiwms.infra.operations.InboundPutawayAllocationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Holds warehouse space against inbound work that has not yet arrived in a bin.
 *
 * <p>Two things can lay claim to a bin before stock physically occupies it: an inbound order line
 * whose destinations have been planned, and an open putaway task carrying a pallet to it. Neither
 * used to count for anything, so the same bin was handed to several lines of one PO, to concurrent
 * orders, and to workers hours after the plan was made.
 *
 * <p>Claims are counted at <em>planning</em> time only. Execution -- a worker confirming a pallet
 * into a bin -- is checked against physical capacity alone, because the reservation being consumed
 * is the worker's own and counting it would block the very move it exists to protect.
 */
@Service
public class PutawayReservationService {

    private static final Logger logger = LoggerFactory.getLogger(PutawayReservationService.class);

    private final InboundPutawayAllocationRepository allocationRepository;
    private final TaskService taskService;
    private final HandlingUnitCapacityService handlingUnitCapacityService;

    public PutawayReservationService(
            InboundPutawayAllocationRepository allocationRepository,
            TaskService taskService,
            HandlingUnitCapacityService handlingUnitCapacityService) {
        this.allocationRepository = allocationRepository;
        this.taskService = taskService;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
    }

    /**
     * Pallet slots already spoken for in each bin of a warehouse, keyed by upper-cased location code.
     *
     * <p>Sums open putaway tasks and planned-but-not-yet-tasked allocations. A line moves from one
     * to the other when its tasks are created, so a pallet is never counted twice.
     */
    public Map<String, Integer> reservedPalletsByLocation(UUID warehouseId) {
        Map<String, Integer> reserved = new HashMap<>();

        for (InboundPutawayAllocationEntity allocation : allocationRepository.findLiveByWarehouse(warehouseId)) {
            if (allocation.getLocationCode() == null) {
                continue;
            }
            reserved.merge(normalize(allocation.getLocationCode()), nvl(allocation.getPallets()), Integer::sum);
        }

        for (Task task : openPutawayTasks(warehouseId)) {
            if (task.getLocationCode() == null || task.getLocationCode().isBlank()) {
                continue;
            }
            // One putaway task is one pallet move by construction.
            reserved.merge(normalize(task.getLocationCode()), 1, Integer::sum);
        }

        return reserved;
    }

    /** Records the destinations planned for a line, replacing any earlier plan for it. */
    @Transactional
    public void reserve(
            UUID orderId,
            UUID orderItemId,
            UUID warehouseId,
            UUID materialId,
            BigDecimal unitsPerPallet,
            List<PutawayCapacityPlanningService.SplitPlanLine> allocations) {
        if (orderItemId == null || warehouseId == null || allocations == null || allocations.isEmpty()) {
            return;
        }

        releaseForItem(orderItemId);

        for (PutawayCapacityPlanningService.SplitPlanLine line : allocations) {
            if (line.locationCode() == null || line.allocatedQuantity() <= 0) {
                continue;
            }
            InboundPutawayAllocationEntity allocation = new InboundPutawayAllocationEntity();
            allocation.setOrderId(orderId);
            allocation.setOrderItemId(orderItemId);
            allocation.setWarehouseId(warehouseId);
            allocation.setMaterialId(materialId);
            allocation.setLocationCode(line.locationCode());
            allocation.setQuantity(line.allocatedQuantity());
            allocation.setPallets(Math.max(
                    handlingUnitCapacityService.computePalletCount(
                            BigDecimal.valueOf(line.allocatedQuantity()), unitsPerPallet),
                    1));
            allocation.setStatus(InboundPutawayAllocationEntity.STATUS_PLANNED);
            allocationRepository.save(allocation);
        }
    }

    /**
     * Hands the claim over to the putaway tasks that now exist for this line, so the space stays
     * held exactly once rather than being counted by both the allocation and the task.
     */
    @Transactional
    public void markTasked(UUID orderItemId) {
        if (orderItemId == null) {
            return;
        }
        allocationRepository.updateStatusForItem(orderItemId, InboundPutawayAllocationEntity.STATUS_TASKED);
    }

    /** Frees anything still held for a line whose plan no longer applies. */
    @Transactional
    public void releaseForItem(UUID orderItemId) {
        if (orderItemId == null) {
            return;
        }
        allocationRepository.updateStatusForItem(orderItemId, InboundPutawayAllocationEntity.STATUS_RELEASED);
    }

    /**
     * Frees every claim an order holds. Called when an order is cancelled or closed, so a receipt
     * that never arrives cannot tie up racking indefinitely.
     */
    @Transactional
    public void releaseForOrder(UUID orderId) {
        if (orderId == null) {
            return;
        }
        int released = allocationRepository.releaseForOrder(orderId);
        if (released > 0) {
            logger.info("Released {} putaway reservation(s) for order {}", released, orderId);
        }
    }

    /** Putaway tasks that still owe a pallet to a bin: issued but not yet completed or cancelled. */
    private List<Task> openPutawayTasks(UUID warehouseId) {
        try {
            List<Task> open = new java.util.ArrayList<>(
                    taskService.findByWarehouseAndTypeAndStatus(warehouseId, "putaway", "pending"));
            open.addAll(taskService.findByWarehouseAndTypeAndStatus(warehouseId, "putaway", "in_progress"));
            return open;
        } catch (RuntimeException lookupFailure) {
            // Reservations must never be the reason a capacity check cannot run; under-counting
            // degrades to the previous behaviour rather than failing the whole plan.
            logger.warn("Could not read open putaway tasks for warehouse {}: {}",
                    warehouseId, lookupFailure.getMessage());
            return List.of();
        }
    }

    private String normalize(String locationCode) {
        return locationCode.trim().toUpperCase(Locale.ROOT);
    }

    private int nvl(Integer value) {
        return value != null ? value : 0;
    }
}
