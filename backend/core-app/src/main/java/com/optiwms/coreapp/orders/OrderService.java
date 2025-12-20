package com.optiwms.coreapp.orders;

import com.optiwms.domain.orders.Order;
import com.optiwms.infra.orders.OrderEntity;
import com.optiwms.infra.orders.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    public List<Order> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Order> findByType(String orderType) {
        return repository.findByOrderType(orderType).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Order> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Order findById(java.util.UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Order not found: " + id));
    }

    public Order findByOrderNumber(String orderNumber) {
        return repository.findByOrderNumber(orderNumber)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderNumber));
    }

    @Transactional
    public Order create(Order order) {
        if (repository.findByOrderNumber(order.getOrderNumber()).isPresent()) {
            throw new RuntimeException("Order number already exists: " + order.getOrderNumber());
        }

        OrderEntity entity = new OrderEntity();
        entity.setOrderNumber(order.getOrderNumber());
        entity.setOrderType(order.getOrderType());
        entity.setCustomerId(order.getCustomerId());
        entity.setSupplierId(order.getSupplierId());
        entity.setWarehouseId(order.getWarehouseId());
        entity.setStatus(order.getStatus() != null ? order.getStatus() : "pending");
        entity.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
        entity.setOrderDate(order.getOrderDate());
        entity.setExpectedDate(order.getExpectedDate());
        entity.setTotalAmount(order.getTotalAmount());
        entity.setNotes(order.getNotes());

        OrderEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Order update(java.util.UUID id, Order order) {
        OrderEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found: " + id));

        // Check if order number is being changed and if it conflicts
        if (!entity.getOrderNumber().equals(order.getOrderNumber())) {
            if (repository.findByOrderNumber(order.getOrderNumber()).isPresent()) {
                throw new RuntimeException("Order number already exists: " + order.getOrderNumber());
            }
        }

        entity.setOrderNumber(order.getOrderNumber());
        entity.setOrderType(order.getOrderType());
        entity.setCustomerId(order.getCustomerId());
        entity.setSupplierId(order.getSupplierId());
        entity.setWarehouseId(order.getWarehouseId());
        entity.setStatus(order.getStatus());
        entity.setPriority(order.getPriority());
        entity.setOrderDate(order.getOrderDate());
        entity.setExpectedDate(order.getExpectedDate());
        entity.setTotalAmount(order.getTotalAmount());
        entity.setNotes(order.getNotes());

        OrderEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Order updateStatus(java.util.UUID id, String status) {
        OrderEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found: " + id));
        entity.setStatus(status);
        OrderEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Order not found: " + id);
        }
        repository.deleteById(id);
    }

    private Order toDomain(OrderEntity entity) {
        Order order = new Order();
        order.setId(entity.getId());
        order.setOrderNumber(entity.getOrderNumber());
        order.setOrderType(entity.getOrderType());
        order.setCustomerId(entity.getCustomerId());
        order.setSupplierId(entity.getSupplierId());
        order.setWarehouseId(entity.getWarehouseId());
        order.setStatus(entity.getStatus());
        order.setPriority(entity.getPriority());
        order.setOrderDate(entity.getOrderDate());
        order.setExpectedDate(entity.getExpectedDate());
        order.setTotalAmount(entity.getTotalAmount());
        order.setNotes(entity.getNotes());
        return order;
    }
}

