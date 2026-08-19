package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.HandlingUnitCapacityService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.WarehouseService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OrderStatusService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.coreapp.operations.PutawayTaskService;
import com.optiwms.coreapp.quality.QualityCheckService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.quality.QualityCheck;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ReceivingService {

    private final OrderService orderService;
    private final OrderStatusService orderStatusService;
    private final OrderItemRepository orderItemRepository;
    private final InventoryService inventoryService;
    private final MaterialService materialService;
    private final WarehouseService warehouseService;
    private final PutawayTaskService putawayTaskService;
    private final QualityCheckService qualityCheckService;
    private final GrnService grnService;
    private final TaskService taskService;
    private final OperationEventService operationEventService;
    private final HandlingUnitCapacityService handlingUnitCapacityService;

    public ReceivingService(OrderService orderService,
                           OrderStatusService orderStatusService,
                           OrderItemRepository orderItemRepository,
                           InventoryService inventoryService,
                           MaterialService materialService,
                           WarehouseService warehouseService,
                           PutawayTaskService putawayTaskService,
                           QualityCheckService qualityCheckService,
                           GrnService grnService,
                           TaskService taskService,
                           OperationEventService operationEventService,
                           HandlingUnitCapacityService handlingUnitCapacityService) {
        this.orderService = orderService;
        this.orderStatusService = orderStatusService;
        this.orderItemRepository = orderItemRepository;
        this.inventoryService = inventoryService;
        this.materialService = materialService;
        this.warehouseService = warehouseService;
        this.putawayTaskService = putawayTaskService;
        this.qualityCheckService = qualityCheckService;
        this.grnService = grnService;
        this.taskService = taskService;
        this.operationEventService = operationEventService;
        this.handlingUnitCapacityService = handlingUnitCapacityService;
    }

    public Order getOrderByNumber(String orderNumber) {
        return orderService.findByOrderNumber(orderNumber);
    }

    @Transactional
    public ReceivingResult receiveOrder(String orderNumber, List<ReceivedItem> receivedItems, String notes, List<String> photos, UUID workerWarehouseId, UUID workerId) {
        Order order = orderService.findByOrderNumber(orderNumber);
        
        if (!"inbound".equals(order.getOrderType())) {
            throw new RuntimeException("Order is not an inbound order");
        }

        if (!"pending".equals(order.getStatus())
                && !"received".equals(order.getStatus())
                && !"partially_received".equals(order.getStatus())) {
            throw new RuntimeException("Order cannot be received in current status: " + order.getStatus());
        }

        // Determine warehouse: Use worker's warehouse if provided, otherwise use order's warehouse
        UUID warehouseId = workerWarehouseId != null ? workerWarehouseId : order.getWarehouseId();

        // Update order items with received quantities
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(order.getId());
        
        for (ReceivedItem receivedItem : receivedItems) {
            // Validate weight limit before processing
            validateHandlingUnitWeight(receivedItem.materialId(), receivedItem.quantity());
            
            OrderItemEntity orderItem = orderItems.stream()
                    .filter(item -> item.getMaterialId().equals(receivedItem.materialId()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Order item not found for material: " + receivedItem.materialId()));

            // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
            Integer currentReceived = orderItem.getReceivedQuantity() != null
                    ? orderItem.getReceivedQuantity()
                    : 0;
            Integer receivedQty = (int) Math.ceil(receivedItem.quantity().doubleValue());
            orderItem.setReceivedQuantity(currentReceived + receivedQty);
            // picked_quantity is kept in step for now: downstream putaway planning and the older
            // reports still read it. New readers should use received_quantity.
            orderItem.setPickedQuantity(currentReceived + receivedQty);
            orderItem.setStatus("received");
            orderItemRepository.save(orderItem);

            // Update inventory to worker's warehouse (or order's warehouse if worker warehouse not provided)
            String effectiveBatchNumber = firstNonBlank(receivedItem.batchNumber(), orderItem.getBatchNumber());
            java.time.LocalDate effectiveExpiryDate =
                    receivedItem.expiryDate() != null ? receivedItem.expiryDate() : orderItem.getExpiryDate();

            updateInventory(
                    warehouseId,
                    receivedItem.materialId(),
                    receivedItem.quantity(),
                    receivedItem.locationCode(),
                    effectiveBatchNumber,
                    effectiveExpiryDate
            );
        }

        // Update order status using centralized service
        // This checks if all items are received and updates status accordingly
        orderStatusService.updateStatusAfterReceiving(order.getId());
        
        // Store worker record in order (received_by, received_at)
        if (workerId != null && "inbound".equals(order.getOrderType())) {
            orderService.updateWorkerRecord(order.getId(), workerId, "received");
            completeReceivingTasks(order.getId(), workerId);
            int receivedTotal = receivedItems.stream()
                    .filter(it -> it.quantity() != null)
                    .mapToInt(it -> (int) Math.ceil(it.quantity().doubleValue()))
                    .sum();
            operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                    "RECEIVING",
                    workerId,
                    null,
                    order.getId(),
                    null,
                    warehouseId,
                    null,
                    receivedTotal,
                    null,
                    java.time.LocalDateTime.now(),
                    "mode=order"
            ));
        }

        // Create/find GRN for this inbound receipt and attach quality checks to GRN.
        UUID grnId = grnService.getOrCreateForOrder(order, workerId, notes);
        createPendingQualityChecks(grnId, receivedItems, workerId);

        // Move fully received orders into quality queue.
        Order refreshedOrder = orderService.findById(order.getId());
        if ("received".equals(refreshedOrder.getStatus())) {
            orderService.updateStatus(order.getId(), "quality_pending");
        }

        // Store notes and photos in order notes
        if (notes != null && !notes.trim().isEmpty() || (photos != null && !photos.isEmpty())) {
            StringBuilder notesBuilder = new StringBuilder();
            if (order.getNotes() != null && !order.getNotes().trim().isEmpty()) {
                notesBuilder.append(order.getNotes()).append("\n\n");
            }
            notesBuilder.append("=== Receiving Notes ===\n");
            if (notes != null && !notes.trim().isEmpty()) {
                notesBuilder.append(notes).append("\n");
            }
            if (photos != null && !photos.isEmpty()) {
                notesBuilder.append("Photos: ").append(photos.size()).append(" attached\n");
            }
            orderService.updateNotes(order.getId(), notesBuilder.toString());
        }

        return new ReceivingResult(true, "Order received successfully", order.getId());
    }

    @Transactional
    public ReceivingResult blindReceive(String orderNumber, List<ReceivedItem> receivedItems, String notes, List<String> photos, UUID workerWarehouseId, UUID workerId) {
        // Blind receive - create inventory without order validation
        // Try to find order, but don't fail if not found
        Order order = null;
        try {
            order = orderService.findByOrderNumber(orderNumber);
        } catch (RuntimeException e) {
            // Order not found - proceed with blind receive
        }

        UUID warehouseId;
        // Priority: 1) Worker's warehouse, 2) Order's warehouse, 3) Existing inventory warehouse
        if (workerWarehouseId != null) {
            warehouseId = workerWarehouseId; // Use worker's assigned warehouse
        } else if (order != null) {
            warehouseId = order.getWarehouseId(); // Use order's warehouse
        } else {
            warehouseId = null; // Will try to infer from existing inventory
        }

        // Update inventory for each received item
        for (ReceivedItem receivedItem : receivedItems) {
            // Validate weight limit before processing
            validateHandlingUnitWeight(receivedItem.materialId(), receivedItem.quantity());
            
            UUID itemWarehouseId = warehouseId;
            if (itemWarehouseId == null) {
                // Find warehouse from existing inventory or use default
                List<InventoryItem> existing = inventoryService.findByMaterial(receivedItem.materialId());
                if (!existing.isEmpty()) {
                    itemWarehouseId = existing.get(0).getWarehouseId();
                } else {
                    // If no existing inventory and no warehouse specified, use first warehouse
                    List<com.optiwms.domain.master.Warehouse> warehouses = warehouseService.listAll();
                    if (warehouses.isEmpty()) {
                        throw new RuntimeException("No warehouses found. Cannot perform blind receive.");
                    }
                    itemWarehouseId = warehouses.get(0).getId();
                }
            }
            updateInventory(
                    itemWarehouseId,
                    receivedItem.materialId(),
                    receivedItem.quantity(),
                    receivedItem.locationCode(),
                    receivedItem.batchNumber(),
                    receivedItem.expiryDate()
            );
            
            // Blind receiving has no quality gate context, so putaway task is created immediately.
            try {
                Integer qtyInteger = (int) Math.ceil(receivedItem.quantity().doubleValue());
                putawayTaskService.createPutawayTaskForBlindReceive(
                    itemWarehouseId, 
                    receivedItem.materialId(), 
                    qtyInteger
                );
            } catch (Exception e) {
                // Log error but don't fail blind receive
                System.err.println("Failed to create putaway task for blind receive: " + e.getMessage());
            }
        }

        // Store notes and photos in order notes (if order exists)
        if (order != null) {
            if (notes != null && !notes.trim().isEmpty() || (photos != null && !photos.isEmpty())) {
                StringBuilder notesBuilder = new StringBuilder();
                if (order.getNotes() != null && !order.getNotes().trim().isEmpty()) {
                    notesBuilder.append(order.getNotes()).append("\n\n");
                }
                notesBuilder.append("=== Blind Receiving Notes ===\n");
                if (notes != null && !notes.trim().isEmpty()) {
                    notesBuilder.append(notes).append("\n");
                }
                if (photos != null && !photos.isEmpty()) {
                    notesBuilder.append("Photos: ").append(photos.size()).append(" attached\n");
                }
                orderService.updateNotes(order.getId(), notesBuilder.toString());
            }
        }

        UUID orderId = order != null ? order.getId() : null;
        if (workerId != null) {
            int receivedTotal = receivedItems.stream()
                    .filter(it -> it.quantity() != null)
                    .mapToInt(it -> (int) Math.ceil(it.quantity().doubleValue()))
                    .sum();
            operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                    "RECEIVING",
                    workerId,
                    null,
                    orderId,
                    null,
                    warehouseId,
                    null,
                    receivedTotal,
                    null,
                    java.time.LocalDateTime.now(),
                    "mode=blind"
            ));
        }
        return new ReceivingResult(true, "Items received successfully (blind receive)", orderId);
    }

    private void createPendingQualityChecks(UUID grnId, List<ReceivedItem> receivedItems, UUID checkedBy) {
        for (ReceivedItem receivedItem : receivedItems) {
            if (receivedItem.quantity() == null || receivedItem.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            QualityCheck qualityCheck = new QualityCheck();
            qualityCheck.setGrnId(grnId);
            qualityCheck.setMaterialId(receivedItem.materialId());
            qualityCheck.setQtyReceived(receivedItem.quantity());
            qualityCheck.setQtyPassed(BigDecimal.ZERO);
            qualityCheck.setQtyRejected(BigDecimal.ZERO);
            qualityCheck.setApprovalStatus("PENDING");
            qualityCheck.setCheckedBy(checkedBy);
            qualityCheck.setCheckDate(OffsetDateTime.now());
            qualityCheckService.create(qualityCheck);
        }
    }

    /**
     * Validates the SOP pallet weight limit against a single handling unit, not the whole receipt.
     *
     * <p>A receipt larger than one pallet is normal: it is split across as many handling units as
     * it needs. Comparing the full received weight to a per-pallet ceiling rejected every
     * multi-pallet delivery. The genuine SOP violation is an individual pallet that would be
     * stacked beyond its limit, which is what this checks.
     *
     * @param materialId UUID of the material
     * @param quantity Quantity being received (in kg for weight-based materials)
     * @throws RuntimeException if a single handling unit would exceed the limit
     */
    private void validateHandlingUnitWeight(UUID materialId, BigDecimal quantity) {
        Material material = materialService.findById(materialId);

        // Only validate if max weight is configured
        BigDecimal maxWeight = material.getMaxPalletWeightKg();
        if (maxWeight == null || maxWeight.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        BigDecimal effectiveWeight = calculateEffectiveWeightKg(quantity, material);
        if (effectiveWeight.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        BigDecimal unitsPerPallet = handlingUnitCapacityService.resolveUnitsPerPallet(
                material.getUnitsPerPallet(), material.getPalletSpaces());
        int palletCount = handlingUnitCapacityService.computePalletCount(quantity, unitsPerPallet);
        if (palletCount <= 0) {
            return;
        }

        BigDecimal perPalletWeight = effectiveWeight.divide(
                BigDecimal.valueOf(palletCount), 2, java.math.RoundingMode.HALF_UP);

        if (perPalletWeight.compareTo(maxWeight) > 0) {
            throw new RuntimeException(String.format(
                "Pallet weight limit exceeded for material %s: %s units split across %d pallet(s) "
                    + "puts %.2f kg on a pallet, above the %.2f kg limit. "
                    + "Reduce the units per pallet for this material or receive in smaller handling units.",
                material.getMaterialCode(),
                quantity.stripTrailingZeros().toPlainString(),
                palletCount,
                perPalletWeight.doubleValue(),
                maxWeight.doubleValue()
            ));
        }
    }

    private BigDecimal calculateEffectiveWeightKg(BigDecimal quantity, Material material) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        // For weight-based receiving units (kg/g), quantity itself represents weight.
        if (isWeightBasedUnit(material.getUnitType())) {
            return quantity;
        }

        // For piece/box/pallet style units, compute weight = quantity * unit weight when available.
        if (material.getWeightKg() != null && material.getWeightKg().compareTo(BigDecimal.ZERO) > 0) {
            return quantity.multiply(material.getWeightKg());
        }

        // Fallback for legacy records where unit weight is not configured.
        return quantity;
    }

    private boolean isWeightBasedUnit(String unitType) {
        if (unitType == null) {
            return false;
        }
        String normalized = unitType.trim().toLowerCase();
        return "kg".equals(normalized)
                || "kilogram".equals(normalized)
                || "kilograms".equals(normalized)
                || "g".equals(normalized)
                || "gram".equals(normalized)
                || "grams".equals(normalized);
    }
    
    private void updateInventory(
            UUID warehouseId,
            UUID materialId,
            BigDecimal quantity,
            String locationCode,
            String batchNumber,
            java.time.LocalDate expiryDate
    ) {
        List<InventoryItem> existing = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        
        // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
        Integer qtyInteger = (int) Math.ceil(quantity.doubleValue());
        
        InventoryItem inventoryItem;
        String normalizedLocation = normalizeLocationCode(locationCode);
        String normalizedBatch = normalizeLocationCode(batchNumber);
        if (existing.isEmpty()) {
            inventoryItem = new InventoryItem();
            inventoryItem.setMaterialId(materialId);
            inventoryItem.setWarehouseId(warehouseId);
            inventoryItem.setQuantity(0);
            inventoryItem.setAvailableQuantity(0);
            inventoryItem.setReservedQuantity(0);
        } else {
            inventoryItem = existing.stream()
                    .filter(item -> java.util.Objects.equals(normalizeLocationCode(item.getLocationCode()), normalizedLocation))
                    .filter(item -> java.util.Objects.equals(normalizeLocationCode(item.getBatchNumber()), normalizedBatch))
                    .filter(item -> java.util.Objects.equals(item.getExpiryDate(), expiryDate))
                    .findFirst()
                    .orElseGet(() -> {
                        InventoryItem fresh = new InventoryItem();
                        fresh.setMaterialId(materialId);
                        fresh.setWarehouseId(warehouseId);
                        fresh.setQuantity(0);
                        fresh.setAvailableQuantity(0);
                        fresh.setReservedQuantity(0);
                        return fresh;
                    });
        }

        if (normalizedLocation != null) {
            inventoryItem.setLocationCode(normalizedLocation);
        } else if (existing.isEmpty()) {
            // Keep new inventory rows nullable when receiving has no confirmed location yet.
            inventoryItem.setLocationCode(null);
        }
        inventoryItem.setBatchNumber(normalizedBatch);
        inventoryItem.setExpiryDate(expiryDate);
        inventoryItem.setLastMovementDate(java.time.LocalDate.now());
        inventoryItem.setDaysSinceLastMovement(0);
        Integer newQuantity = (inventoryItem.getQuantity() != null ? inventoryItem.getQuantity() : 0) + qtyInteger;
        inventoryItem.setQuantity(newQuantity);
        inventoryItem.setAvailableQuantity(newQuantity);
        inventoryItem.setStatus("active");

        inventoryService.createOrUpdate(inventoryItem);
    }

    private String normalizeLocationCode(String locationCode) {
        if (locationCode == null) {
            return null;
        }
        String trimmed = locationCode.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstNonBlank(String primary, String fallback) {
        String normalizedPrimary = normalizeLocationCode(primary);
        if (normalizedPrimary != null) {
            return normalizedPrimary;
        }
        return normalizeLocationCode(fallback);
    }

    private void completeReceivingTasks(UUID orderId, UUID workerId) {
        List<Task> receivingTasks = taskService.findByTaskTypeAndReference("receiving", "order", orderId);
        if (receivingTasks.isEmpty()) {
            // Backfill for legacy orders that missed task creation; keep productivity accounting complete.
            try {
                var order = orderService.findById(orderId);
                Task fallback = new Task();
                fallback.setTaskNumber(generateTaskNumber("RECV", order.getOrderNumber()));
                fallback.setTaskType("receiving");
                fallback.setWarehouseId(order.getWarehouseId());
                fallback.setReferenceType("order");
                fallback.setReferenceId(orderId);
                fallback.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
                fallback.setStatus("completed");
                fallback.setNotes("Auto-created completed receiving task (backfill)");
                Task created = taskService.create(fallback);
                if (workerId != null) {
                    taskService.updateStatusWithWorker(created.getId(), "completed", workerId);
                } else {
                    taskService.updateStatus(created.getId(), "completed");
                }
                return;
            } catch (RuntimeException ignored) {
                return;
            }
        }
        for (Task task : receivingTasks) {
            if (!"completed".equals(task.getStatus())) {
                taskService.updateStatusWithWorker(task.getId(), "completed", workerId);
            }
        }
    }

    private String generateTaskNumber(String prefix, String reference) {
        String timestamp = String.valueOf(System.currentTimeMillis());
        String suffix = timestamp.substring(Math.max(0, timestamp.length() - 6));
        String ref = (reference == null || reference.isBlank()) ? "ORDER" : reference;
        return prefix + "-" + ref + "-" + suffix;
    }

    public record ReceivedItem(
            UUID materialId,
            BigDecimal quantity,
            String locationCode,
            String batchNumber,
            java.time.LocalDate expiryDate
    ) {}

    public record ReceivingResult(boolean success, String message, UUID orderId) {}
}
