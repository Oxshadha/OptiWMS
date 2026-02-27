package com.optiwms.coreapp.orders;

import com.optiwms.domain.orders.Order;
import com.optiwms.infra.orders.OrderEntity;
import com.optiwms.infra.orders.OrderRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository repository;
    private static final Map<String, Set<String>> OUTBOUND_TRANSITIONS = buildOutboundTransitions();

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    public List<Order> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Page<Order> findPaged(
            String orderType,
            String status,
            String priority,
            java.util.UUID warehouseId,
            java.util.UUID supplierId,
            java.util.UUID customerId,
            String q,
            Pageable pageable
    ) {
        Specification<OrderEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (orderType != null && !orderType.isBlank()) {
                predicates.add(cb.equal(root.get("orderType"), orderType));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (priority != null && !priority.isBlank()) {
                predicates.add(cb.equal(root.get("priority"), priority));
            }
            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            }
            if (supplierId != null) {
                predicates.add(cb.equal(root.get("supplierId"), supplierId));
            }
            if (customerId != null) {
                predicates.add(cb.equal(root.get("customerId"), customerId));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("orderNumber")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern),
                        cb.like(cb.lower(root.get("priority")), pattern),
                        cb.like(cb.lower(root.get("notes")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toDomain);
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
    public Order updateStatus(java.util.UUID id, String status) {
        OrderEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found: " + id));
        String nextStatus = status == null ? null : status.toLowerCase().trim();
        if (nextStatus == null || nextStatus.isBlank()) {
            throw new RuntimeException("Order status cannot be empty");
        }

        String currentStatus = entity.getStatus() != null ? entity.getStatus().toLowerCase().trim() : "";
        String orderType = entity.getOrderType() != null ? entity.getOrderType().toLowerCase().trim() : "";

        if ("outbound".equals(orderType) && !isAllowedOutboundTransition(currentStatus, nextStatus)) {
            throw new RuntimeException("Invalid outbound status transition: " + currentStatus + " -> " + nextStatus);
        }

        entity.setStatus(nextStatus);
        OrderEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Order updateWorkerRecord(java.util.UUID id, java.util.UUID workerId, String operation) {
        OrderEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found: " + id));
        
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        
        switch (operation) {
            case "received":
                entity.setReceivedBy(workerId);
                entity.setReceivedAt(now);
                break;
            case "picked":
                entity.setPickedBy(workerId);
                entity.setPickedAt(now);
                break;
            case "packed":
                entity.setPackedBy(workerId);
                entity.setPackedAt(now);
                break;
            case "shipped":
                entity.setShippedBy(workerId);
                entity.setShippedAt(now);
                break;
        }
        
        OrderEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Order updateNotes(java.util.UUID id, String notes) {
        OrderEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found: " + id));
        entity.setNotes(notes);
        OrderEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Order update(java.util.UUID id, Order order) {
        OrderEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found: " + id));
        
        // Only update fields that are provided (not null)
        if (order.getExpectedDate() != null) {
            entity.setExpectedDate(order.getExpectedDate());
        }
        if (order.getNotes() != null) {
            entity.setNotes(order.getNotes());
        }
        if (order.getPriority() != null) {
            entity.setPriority(order.getPriority());
        }
        if (order.getTotalAmount() != null) {
            entity.setTotalAmount(order.getTotalAmount());
        }
        
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
        order.setReceivedBy(entity.getReceivedBy());
        order.setPickedBy(entity.getPickedBy());
        order.setPackedBy(entity.getPackedBy());
        order.setShippedBy(entity.getShippedBy());
        order.setReceivedAt(entity.getReceivedAt());
        order.setPickedAt(entity.getPickedAt());
        order.setPackedAt(entity.getPackedAt());
        order.setShippedAt(entity.getShippedAt());
        return order;
    }

    private static Map<String, Set<String>> buildOutboundTransitions() {
        Map<String, Set<String>> transitions = new HashMap<>();
        transitions.put("pending", setOf("pending", "allocated", "partially_allocated", "picking", "cancelled"));
        transitions.put("partially_allocated", setOf("partially_allocated", "allocated", "picking", "cancelled"));
        transitions.put("allocated", setOf("allocated", "picking", "cancelled"));
        transitions.put("picking", setOf("picking", "picked", "cancelled"));
        transitions.put("picked", setOf("picked", "packing", "cancelled"));
        transitions.put("packing", setOf("packing", "ready_to_ship", "cancelled"));
        transitions.put("ready_to_ship", setOf("ready_to_ship", "shipped", "cancelled"));
        transitions.put("shipped", setOf("shipped", "delivered", "return_initiated"));
        transitions.put("delivered", setOf("delivered", "return_initiated"));
        transitions.put("return_initiated", setOf("return_initiated", "returned", "cancelled"));
        transitions.put("returned", setOf("returned"));
        transitions.put("cancelled", setOf("cancelled"));
        return transitions;
    }

    private static Set<String> setOf(String... statuses) {
        Set<String> values = new HashSet<>();
        for (String status : statuses) {
            values.add(status);
        }
        return values;
    }

    private boolean isAllowedOutboundTransition(String currentStatus, String nextStatus) {
        if (currentStatus == null || currentStatus.isBlank()) {
            return true;
        }
        Set<String> allowed = OUTBOUND_TRANSITIONS.get(currentStatus);
        if (allowed == null) {
            return currentStatus.equals(nextStatus);
        }
        return allowed.contains(nextStatus);
    }
}
