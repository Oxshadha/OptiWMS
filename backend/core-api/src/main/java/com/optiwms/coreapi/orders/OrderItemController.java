package com.optiwms.coreapi.orders;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.optiwms.coreapp.orders.OrderItemService;
import com.optiwms.coreapp.orders.OutboundOrderWorkflowService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.operations.MaterialLocationAssignmentService;
import com.optiwms.coreapp.operations.PutawayCapacityPlanningService;
import com.optiwms.coreapp.operations.PutawayReservationService;
import com.optiwms.coreapp.operations.PutawayTaskNotes;
import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.SupplierMaterialService;
import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.orders.OrderItem;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.inventory.InventoryItemRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderItemController {

    private static final Logger logger = LoggerFactory.getLogger(OrderItemController.class);

    private final OrderItemService orderItemService;
    private final OrderService orderService;
    private final MaterialLocationAssignmentService materialLocationService;
    private final PutawayCapacityPlanningService putawayCapacityPlanningService;
    private final MaterialService materialService;
    private final SupplierMaterialService supplierMaterialService;
    private final MaterialDefaultLocationService materialDefaultLocationService;
    private final InventoryItemRepository inventoryItemRepository;
    private final TaskService taskService;
    private final PutawayReservationService putawayReservationService;
    private final HandlingUnitCapacityService handlingUnitCapacityService;
    private final OutboundOrderWorkflowService outboundWorkflowService;

    public OrderItemController(
            OrderItemService orderItemService,
            OrderService orderService,
            MaterialLocationAssignmentService materialLocationService,
            PutawayCapacityPlanningService putawayCapacityPlanningService,
            MaterialService materialService,
            SupplierMaterialService supplierMaterialService,
            MaterialDefaultLocationService materialDefaultLocationService,
            InventoryItemRepository inventoryItemRepository,
            TaskService taskService,
            PutawayReservationService putawayReservationService,
            HandlingUnitCapacityService handlingUnitCapacityService,
            OutboundOrderWorkflowService outboundWorkflowService) {
        this.taskService = taskService;
        this.putawayReservationService = putawayReservationService;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
        this.outboundWorkflowService = outboundWorkflowService;
        this.orderItemService = orderItemService;
        this.orderService = orderService;
        this.materialLocationService = materialLocationService;
        this.putawayCapacityPlanningService = putawayCapacityPlanningService;
        this.materialService = materialService;
        this.supplierMaterialService = supplierMaterialService;
        this.materialDefaultLocationService = materialDefaultLocationService;
        this.inventoryItemRepository = inventoryItemRepository;
    }

    @GetMapping("/{orderId}/items")
    public ResponseEntity<List<OrderItemDto>> getByOrderId(@PathVariable UUID orderId) {
        List<OrderItem> items = orderItemService.findByOrderId(orderId);
        List<OrderItemDto> dtos = items.stream()
                .map(this::toDtoWithMaterial)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * The pallet moves a worker has to make for this order, one row per putaway task.
     *
     * <p>This used to return one row per order line carrying the admin's single chosen bin, which
     * discarded the per-pallet destinations the planner had already worked out and written onto the
     * tasks. A worker saw "600 units to A-01-01-1-A" for a line that was really six pallets bound
     * for six different bins, the screen pre-filled the whole 600 against a task that would only
     * accept 100, and the UI had to guess which of the six tasks it was completing.
     *
     * <p>Each row is now exactly one task: its own destination, its own quantity, its own sequence.
     * Ordering is by line then handling-unit sequence so the walk is deterministic.
     */
    @GetMapping("/{orderId}/putaway-items")
    public ResponseEntity<List<PutawayItemDto>> getPutawayItems(
            @PathVariable UUID orderId,
            @RequestParam(required = false) UUID workerId) {
        List<OrderItem> items = orderItemService.findByOrderId(orderId);
        Order order = orderService.findById(orderId);

        List<PutawayItemDto> rows = new java.util.ArrayList<>();
        for (OrderItem item : items) {
            if (item.getPickedQuantity() == null || item.getPickedQuantity() <= 0) {
                continue;
            }

            String materialCode = null;
            String materialName = null;
            try {
                Material material = materialService.findById(item.getMaterialId());
                materialCode = material.getMaterialCode();
                materialName = material.getDescription();
            } catch (Exception ignored) {
                // Material lookup is best-effort; never break the worker's list over it.
            }

            // Pallets another worker has claimed are left out entirely. Starting an order locks its
            // tasks to one worker, and the screen said as much -- but it still listed everyone's
            // pallets, so two drivers could set off for the same one.
            List<Task> palletTasks = taskService
                    .findByTaskTypeAndReference("putaway", "order_item", item.getId())
                    .stream()
                    .filter(task -> workerId == null
                            || task.getAssignedTo() == null
                            || workerId.equals(task.getAssignedTo()))
                    .sorted(java.util.Comparator.comparing(
                            task -> task.getHandlingUnitSeq() != null ? task.getHandlingUnitSeq() : 1))
                    .toList();

            if (palletTasks.isEmpty()) {
                // No tasks planned yet (or a legacy order-level task). Fall back to a line-shaped
                // row so the screen still renders while planning catches up.
                rows.add(lineFallbackRow(order, item, materialCode, materialName));
                continue;
            }

            int totalUnits = palletTasks.size();
            for (Task task : palletTasks) {
                int palletQuantity = PutawayTaskNotes.handlingUnitQuantity(task.getNotes())
                        .orElse(item.getPickedQuantity());
                rows.add(new PutawayItemDto(
                        task.getId().toString(),
                        item.getId().toString(),
                        item.getMaterialId().toString(),
                        materialCode,
                        materialName,
                        task.getHandlingUnitSeq() != null ? task.getHandlingUnitSeq() : 1,
                        totalUnits,
                        palletQuantity,
                        PutawayTaskNotes.completedQuantity(task.getNotes()),
                        task.getLocationCode(),
                        item.getPickedQuantity(),
                        task.getStatus(),
                        PutawayTaskNotes.skipReason(task.getNotes()).orElse(null),
                        List.of(),
                        null));
            }
        }
        return ResponseEntity.ok(rows);
    }

    /**
     * A line with no planned pallet tasks yet. Keeps the old suggestion behaviour so the screen
     * degrades gracefully rather than showing an empty order.
     */
    private PutawayItemDto lineFallbackRow(
            Order order, OrderItem item, String materialCode, String materialName) {
        String suggestedLocation = item.getLocationCode();
        List<String> existingLocations = List.of();
        PutawaySplitPlanDto splitPlan = null;
        Integer putawayQty = item.getPickedQuantity();

        try {
            existingLocations = materialLocationService
                    .findMaterialLocations(item.getMaterialId(), order.getWarehouseId())
                    .stream()
                    .map(MaterialLocationAssignmentService.LocationInventory::locationCode)
                    .distinct()
                    .collect(Collectors.toList());
            var plan = putawayCapacityPlanningService.suggestSplitPlan(
                    order.getWarehouseId(), item.getMaterialId(), putawayQty, suggestedLocation);
            splitPlan = toPutawaySplitPlanDto(plan);
            if (suggestedLocation == null || suggestedLocation.isBlank()) {
                suggestedLocation = plan.allocations().isEmpty()
                        ? null
                        : plan.allocations().get(0).locationCode();
            }
        } catch (Exception ignored) {
            // Suggestions are best-effort; do not break the putaway list.
        }

        return new PutawayItemDto(
                null,
                item.getId().toString(),
                item.getMaterialId().toString(),
                materialCode,
                materialName,
                1,
                1,
                putawayQty,
                0,
                suggestedLocation,
                putawayQty,
                item.getStatus(),
                null,
                existingLocations,
                splitPlan);
    }

    @PostMapping("/{orderId}/items")
    public ResponseEntity<OrderItemDto> create(@PathVariable UUID orderId,
            @RequestBody CreateOrderItemRequest request) {
        UUID materialId = UUID.fromString(request.materialId());
        Order order = orderService.findById(orderId);
        Material material = materialService.findById(materialId);
        validatePackagingRules(order, material, request.quantity());
        PutawayCapacityPlanningService.SplitPlanResult reservablePlan = null;
        if ("inbound".equalsIgnoreCase(order.getOrderType())) {
            UUID supplierId = order.getSupplierId();
            if (supplierId == null) {
                throw new IllegalArgumentException("Inbound order is missing supplier");
            }
            if (supplierMaterialService.hasAnyMaterialLink(supplierId)
                    && !supplierMaterialService.isMaterialLinked(supplierId, materialId)) {
                throw new IllegalArgumentException(
                        "Selected material is not linked to the supplier for this inbound order.");
            }

            var primaryDefault = materialDefaultLocationService.getPrimaryLocation(materialId, order.getWarehouseId());
            String preferredLocationCode = primaryDefault != null ? primaryDefault.getLocationCode() : null;
            var splitPlan = putawayCapacityPlanningService.suggestSplitPlan(
                    order.getWarehouseId(),
                    materialId,
                    request.quantity(),
                    preferredLocationCode);
            if (!splitPlan.feasible()) {
                String notes = splitPlan.notes() != null ? String.join(" ", splitPlan.notes()) : "";
                String message = "Insufficient storage capacity for inbound item quantity " + request.quantity()
                        + " in warehouse. " + notes;
                throw new IllegalArgumentException(message.trim());
            }
            reservablePlan = splitPlan;
        }

        OrderItem item = new OrderItem();
        item.setOrderId(orderId);
        item.setMaterialId(materialId);
        item.setQuantity(request.quantity());
        item.setUnitPrice(request.unitPrice() != null ? new java.math.BigDecimal(request.unitPrice()) : null);
        item.setLocationCode(request.locationCode());
        item.setWeightKg(material.getWeightKg());
        item.setHeightCm(material.getHeightCm());
        item.setLengthCm(material.getLengthCm());
        item.setWidthCm(material.getWidthCm());
        item.setBatchNumber(request.batchNumber());
        item.setManufactureDate(request.manufactureDate());
        item.setExpiryDate(request.expiryDate());
        item.setStatus("pending");

        OrderItem created = orderItemService.create(item);

        // Hold the bins this line was just proved to fit in. The feasibility check above was
        // previously computed and discarded, so the same bins were offered to the next line and to
        // every concurrent order -- the admin's green light was never binding on anything. Claiming
        // them here makes the next line plan around this one.
        if (reservablePlan != null) {
            putawayReservationService.reserve(
                    orderId,
                    created.getId(),
                    order.getWarehouseId(),
                    materialId,
                    handlingUnitCapacityService.resolveUnitsPerPallet(
                            material.getUnitsPerPallet(), material.getPalletSpaces()),
                    reservablePlan.allocations());
        }

        // An outbound order is created empty and its lines posted afterwards, so the picking plan
        // built at creation time covered nothing. Rebuild it here, now that a line exists -- until
        // an order has tasks it does not appear in any picker's queue.
        if ("outbound".equalsIgnoreCase(order.getOrderType())) {
            try {
                outboundWorkflowService.createPickingTasksForOrder(orderId);
            } catch (RuntimeException taskFailure) {
                logger.error("Order item added to {} but picking task generation failed",
                        order.getOrderNumber(), taskFailure);
            }
        }

        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(toDtoWithMaterial(created));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<OrderItemDto> update(
            @PathVariable UUID itemId,
            @RequestBody UpdateOrderItemRequest request) {
        OrderItem item = new OrderItem();
        item.setQuantity(request.quantity());
        item.setUnitPrice(request.unitPrice() != null ? new java.math.BigDecimal(request.unitPrice()) : null);
        item.setLocationCode(request.locationCode());
        item.setWeightKg(request.weightKg());
        item.setHeightCm(request.heightCm());
        item.setLengthCm(request.lengthCm());
        item.setWidthCm(request.widthCm());
        item.setBatchNumber(request.batchNumber());
        item.setManufactureDate(request.manufactureDate());
        item.setExpiryDate(request.expiryDate());
        item.setStatus(request.status());

        OrderItem updated = orderItemService.update(itemId, item);
        return ResponseEntity.ok(toDtoWithMaterial(updated));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> delete(@PathVariable UUID itemId) {
        // Free the bins this line was holding before it disappears, or the space stays claimed by
        // a line that no longer exists.
        putawayReservationService.releaseForItem(itemId);
        orderItemService.deleteById(itemId);
        return ResponseEntity.noContent().build();
    }

    private OrderItemDto toDtoWithMaterial(OrderItem item) {
        String materialCode = null;
        String materialName = null;
        try {
            Material material = materialService.findById(item.getMaterialId());
            materialCode = material.getMaterialCode();
            materialName = material.getDescription();
        } catch (Exception ignored) {
            // Best effort: keep dto fields null if material lookup fails
        }
        return new OrderItemDto(
                item.getId().toString(),
                item.getOrderId().toString(),
                item.getMaterialId().toString(),
                item.getQuantity(),
                item.getUnitPrice() != null ? item.getUnitPrice().toString() : null,
                item.getPickedQuantity(),
                item.getReceivedQuantity(),
                item.getPackedQuantity(),
                item.getLocationCode(),
                item.getWeightKg(),
                item.getHeightCm(),
                item.getLengthCm(),
                item.getWidthCm(),
                item.getBatchNumber(),
                item.getManufactureDate(),
                item.getExpiryDate(),
                materialCode,
                materialName,
                item.getStatus());
    }

    private void validatePackagingRules(Order order, Material material, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Order item quantity must be greater than 0.");
        }

        BigDecimal requested = BigDecimal.valueOf(quantity.longValue());
        BigDecimal minimum = firstPositive(material.getMinOrderQuantity(), BigDecimal.ONE);
        BigDecimal multiple = firstPositive(material.getOrderMultiple(), material.getUnitsPerHandlingUnit(),
                material.getPalletSpaces(), BigDecimal.ONE);

        if ("inbound".equalsIgnoreCase(order.getOrderType())) {
            var supplierRule = supplierMaterialService.findRule(order.getSupplierId(), material.getId()).orElse(null);
            if (supplierRule != null) {
                minimum = firstPositive(supplierRule.minimumOrderQuantity(), minimum);
                multiple = firstPositive(supplierRule.orderMultiple(), supplierRule.unitsPerHandlingUnit(), multiple);
            }
            if (requested.compareTo(minimum) < 0) {
                throw new IllegalArgumentException("Inbound quantity " + quantity
                        + " is below minimum order quantity " + minimum.stripTrailingZeros().toPlainString() + ".");
            }
            if (!isWholeMultiple(requested, multiple)) {
                BigDecimal rounded = roundUpToMultiple(requested, multiple);
                throw new IllegalArgumentException("Inbound quantity must be ordered in multiples of "
                        + multiple.stripTrailingZeros().toPlainString() + ". Suggested quantity: "
                        + rounded.stripTrailingZeros().toPlainString() + ".");
            }
            return;
        }

        if ("outbound".equalsIgnoreCase(order.getOrderType())) {
            BigDecimal available = inventoryItemRepository
                    .summarizeByWarehouseId(order.getWarehouseId())
                    .stream()
                    .filter(summary -> material.getId().equals(summary.getMaterialId()))
                    .map(InventoryItemRepository.InventoryMaterialSummary::getAvailableQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO);
            if (requested.compareTo(available) > 0) {
                throw new IllegalArgumentException("Outbound quantity " + quantity
                        + " exceeds available warehouse stock "
                        + available.stripTrailingZeros().toPlainString() + ".");
            }
            if (isControlledHandlingUnit(material) && !isWholeMultiple(requested, multiple)) {
                BigDecimal rounded = roundUpToMultiple(requested, multiple);
                throw new IllegalArgumentException("Outbound quantity for " + material.getHandlingUnitType()
                        + "-controlled material must be in multiples of "
                        + multiple.stripTrailingZeros().toPlainString() + ". Suggested quantity: "
                        + rounded.stripTrailingZeros().toPlainString() + ".");
            }
        }
    }

    private boolean isControlledHandlingUnit(Material material) {
        String unit = material.getHandlingUnitType() != null
                ? material.getHandlingUnitType()
                : material.getUnitType();
        if (unit == null) return false;
        String normalized = unit.trim().toLowerCase();
        return normalized.equals("pallet") || normalized.equals("drum")
                || normalized.equals("reel") || normalized.equals("bucket");
    }

    private BigDecimal firstPositive(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null && value.compareTo(BigDecimal.ZERO) > 0) {
                return value;
            }
        }
        return BigDecimal.ONE;
    }

    private boolean isWholeMultiple(BigDecimal requested, BigDecimal multiple) {
        if (multiple == null || multiple.compareTo(BigDecimal.ONE) <= 0) {
            return true;
        }
        return requested.remainder(multiple).compareTo(BigDecimal.ZERO) == 0;
    }

    private BigDecimal roundUpToMultiple(BigDecimal requested, BigDecimal multiple) {
        if (multiple == null || multiple.compareTo(BigDecimal.ONE) <= 0) {
            return requested;
        }
        BigDecimal[] divRem = requested.divideAndRemainder(multiple);
        return divRem[1].compareTo(BigDecimal.ZERO) == 0
                ? requested
                : divRem[0].add(BigDecimal.ONE).multiply(multiple);
    }

    public record OrderItemDto(
            String id,
            String orderId,
            String materialId,
            Integer quantity,
            String unitPrice,
            Integer pickedQuantity,
            Integer receivedQuantity,
            Integer packedQuantity,
            String locationCode,
            java.math.BigDecimal weightKg,
            java.math.BigDecimal heightCm,
            java.math.BigDecimal lengthCm,
            java.math.BigDecimal widthCm,
            String batchNumber,
            java.time.LocalDate manufactureDate,
            java.time.LocalDate expiryDate,
            String materialCode,
            String materialName,
            String status) {
    }

    public record CreateOrderItemRequest(
            String materialId,
            Integer quantity,
            String unitPrice,
            String locationCode,
            java.math.BigDecimal weightKg,
            java.math.BigDecimal heightCm,
            java.math.BigDecimal lengthCm,
            java.math.BigDecimal widthCm,
            String batchNumber,
            java.time.LocalDate manufactureDate,
            java.time.LocalDate expiryDate) {
    }

    public record UpdateOrderItemRequest(
            Integer quantity,
            String unitPrice,
            String locationCode,
            java.math.BigDecimal weightKg,
            java.math.BigDecimal heightCm,
            java.math.BigDecimal lengthCm,
            java.math.BigDecimal widthCm,
            String batchNumber,
            java.time.LocalDate manufactureDate,
            java.time.LocalDate expiryDate,
            String status) {
    }

    /**
     * One pallet move. {@code taskId} is the task the worker completes; it is null only for the
     * legacy fallback row where no pallet task has been planned yet.
     */
    public record PutawayItemDto(
            String taskId,
            String itemId,
            String materialId,
            String materialCode,
            String materialName,
            Integer handlingUnitSeq,
            Integer totalHandlingUnits,
            Integer palletQuantity,
            Integer completedQuantity,
            String plannedLocation,
            Integer lineReceivedQuantity,
            String status,
            String skipReason,
            List<String> existingLocations,
            PutawaySplitPlanDto splitPlan) {
    }

    public record PutawaySplitPlanDto(
            boolean feasible,
            int requestedQuantity,
            int plannedQuantity,
            int unplannedQuantity,
            List<PutawaySplitLineDto> allocations,
            List<String> notes) {
    }

    public record PutawaySplitLineDto(
            String locationCode,
            int allocatedQuantity,
            String reason) {
    }

    private PutawaySplitPlanDto toPutawaySplitPlanDto(PutawayCapacityPlanningService.SplitPlanResult plan) {
        return new PutawaySplitPlanDto(
                plan.feasible(),
                plan.requestedQuantity(),
                plan.plannedQuantity(),
                plan.unplannedQuantity(),
                plan.allocations().stream()
                        .map(line -> new PutawaySplitLineDto(
                                line.locationCode(),
                                line.allocatedQuantity(),
                                line.reason()))
                        .collect(Collectors.toList()),
                plan.notes());
    }
}
