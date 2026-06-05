package com.optiwms.coreapp.orders;

import com.optiwms.domain.orders.OrderItem;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public OrderItem create(OrderItem orderItem) {
        OrderItemEntity entity = new OrderItemEntity();
        entity.setOrderId(orderItem.getOrderId());
        entity.setMaterialId(orderItem.getMaterialId());
        entity.setQuantity(orderItem.getQuantity());
        entity.setUnitPrice(orderItem.getUnitPrice());
        entity.setPickedQuantity(orderItem.getPickedQuantity() != null ? orderItem.getPickedQuantity() : 0);
        entity.setPackedQuantity(orderItem.getPackedQuantity() != null ? orderItem.getPackedQuantity() : 0);
        entity.setLocationCode(orderItem.getLocationCode());
        entity.setWeightKg(orderItem.getWeightKg());
        entity.setHeightCm(orderItem.getHeightCm());
        entity.setLengthCm(orderItem.getLengthCm());
        entity.setWidthCm(orderItem.getWidthCm());
        entity.setBatchNumber(orderItem.getBatchNumber());
        entity.setManufactureDate(orderItem.getManufactureDate());
        entity.setExpiryDate(orderItem.getExpiryDate());
        entity.setStatus(orderItem.getStatus() != null ? orderItem.getStatus() : "pending");

        OrderItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    public OrderItem findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Order item not found: " + id));
    }

    @Transactional
    public OrderItem update(UUID id, OrderItem updatedItem) {
        OrderItemEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order item not found: " + id));

        if (updatedItem.getQuantity() != null) {
            entity.setQuantity(updatedItem.getQuantity());
        }
        if (updatedItem.getUnitPrice() != null) {
            entity.setUnitPrice(updatedItem.getUnitPrice());
        }
        if (updatedItem.getLocationCode() != null) {
            entity.setLocationCode(updatedItem.getLocationCode());
        }
        if (updatedItem.getWeightKg() != null) {
            entity.setWeightKg(updatedItem.getWeightKg());
        }
        if (updatedItem.getHeightCm() != null) {
            entity.setHeightCm(updatedItem.getHeightCm());
        }
        if (updatedItem.getLengthCm() != null) {
            entity.setLengthCm(updatedItem.getLengthCm());
        }
        if (updatedItem.getWidthCm() != null) {
            entity.setWidthCm(updatedItem.getWidthCm());
        }
        if (updatedItem.getBatchNumber() != null) {
            entity.setBatchNumber(updatedItem.getBatchNumber());
        }
        if (updatedItem.getManufactureDate() != null) {
            entity.setManufactureDate(updatedItem.getManufactureDate());
        }
        if (updatedItem.getExpiryDate() != null) {
            entity.setExpiryDate(updatedItem.getExpiryDate());
        }
        if (updatedItem.getStatus() != null) {
            entity.setStatus(updatedItem.getStatus());
        }

        OrderItemEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Order item not found: " + id);
        }
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
        domain.setWeightKg(entity.getWeightKg());
        domain.setHeightCm(entity.getHeightCm());
        domain.setLengthCm(entity.getLengthCm());
        domain.setWidthCm(entity.getWidthCm());
        domain.setBatchNumber(entity.getBatchNumber());
        domain.setManufactureDate(entity.getManufactureDate());
        domain.setExpiryDate(entity.getExpiryDate());
        domain.setStatus(entity.getStatus());
        return domain;
    }
}
