package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.orders.Order;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.lang.NonNull;
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
    public ReceivingResult receiveOrder(String orderNumber, List<ReceivedItem> receivedItems) {
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
            BigDecimal currentReceived = orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : BigDecimal.ZERO;
            orderItem.setPickedQuantity(currentReceived.add(receivedItem.quantity()));
            orderItem.setStatus("received");
            orderItemRepository.save(orderItem);

            // Update inventory
            var warehouseId = order.getWarehouseId();
            if (warehouseId != null) {
                updateInventory(warehouseId, receivedItem.materialId(), receivedItem.quantity(), receivedItem.locationCode());
            }
        }

        // Update order status
        var orderId = order.getId();
        if (orderId != null) {
            orderService.updateStatus(orderId, "received");
        }

        return new ReceivingResult(true, "Order received successfully", order.getId());
    }

    private void updateInventory(@NonNull UUID warehouseId, @NonNull UUID materialId, BigDecimal quantity, String locationCode) {
        List<InventoryItem> existing = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        
        InventoryItem inventoryItem;
        if (existing.isEmpty()) {
            inventoryItem = new InventoryItem();
            inventoryItem.setMaterialId(materialId);
            inventoryItem.setWarehouseId(warehouseId);
            inventoryItem.setQuantity(BigDecimal.ZERO);
            inventoryItem.setAvailableQuantity(BigDecimal.ZERO);
            inventoryItem.setReservedQuantity(BigDecimal.ZERO);
        } else {
            inventoryItem = existing.get(0);
        }

        inventoryItem.setLocationCode(locationCode != null ? locationCode : inventoryItem.getLocationCode());
        BigDecimal newQuantity = inventoryItem.getQuantity().add(quantity);
        inventoryItem.setQuantity(newQuantity);
        inventoryItem.setAvailableQuantity(newQuantity);
        inventoryItem.setStatus("active");

        inventoryService.createOrUpdate(inventoryItem);
    }

    public record ReceivedItem(UUID materialId, BigDecimal quantity, String locationCode) {}

    public record ReceivingResult(boolean success, String message, UUID orderId) {}
}

