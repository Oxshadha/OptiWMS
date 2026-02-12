package com.optiwms.coreapp.orders;

import com.optiwms.domain.orders.OrderItem;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrderItemService {

    private final OrderItemRepository repository;

    public OrderItemService(OrderItemRepository repository) {
        this.repository = repository;
    }

    public List<OrderItem> findByOrderId(UUID orderId) {
        return repository.findByOrderId(orderId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<OrderItem> findByMaterialId(UUID materialId) {
        return repository.findByMaterialId(materialId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public OrderItem findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Order item not found: " + id));
    }

    @org.springframework.transaction.annotation.Transactional
    public OrderItem create(OrderItem orderItem) {
        OrderItemEntity entity = new OrderItemEntity();
        entity.setOrderId(orderItem.getOrderId());
        entity.setMaterialId(orderItem.getMaterialId());
        entity.setQuantity(orderItem.getQuantity());
        entity.setUnitPrice(orderItem.getUnitPrice());
        entity.setPickedQuantity(orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : 0);
        entity.setPackedQuantity(orderItem.getPackedQuantity() != null ? orderItem.getPackedQuantity() : 0);
        entity.setLocationCode(orderItem.getLocationCode());
        entity.setStatus(orderItem.getStatus() != null ? orderItem.getStatus() : "pending");
        
        OrderItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @org.springframework.transaction.annotation.Transactional
    public OrderItem update(UUID id, OrderItem orderItem) {
        OrderItemEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order item not found: " + id));

        if (orderItem.getMaterialId() != null) entity.setMaterialId(orderItem.getMaterialId());
        if (orderItem.getQuantity() != null) entity.setQuantity(orderItem.getQuantity());
        if (orderItem.getUnitPrice() != null) entity.setUnitPrice(orderItem.getUnitPrice());
        if (orderItem.getLocationCode() != null) entity.setLocationCode(orderItem.getLocationCode());

        OrderItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private OrderItem toDomain(OrderItemEntity entity) {
        OrderItem domain = new OrderItem();
        domain.setId(entity.getId());
        domain.setOrderId(entity.getOrderId());
        domain.setMaterialId(entity.getMaterialId());
        domain.setQuantity(entity.getQuantity());
        domain.setUnitPrice(entity.getUnitPrice());
        domain.setPickedQuantity(entity.getPickedQuantity());
        domain.setPackedQuantity(entity.getPackedQuantity());
        domain.setLocationCode(entity.getLocationCode());
        domain.setStatus(entity.getStatus());
        return domain;
    }
}
