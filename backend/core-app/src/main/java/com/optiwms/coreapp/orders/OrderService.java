package com.optiwms.coreapp.orders;

import com.optiwms.domain.orders.Order;
import com.optiwms.infra.orders.OrderEntity;
import com.optiwms.infra.orders.OrderNumberAliasEntity;
import com.optiwms.infra.orders.OrderNumberAliasRepository;
import com.optiwms.infra.orders.OrderRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
public class OrderService {

    private final OrderRepository repository;
    private final OrderNumberAliasRepository aliasRepository;
    private final com.optiwms.coreapp.operations.PutawayReservationService putawayReservationService;
    private static final Map<String, Set<String>> OUTBOUND_TRANSITIONS = buildOutboundTransitions();

    /** Statuses after which an inbound order can no longer be holding warehouse space. */
    private static final Set<String> RESERVATION_RELEASING_STATUSES =
            Set.of("cancelled", "put_away", "completed", "closed");

    public OrderService(
            OrderRepository repository,
            OrderNumberAliasRepository aliasRepository,
            com.optiwms.coreapp.operations.PutawayReservationService putawayReservationService) {
        this.repository = repository;
        this.aliasRepository = aliasRepository;
        this.putawayReservationService = putawayReservationService;
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

    public List<Order> findByTypeAndStatus(String orderType, String status) {
        return repository.findByOrderTypeAndStatus(orderType, status).stream()
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
                .or(() -> aliasRepository.findByAliasOrderNumber(orderNumber)
                        .flatMap(alias -> repository.findById(alias.getOrderId())))
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderNumber));
    }

    @Transactional
    public Order create(Order order) {
        String requestedNumber = normalizeBlank(order.getOrderNumber());
        String canonicalNumber = generateOrderNumber(order.getOrderType(), order.getOrderDate());
        order.setOrderNumber(canonicalNumber);

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
        if (requestedNumber != null && !requestedNumber.equals(canonicalNumber)) {
            saveAlias(saved.getId(), requestedNumber);
        }
        return toDomain(saved);
    }

    private String generateOrderNumber(String orderType, LocalDate orderDate) {
        Set<String> reservedNumbers = repository.findAll().stream()
                .map(OrderEntity::getOrderNumber)
                .filter(number -> number != null && !number.isBlank())
                .collect(Collectors.toCollection(HashSet::new));
        return generateOrderNumber(orderType, orderDate, reservedNumbers);
    }

    private String generateOrderNumber(String orderType, LocalDate orderDate, Set<String> reservedNumbers) {
        String normalizedType = orderType == null ? "" : orderType.toLowerCase().trim();
        String prefix = switch (normalizedType) {
            case "inbound" -> "PO";
            case "outbound" -> "SO";
            default -> throw new RuntimeException("Unsupported order type: " + orderType);
        };
        LocalDate date = orderDate != null ? orderDate : LocalDate.now();
        String stem = prefix + "-" + date.format(DateTimeFormatter.BASIC_ISO_DATE) + "-";
        long next = repository.countByOrderNumberStartingWith(stem) + 1;
        String candidate;
        do {
            candidate = stem + String.format("%06d", next);
            next += 1;
        } while (reservedNumbers.contains(candidate));
        reservedNumbers.add(candidate);
        return candidate;
    }

    private boolean saveAlias(java.util.UUID orderId, String alias) {
        if (aliasRepository.existsByAliasOrderNumber(alias)) {
            return false;
        }
        OrderNumberAliasEntity entity = new OrderNumberAliasEntity();
        entity.setOrderId(orderId);
        entity.setAliasOrderNumber(alias);
        aliasRepository.save(entity);
        return true;
    }

    private String normalizeBlank(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    @Transactional
    public CanonicalOrderRepairResult repairCanonicalOrderNumbers(boolean dryRun) {
        List<OrderEntity> candidates = repository.findAll().stream()
                .filter(this::needsCanonicalRepair)
                .sorted(Comparator
                        .comparing((OrderEntity order) -> order.getOrderDate() != null ? order.getOrderDate() : LocalDate.now())
                        .thenComparing(OrderEntity::getId))
                .toList();

        Set<String> reservedNumbers = repository.findAll().stream()
                .map(OrderEntity::getOrderNumber)
                .filter(number -> number != null && !number.isBlank())
                .filter(this::isCanonicalOrderNumber)
                .collect(Collectors.toCollection(HashSet::new));

        List<CanonicalOrderRepairItem> repaired = new ArrayList<>();
        int aliasesCreated = 0;
        int aliasesAlreadyPresent = 0;

        for (OrderEntity entity : candidates) {
            String oldNumber = normalizeBlank(entity.getOrderNumber());
            String newNumber = generateOrderNumber(entity.getOrderType(), entity.getOrderDate(), reservedNumbers);
            boolean aliasAlreadyExists = oldNumber != null && aliasRepository.existsByAliasOrderNumber(oldNumber);

            repaired.add(new CanonicalOrderRepairItem(
                    entity.getId(),
                    oldNumber,
                    newNumber,
                    entity.getOrderType(),
                    entity.getOrderDate(),
                    oldNumber == null ? "no_alias" : aliasAlreadyExists ? "alias_exists" : "alias_created"
            ));

            if (aliasAlreadyExists) {
                aliasesAlreadyPresent++;
            } else if (oldNumber != null) {
                aliasesCreated++;
            }

            if (!dryRun) {
                entity.setOrderNumber(newNumber);
                repository.save(entity);
                if (oldNumber != null && !oldNumber.equals(newNumber)) {
                    saveAlias(entity.getId(), oldNumber);
                }
            }
        }

        return new CanonicalOrderRepairResult(
                dryRun,
                candidates.size(),
                dryRun ? 0 : candidates.size(),
                aliasesCreated,
                aliasesAlreadyPresent,
                repaired
        );
    }

    private boolean needsCanonicalRepair(OrderEntity order) {
        String orderType = order.getOrderType() != null ? order.getOrderType().toLowerCase().trim() : "";
        if (!"inbound".equals(orderType) && !"outbound".equals(orderType)) {
            return false;
        }
        return !isCanonicalOrderNumber(order.getOrderNumber());
    }

    private boolean isCanonicalOrderNumber(String orderNumber) {
        return orderNumber != null
                && (orderNumber.matches("^PO-\\d{8}-\\d{6}$")
                || orderNumber.matches("^SO-\\d{8}-\\d{6}$"));
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

        // An inbound order holds racking from the moment its destinations are planned. Once it is
        // cancelled the goods are never coming, and once it is put away the stock is real inventory
        // -- either way the claim must stop counting, or a receipt that never arrives ties up bins
        // indefinitely.
        if (RESERVATION_RELEASING_STATUSES.contains(nextStatus)) {
            putawayReservationService.releaseForOrder(saved.getId());
        }

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

    public record CanonicalOrderRepairResult(
            boolean dryRun,
            int candidates,
            int repaired,
            int aliasesCreated,
            int aliasesAlreadyPresent,
            List<CanonicalOrderRepairItem> items
    ) {}

    public record CanonicalOrderRepairItem(
            java.util.UUID orderId,
            String oldOrderNumber,
            String newOrderNumber,
            String orderType,
            LocalDate orderDate,
            String aliasStatus
    ) {}
}
