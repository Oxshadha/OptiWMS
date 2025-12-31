package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.orders.Order;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class ReceivingService {

    private final OrderService orderService;
    private final OrderItemRepository orderItemRepository;
    private final InventoryService inventoryService;

    public ReceivingService(OrderService orderService,
                           OrderItemRepository orderItemRepository,
                           InventoryService inventoryService) {
        this.orderService = orderService;
        this.orderItemRepository = orderItemRepository;
        this.inventoryService = inventoryService;
    }

    public Order getOrderByNumber(String orderNumber) {
        return orderService.findByOrderNumber(orderNumber);
    }

    @Transactional
    public ReceivingResult receiveOrder(String orderNumber, List<ReceivedItem> receivedItems, String notes, List<String> photos) {
        Order order = orderService.findByOrderNumber(orderNumber);
        
        if (!"inbound".equals(order.getOrderType())) {
            throw new RuntimeException("Order is not an inbound order");
        }

        if (!"pending".equals(order.getStatus()) && !"received".equals(order.getStatus())) {
            throw new RuntimeException("Order cannot be received in current status: " + order.getStatus());
        }

        // Update order items with received quantities
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(order.getId());
        
        for (ReceivedItem receivedItem : receivedItems) {
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

            // Update inventory
            updateInventory(order.getWarehouseId(), receivedItem.materialId(), receivedItem.quantity(), receivedItem.locationCode());
        }

        // Update order status
        orderService.updateStatus(order.getId(), "received");

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
    public ReceivingResult blindReceive(String orderNumber, List<ReceivedItem> receivedItems, String notes, List<String> photos) {
        // Blind receive - create inventory without order validation
        // Try to find order, but don't fail if not found
        Order order = null;
        try {
            order = orderService.findByOrderNumber(orderNumber);
        } catch (RuntimeException e) {
            // Order not found - proceed with blind receive
        }

        UUID warehouseId;
        if (order != null) {
            warehouseId = order.getWarehouseId();
        } else {
            // For blind receive, we need warehouseId - use first item's warehouse or default
            // This is a limitation - in real implementation, warehouseId should be in request
            warehouseId = null; // Will need to be provided or inferred
        }

        // Update inventory for each received item
        for (ReceivedItem receivedItem : receivedItems) {
            if (warehouseId == null) {
                // Find warehouse from existing inventory or use default
                List<InventoryItem> existing = inventoryService.findByMaterial(receivedItem.materialId());
                if (!existing.isEmpty()) {
                    warehouseId = existing.get(0).getWarehouseId();
                } else {
                    throw new RuntimeException("Cannot determine warehouse for blind receive");
                }
            }
            updateInventory(warehouseId, receivedItem.materialId(), receivedItem.quantity(), receivedItem.locationCode());
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

        inventoryItem.setLocationCode(locationCode != null ? locationCode : inventoryItem.getLocationCode());
        Integer newQuantity = (inventoryItem.getQuantity() != null ? inventoryItem.getQuantity() : 0) + qtyInteger;
        inventoryItem.setQuantity(newQuantity);
        inventoryItem.setAvailableQuantity(newQuantity);
        inventoryItem.setStatus("active");

        inventoryService.createOrUpdate(inventoryItem);
    }

    public record ReceivedItem(UUID materialId, BigDecimal quantity, String locationCode) {}

    public record ReceivingResult(boolean success, String message, UUID orderId) {}
}

