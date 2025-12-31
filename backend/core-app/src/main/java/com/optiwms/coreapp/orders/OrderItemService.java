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

