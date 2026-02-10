package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.WarehouseService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.orders.OrderStatusService;
import com.optiwms.coreapp.operations.PutawayTaskService;
import com.optiwms.coreapp.quality.QualityCheckService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.quality.QualityCheck;
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

    public ReceivingService(OrderService orderService,
                           OrderStatusService orderStatusService,
                           OrderItemRepository orderItemRepository,
                           InventoryService inventoryService,
                           MaterialService materialService,
                           WarehouseService warehouseService,
                           PutawayTaskService putawayTaskService,
                           QualityCheckService qualityCheckService,
                           GrnService grnService) {
        this.orderService = orderService;
        this.orderStatusService = orderStatusService;
        this.orderItemRepository = orderItemRepository;
        this.inventoryService = inventoryService;
        this.materialService = materialService;
        this.warehouseService = warehouseService;
        this.putawayTaskService = putawayTaskService;
        this.qualityCheckService = qualityCheckService;
        this.grnService = grnService;
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
            validatePalletWeight(receivedItem.materialId(), receivedItem.quantity());
            
            OrderItemEntity orderItem = orderItems.stream()
                    .filter(item -> item.getMaterialId().equals(receivedItem.materialId()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Order item not found for material: " + receivedItem.materialId()));

            // Update received quantity (stored in picked_quantity for inbound)
            // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
            Integer currentReceived = orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : 0;
            Integer receivedQty = (int) Math.ceil(receivedItem.quantity().doubleValue());
            orderItem.setPickedQuantity(currentReceived + receivedQty);
            orderItem.setStatus("received");
            orderItemRepository.save(orderItem);

            // Update inventory to worker's warehouse (or order's warehouse if worker warehouse not provided)
            updateInventory(warehouseId, receivedItem.materialId(), receivedItem.quantity(), receivedItem.locationCode());
        }

        // Update order status using centralized service
        // This checks if all items are received and updates status accordingly
        orderStatusService.updateStatusAfterReceiving(order.getId());
        
        // Store worker record in order (received_by, received_at)
        if (workerId != null && "inbound".equals(order.getOrderType())) {
            orderService.updateWorkerRecord(order.getId(), workerId, "received");
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
            validatePalletWeight(receivedItem.materialId(), receivedItem.quantity());
            
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
            updateInventory(itemWarehouseId, receivedItem.materialId(), receivedItem.quantity(), receivedItem.locationCode());
            
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
     * Validates pallet weight against material's maximum weight limit (SOP enforcement)
     * @param materialId UUID of the material
     * @param quantity Quantity being received (in kg for weight-based materials)
     * @throws RuntimeException if weight exceeds the limit
     */
    private void validatePalletWeight(UUID materialId, BigDecimal quantity) {
        Material material = materialService.findById(materialId);
        
        // Only validate if max weight is configured
        if (material.getMaxPalletWeightKg() != null && material.getMaxPalletWeightKg().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal maxWeight = material.getMaxPalletWeightKg();
            
            // Check if received quantity exceeds max weight
            if (quantity.compareTo(maxWeight) > 0) {
                throw new RuntimeException(String.format(
                    "Weight limit exceeded for material %s: %.2f kg > %.2f kg (max). " +
                    "As per SOP, raw materials are limited to 1500kg and packing materials to 1000kg per pallet.",
                    material.getMaterialCode(),
                    quantity.doubleValue(),
                    maxWeight.doubleValue()
                ));
            }
        }
    }
    
    private void updateInventory(UUID warehouseId, UUID materialId, BigDecimal quantity, String locationCode) {
        List<InventoryItem> existing = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        
        // Convert from BigDecimal (demand forecast) to Integer (actual pallet quantity) using ceil
        Integer qtyInteger = (int) Math.ceil(quantity.doubleValue());
        
        InventoryItem inventoryItem;
        if (existing.isEmpty()) {
            inventoryItem = new InventoryItem();
            inventoryItem.setMaterialId(materialId);
            inventoryItem.setWarehouseId(warehouseId);
            inventoryItem.setQuantity(0);
            inventoryItem.setAvailableQuantity(0);
            inventoryItem.setReservedQuantity(0);
        } else {
            inventoryItem = existing.get(0);
        }

        String normalizedLocation = normalizeLocationCode(locationCode);
        if (normalizedLocation != null) {
            inventoryItem.setLocationCode(normalizedLocation);
        } else if (existing.isEmpty()) {
            // Keep new inventory rows nullable when receiving has no confirmed location yet.
            inventoryItem.setLocationCode(null);
        }
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

    public record ReceivedItem(UUID materialId, BigDecimal quantity, String locationCode) {}

    public record ReceivingResult(boolean success, String message, UUID orderId) {}
}
