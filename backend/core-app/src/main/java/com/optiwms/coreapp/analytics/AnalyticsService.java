package com.optiwms.coreapp.analytics;

import com.optiwms.domain.workers.WorkerAchievement;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.orders.OrderEntity;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import com.optiwms.infra.orders.OrderRepository;
import com.optiwms.infra.tasks.TaskEntity;
import com.optiwms.infra.tasks.TaskRepository;
import com.optiwms.infra.users.UserRepository;
import com.optiwms.infra.workers.WorkerAchievementEntity;
import com.optiwms.infra.workers.WorkerAchievementRepository;
import com.optiwms.infra.operations.OperationEventEntity;
import com.optiwms.infra.operations.OperationEventRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final TaskRepository taskRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final InventoryItemRepository inventoryRepository;
    private final LocationRepository locationRepository;
    private final MaterialRepository materialRepository;
    private final UserRepository userRepository;
    private final WorkerAchievementRepository achievementRepository;
    private final OperationEventRepository operationEventRepository;

    public AnalyticsService(
            TaskRepository taskRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            InventoryItemRepository inventoryRepository,
            LocationRepository locationRepository,
            MaterialRepository materialRepository,
            UserRepository userRepository,
            WorkerAchievementRepository achievementRepository,
            OperationEventRepository operationEventRepository) {
        this.taskRepository = taskRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.inventoryRepository = inventoryRepository;
        this.locationRepository = locationRepository;
        this.materialRepository = materialRepository;
        this.userRepository = userRepository;
        this.achievementRepository = achievementRepository;
        this.operationEventRepository = operationEventRepository;
    }

    // Worker Productivity
    public List<WorkerProductivityMetrics> getWorkerProductivity(String period, UUID warehouseId) {
        LocalDateTime startDate = getStartDateForPeriod(period);
        List<OperationEventEntity> events = getOperationEventsForPeriod(startDate, warehouseId);
        if (!events.isEmpty()) {
            return buildProductivityFromEvents(events);
        }
        List<TaskEntity> tasks = getTasksForPeriod(startDate, warehouseId);

        Map<UUID, WorkerProductivityMetrics> metricsMap = new HashMap<>();

        for (TaskEntity task : tasks) {
            UUID workerId = resolveWorkerId(task);
            if (workerId == null) {
                continue;
            }

            metricsMap.putIfAbsent(workerId, new WorkerProductivityMetrics(workerId, 0, 0, 0L, BigDecimal.ZERO));

            WorkerProductivityMetrics metrics = metricsMap.get(workerId);
            metrics.totalTasks++;

            if ("completed".equals(task.getStatus()) && task.getCompletedAt() != null) {
                metrics.completedTasks++;
                if (task.getCreatedAt() != null && task.getCompletedAt() != null) {
                    long minutes = ChronoUnit.MINUTES.between(task.getCreatedAt(), task.getCompletedAt());
                    metrics.totalTimeMinutes += minutes;
                }
            }
        }

        // Calculate average time and efficiency
        List<WorkerProductivityMetrics> result = new ArrayList<>();
        for (WorkerProductivityMetrics metrics : metricsMap.values()) {
            if (metrics.completedTasks > 0) {
                metrics.averageTimeMinutes = BigDecimal.valueOf(metrics.totalTimeMinutes)
                        .divide(BigDecimal.valueOf(metrics.completedTasks), 2, RoundingMode.HALF_UP);
            }
            metrics.efficiency = metrics.totalTasks > 0
                    ? BigDecimal.valueOf(metrics.completedTasks)
                            .divide(BigDecimal.valueOf(metrics.totalTasks), 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                    : BigDecimal.ZERO;

            // Get worker name
            userRepository.findById(metrics.workerId).ifPresent(user -> {
                metrics.workerName = user.getFirstName() + " " + user.getLastName();
            });

            result.add(metrics);
        }

        return result.stream()
                .sorted((a, b) -> b.completedTasks.compareTo(a.completedTasks))
                .collect(Collectors.toList());
    }

    // Leaderboard
    public List<LeaderboardEntry> getLeaderboard(String period, UUID warehouseId) {
        LocalDateTime startDate = getStartDateForPeriod(period);
        List<OperationEventEntity> events = getOperationEventsForPeriod(startDate, warehouseId);
        if (!events.isEmpty()) {
            return buildLeaderboardFromEvents(events);
        }
        List<TaskEntity> tasks = getTasksForPeriod(startDate, warehouseId);

        Map<UUID, Integer> taskCounts = new HashMap<>();
        Map<UUID, String> workerNames = new HashMap<>();

        for (TaskEntity task : tasks) {
            if (!"completed".equals(task.getStatus())) {
                continue;
            }

            UUID workerId = resolveWorkerId(task);
            if (workerId == null) {
                continue;
            }
            taskCounts.put(workerId, taskCounts.getOrDefault(workerId, 0) + 1);

            if (!workerNames.containsKey(workerId)) {
                userRepository.findById(workerId).ifPresent(user -> {
                    workerNames.put(workerId, user.getFirstName() + " " + user.getLastName());
                });
            }
        }

        List<LeaderboardEntry> leaderboard = taskCounts.entrySet().stream()
                .map(entry -> new LeaderboardEntry(
                        entry.getKey(),
                        workerNames.getOrDefault(entry.getKey(), "Unknown"),
                        entry.getValue(),
                        calculateRank(entry.getValue(), taskCounts.values())
                ))
                .sorted((a, b) -> b.taskCount.compareTo(a.taskCount))
                .collect(Collectors.toList());

        return leaderboard;
    }

    // Dashboard KPIs
    public DashboardKPIs getDashboardKPIs(UUID warehouseId, String period) {
        LocalDateTime startDate = getStartDateForPeriod(period);

        // Orders
        List<OrderEntity> orders = warehouseId != null
                ? orderRepository.findByWarehouseId(warehouseId)
                : orderRepository.findAll();
        long totalOrders = orders.size();
        List<OrderEntity> periodOrders = orders.stream()
                .filter(o -> isOrderInPeriod(o, startDate))
                .collect(Collectors.toList());
        long ordersThisPeriod = periodOrders.size();
        long completedOrdersThisPeriod = periodOrders.stream()
                .filter(o -> isCompletedOrderStatus(o.getStatus()))
                .count();

        // Inventory
        List<InventoryItemEntity> inventory = warehouseId != null
                ? inventoryRepository.findByWarehouseId(warehouseId)
                : inventoryRepository.findAll();
        long totalItems = inventory.size();
        long lowStockItems = inventory.stream()
                .filter(i -> "low_stock".equals(i.getStatus()))
                .count();

        // Keep these fields for backward compatibility with existing UI keys.
        long totalTasks = ordersThisPeriod;
        long completedTasks = completedOrdersThisPeriod;

        return new DashboardKPIs(
                totalOrders,
                ordersThisPeriod,
                totalItems,
                lowStockItems,
                totalTasks,
                completedTasks,
                ordersThisPeriod,
                completedOrdersThisPeriod
        );
    }

    // Orders Chart Data
    public List<OrderChartData> getOrdersChart(String period, UUID warehouseId) {
        LocalDateTime startDate = getStartDateForPeriod(period);
        List<OrderEntity> orders = warehouseId != null
                ? orderRepository.findByWarehouseId(warehouseId)
                : orderRepository.findAll();

        Map<LocalDate, Integer> orderCounts = new HashMap<>();
        for (OrderEntity order : orders) {
            if (order.getOrderDate() != null && order.getOrderDate().atStartOfDay().isAfter(startDate)) {
                orderCounts.put(order.getOrderDate(), orderCounts.getOrDefault(order.getOrderDate(), 0) + 1);
            }
        }

        return orderCounts.entrySet().stream()
                .map(entry -> new OrderChartData(entry.getKey().toString(), entry.getValue()))
                .sorted(Comparator.comparing(data -> data.date))
                .collect(Collectors.toList());
    }

    // Top Products
    public List<TopProduct> getTopProducts(Integer limit, UUID warehouseId) {
        LocalDateTime startDate = getStartDateForPeriod("monthly");
        List<OrderEntity> outboundOrders = (warehouseId != null
                ? orderRepository.findByWarehouseId(warehouseId).stream()
                .filter(o -> "outbound".equalsIgnoreCase(o.getOrderType()))
                .collect(Collectors.toList())
                : orderRepository.findByOrderType("outbound")).stream()
                .filter(o -> isCompletedOrderStatus(o.getStatus()))
                .filter(o -> isOrderInPeriod(o, startDate))
                .collect(Collectors.toList());

        if (outboundOrders.isEmpty()) {
            return List.of();
        }

        Set<UUID> orderIds = outboundOrders.stream().map(OrderEntity::getId).collect(Collectors.toSet());
        List<OrderItemEntity> soldItems = orderItemRepository.findByOrderIdIn(orderIds);

        Map<UUID, Integer> productQuantities = new HashMap<>();
        for (OrderItemEntity item : soldItems) {
            UUID materialId = item.getMaterialId();
            int qty = item.getPackedQuantity() != null && item.getPackedQuantity() > 0
                    ? item.getPackedQuantity()
                    : item.getPickedQuantity() != null && item.getPickedQuantity() > 0
                    ? item.getPickedQuantity()
                    : (item.getQuantity() != null ? item.getQuantity() : 0);
            productQuantities.merge(materialId, qty, Integer::sum);
        }

        Map<UUID, String> productNames = materialRepository.findAllById(productQuantities.keySet()).stream()
                .collect(Collectors.toMap(
                        MaterialEntity::getId,
                        m -> m.getDescription() != null && !m.getDescription().isBlank()
                                ? m.getDescription()
                                : m.getMaterialCode()
                ));

        return productQuantities.entrySet().stream()
                .map(entry -> new TopProduct(
                        entry.getKey(),
                        productNames.getOrDefault(entry.getKey(), "Unknown"),
                        entry.getValue()
                ))
                .sorted((a, b) -> b.quantity.compareTo(a.quantity))
                .limit(limit != null ? limit : 10)
                .collect(Collectors.toList());
    }

    // Inventory Overview
    public InventoryOverview getInventoryOverview(UUID warehouseId) {
        List<InventoryItemEntity> inventory = warehouseId != null
                ? inventoryRepository.findByWarehouseId(warehouseId)
                : inventoryRepository.findAll();

        long totalItems = inventory.size();
        long activeItems = inventory.stream()
                .filter(i -> "active".equals(i.getStatus()))
                .count();
        long lowStockItems = inventory.stream()
                .filter(i -> "low_stock".equals(i.getStatus()))
                .count();
        long outOfStockItems = inventory.stream()
                .filter(i -> "out_of_stock".equals(i.getStatus()))
                .count();

        Map<UUID, BigDecimal> unitPriceByMaterial = new HashMap<>();
        Map<UUID, LocalDateTime> latestPriceAt = new HashMap<>();
        for (OrderItemEntity item : orderItemRepository.findAll()) {
            if (item.getMaterialId() == null || item.getUnitPrice() == null) {
                continue;
            }
            LocalDateTime at = item.getCreatedAt() != null ? item.getCreatedAt() : LocalDateTime.MIN;
            LocalDateTime current = latestPriceAt.get(item.getMaterialId());
            if (current == null || at.isAfter(current)) {
                latestPriceAt.put(item.getMaterialId(), at);
                unitPriceByMaterial.put(item.getMaterialId(), item.getUnitPrice());
            }
        }

        BigDecimal totalValueDecimal = BigDecimal.ZERO;
        for (InventoryItemEntity i : inventory) {
            int qty = i.getQuantity() != null ? i.getQuantity() : 0;
            BigDecimal unitPrice = unitPriceByMaterial.getOrDefault(i.getMaterialId(), BigDecimal.ZERO);
            totalValueDecimal = totalValueDecimal.add(unitPrice.multiply(BigDecimal.valueOf(qty)));
        }
        Integer totalValue = totalValueDecimal.setScale(0, RoundingMode.HALF_UP).intValue();

        return new InventoryOverview(
                totalItems,
                activeItems,
                lowStockItems,
                outOfStockItems,
                totalValue
        );
    }

    // Worker Stats
    public WorkerStats getWorkerStats(UUID workerId) {
        List<TaskEntity> allTasks = taskRepository.findByAssignedTo(workerId);
        long totalTasks = allTasks.size();
        long completedTasks = allTasks.stream()
                .filter(t -> "completed".equals(t.getStatus()))
                .count();
        long inProgressTasks = allTasks.stream()
                .filter(t -> "in_progress".equals(t.getStatus()))
                .count();

        BigDecimal accuracy = totalTasks > 0
                ? BigDecimal.valueOf(completedTasks)
                        .divide(BigDecimal.valueOf(totalTasks), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        return new WorkerStats(
                workerId,
                totalTasks,
                completedTasks,
                inProgressTasks,
                accuracy
        );
    }

    // Worker Achievements
    public List<WorkerAchievement> getWorkerAchievements(UUID workerId) {
        return achievementRepository.findByWorkerIdOrderByEarnedAtDesc(workerId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    // Location Velocity (rack-level)
    public List<LocationVelocity> getLocationVelocity(UUID warehouseId, LocalDate startDate, LocalDate endDate) {
        LocalDate from = startDate != null ? startDate : LocalDate.now().minusDays(7);
        LocalDate to = endDate != null ? endDate : LocalDate.now();
        LocalDateTime startDateTime = from.atStartOfDay();
        LocalDateTime endDateTime = to.plusDays(1).atStartOfDay().minusNanos(1);

        List<LocationEntity> locations = locationRepository.findByWarehouseId(warehouseId).stream()
                .filter(l -> l.getLocationCode() != null && !l.getLocationCode().isBlank())
                .collect(Collectors.toList());

        Map<String, String> locationToRack = new HashMap<>();
        Set<String> rackIds = new HashSet<>();
        for (LocationEntity loc : locations) {
            String rackId = toRackId(loc);
            if (rackId == null) {
                continue;
            }
            locationToRack.put(loc.getLocationCode(), rackId);
            rackIds.add(rackId);
        }

        List<OperationEventEntity> events = operationEventRepository.findByWarehouseAndCompletedAtBetween(
                warehouseId, startDateTime, endDateTime
        );
        Map<UUID, String> taskLocationMap = new HashMap<>();
        List<UUID> taskIds = events.stream()
                .map(OperationEventEntity::getTaskId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        if (!taskIds.isEmpty()) {
            for (TaskEntity task : taskRepository.findAllById(taskIds)) {
                if (task.getLocationCode() != null && !task.getLocationCode().isBlank()) {
                    taskLocationMap.put(task.getId(), task.getLocationCode());
                }
            }
        }

        Map<String, Integer> pickCounts = new HashMap<>();
        Map<String, Integer> putawayCounts = new HashMap<>();
        Map<String, Integer> movementCounts = new HashMap<>();

        for (OperationEventEntity event : events) {
            String locationCode = event.getTaskId() != null ? taskLocationMap.get(event.getTaskId()) : null;
            if (locationCode == null) {
                continue;
            }
            String rackId = locationToRack.get(locationCode);
            if (rackId == null) {
                continue;
            }
            String operationType = event.getOperationType() != null ? event.getOperationType().toLowerCase() : "";
            movementCounts.merge(rackId, 1, Integer::sum);
            if (operationType.contains("pick")) {
                pickCounts.merge(rackId, 1, Integer::sum);
            }
            if (operationType.contains("putaway") || operationType.contains("receive") || operationType.contains("transfer")) {
                putawayCounts.merge(rackId, 1, Integer::sum);
            }
        }

        int maxMovements = movementCounts.values().stream().max(Integer::compareTo).orElse(0);
        List<LocationVelocity> result = new ArrayList<>();
        for (String rackId : rackIds) {
            int picks = pickCounts.getOrDefault(rackId, 0);
            int putaways = putawayCounts.getOrDefault(rackId, 0);
            int total = movementCounts.getOrDefault(rackId, 0);
            double velocity = maxMovements > 0 ? ((double) total / (double) maxMovements) * 100.0 : 0.0;
            result.add(new LocationVelocity(
                    rackId,
                    rackId,
                    rackId,
                    warehouseId,
                    picks,
                    putaways,
                    total,
                    BigDecimal.valueOf(velocity).setScale(2, RoundingMode.HALF_UP),
                    total,
                    total
            ));
        }

        return result.stream()
                .sorted((a, b) -> b.totalMovements.compareTo(a.totalMovements))
                .collect(Collectors.toList());
    }

    // Helper methods
    private LocalDateTime getStartDateForPeriod(String period) {
        if (period == null) period = "monthly";
        LocalDate today = LocalDate.now();
        return switch (period.toLowerCase()) {
            case "daily" -> today.atStartOfDay();
            case "weekly" -> today.minusWeeks(1).atStartOfDay();
            case "monthly" -> today.minusMonths(1).atStartOfDay();
            default -> today.minusMonths(1).atStartOfDay();
        };
    }

    private boolean isOrderInPeriod(OrderEntity order, LocalDateTime startDate) {
        return order.getOrderDate() != null && !order.getOrderDate().atStartOfDay().isBefore(startDate);
    }

    private boolean isCompletedOrderStatus(String status) {
        if (status == null) return false;
        String s = status.toLowerCase();
        return "completed".equals(s)
                || "delivered".equals(s)
                || "shipped".equals(s)
                || "received".equals(s)
                || "closed".equals(s);
    }

    private List<TaskEntity> getTasksForPeriod(LocalDateTime startDate, UUID warehouseId) {
        List<TaskEntity> tasks = warehouseId != null
                ? taskRepository.findByWarehouseId(warehouseId)
                : taskRepository.findAll();
        return tasks.stream()
                .filter(t -> t.getCreatedAt() != null && t.getCreatedAt().isAfter(startDate))
                .collect(Collectors.toList());
    }

    private UUID resolveWorkerId(TaskEntity task) {
        if (task.getAssignedTo() != null) {
            return task.getAssignedTo();
        }
        return task.getCompletedBy();
    }

    private Integer calculateRank(Integer taskCount, Collection<Integer> allCounts) {
        long rank = allCounts.stream()
                .filter(count -> count > taskCount)
                .count();
        return (int) (rank + 1);
    }

    private List<OperationEventEntity> getOperationEventsForPeriod(LocalDateTime startDate, UUID warehouseId) {
        return operationEventRepository.findByCompletedAtAfter(startDate).stream()
                .filter(e -> warehouseId == null || warehouseId.equals(e.getWarehouseId()))
                .collect(Collectors.toList());
    }

    private List<WorkerProductivityMetrics> buildProductivityFromEvents(List<OperationEventEntity> events) {
        Map<UUID, WorkerProductivityMetrics> metricsMap = new HashMap<>();

        for (OperationEventEntity event : events) {
            if (event.getWorkerId() == null) {
                continue;
            }
            UUID workerId = event.getWorkerId();
            metricsMap.putIfAbsent(workerId, new WorkerProductivityMetrics(workerId, 0, 0, 0L, BigDecimal.ZERO));
            WorkerProductivityMetrics metrics = metricsMap.get(workerId);
            metrics.totalTasks++;
            metrics.completedTasks++;
            metrics.totalTimeMinutes += event.getDurationMinutes() != null ? event.getDurationMinutes() : 0L;
        }

        List<WorkerProductivityMetrics> result = new ArrayList<>();
        for (WorkerProductivityMetrics metrics : metricsMap.values()) {
            if (metrics.completedTasks > 0) {
                metrics.averageTimeMinutes = BigDecimal.valueOf(metrics.totalTimeMinutes)
                        .divide(BigDecimal.valueOf(metrics.completedTasks), 2, RoundingMode.HALF_UP);
            }
            metrics.efficiency = BigDecimal.valueOf(100);
            userRepository.findById(metrics.workerId).ifPresent(user -> {
                metrics.workerName = user.getFirstName() + " " + user.getLastName();
            });
            result.add(metrics);
        }

        return result.stream()
                .sorted((a, b) -> b.completedTasks.compareTo(a.completedTasks))
                .collect(Collectors.toList());
    }

    private List<LeaderboardEntry> buildLeaderboardFromEvents(List<OperationEventEntity> events) {
        Map<UUID, Integer> eventCounts = new HashMap<>();
        Map<UUID, String> workerNames = new HashMap<>();

        for (OperationEventEntity event : events) {
            if (event.getWorkerId() == null) {
                continue;
            }
            UUID workerId = event.getWorkerId();
            eventCounts.put(workerId, eventCounts.getOrDefault(workerId, 0) + 1);
            if (!workerNames.containsKey(workerId)) {
                userRepository.findById(workerId).ifPresent(user ->
                        workerNames.put(workerId, user.getFirstName() + " " + user.getLastName()));
            }
        }

        return eventCounts.entrySet().stream()
                .map(entry -> new LeaderboardEntry(
                        entry.getKey(),
                        workerNames.getOrDefault(entry.getKey(), "Unknown"),
                        entry.getValue(),
                        calculateRank(entry.getValue(), eventCounts.values())
                ))
                .sorted((a, b) -> b.taskCount.compareTo(a.taskCount))
                .collect(Collectors.toList());
    }

    private WorkerAchievement toDomain(WorkerAchievementEntity entity) {
        WorkerAchievement achievement = new WorkerAchievement();
        achievement.setId(entity.getId());
        achievement.setWorkerId(entity.getWorkerId());
        achievement.setAchievementType(entity.getAchievementType());
        achievement.setEarnedAt(entity.getEarnedAt());
        achievement.setMetadata(entity.getMetadata());
        return achievement;
    }

    private String toRackId(LocationEntity location) {
        if (location.getArea() == null || location.getRowNumber() == null || location.getBayNumber() == null) {
            return null;
        }
        String area = location.getArea();
        if ("ST".equalsIgnoreCase(area)) {
            area = "C";
        }
        return area + "-" + location.getRowNumber() + "-" + location.getBayNumber();
    }

    // DTOs
    public static class WorkerProductivityMetrics {
        public UUID workerId;
        public String workerName;
        public Integer totalTasks;
        public Integer completedTasks;
        public Long totalTimeMinutes;
        public BigDecimal averageTimeMinutes;
        public BigDecimal efficiency; // percentage

        public WorkerProductivityMetrics(UUID workerId, Integer totalTasks, Integer completedTasks,
                                        Long totalTimeMinutes, BigDecimal averageTimeMinutes) {
            this.workerId = workerId;
            this.workerName = "";
            this.totalTasks = totalTasks;
            this.completedTasks = completedTasks;
            this.totalTimeMinutes = totalTimeMinutes;
            this.averageTimeMinutes = averageTimeMinutes;
            this.efficiency = BigDecimal.ZERO;
        }
    }

    public static class LeaderboardEntry {
        public UUID workerId;
        public String workerName;
        public Integer taskCount;
        public Integer rank;

        public LeaderboardEntry(UUID workerId, String workerName, Integer taskCount, Integer rank) {
            this.workerId = workerId;
            this.workerName = workerName;
            this.taskCount = taskCount;
            this.rank = rank;
        }
    }

    public static class DashboardKPIs {
        public Long totalOrders;
        public Long ordersThisPeriod;
        public Long totalItems;
        public Long lowStockItems;
        public Long totalTasks;
        public Long completedTasks;
        public Long totalOrdersThisPeriod;
        public Long completedOrdersThisPeriod;

        public DashboardKPIs(Long totalOrders, Long ordersThisPeriod, Long totalItems,
                            Long lowStockItems, Long totalTasks, Long completedTasks,
                            Long totalOrdersThisPeriod, Long completedOrdersThisPeriod) {
            this.totalOrders = totalOrders;
            this.ordersThisPeriod = ordersThisPeriod;
            this.totalItems = totalItems;
            this.lowStockItems = lowStockItems;
            this.totalTasks = totalTasks;
            this.completedTasks = completedTasks;
            this.totalOrdersThisPeriod = totalOrdersThisPeriod;
            this.completedOrdersThisPeriod = completedOrdersThisPeriod;
        }
    }

    public static class OrderChartData {
        public String date;
        public Integer count;

        public OrderChartData(String date, Integer count) {
            this.date = date;
            this.count = count;
        }
    }

    public static class TopProduct {
        public UUID materialId;
        public String materialName;
        public Integer quantity;

        public TopProduct(UUID materialId, String materialName, Integer quantity) {
            this.materialId = materialId;
            this.materialName = materialName;
            this.quantity = quantity;
        }
    }

    public static class LocationVelocity {
        public String locationId;
        public String locationCode;
        public String rackId;
        public UUID warehouseId;
        public Integer pickCount;
        public Integer putawayCount;
        public Integer totalMovements;
        public BigDecimal velocityPercentage;
        public Integer last7Days;
        public Integer last30Days;

        public LocationVelocity(String locationId, String locationCode, String rackId, UUID warehouseId,
                                Integer pickCount, Integer putawayCount, Integer totalMovements,
                                BigDecimal velocityPercentage, Integer last7Days, Integer last30Days) {
            this.locationId = locationId;
            this.locationCode = locationCode;
            this.rackId = rackId;
            this.warehouseId = warehouseId;
            this.pickCount = pickCount;
            this.putawayCount = putawayCount;
            this.totalMovements = totalMovements;
            this.velocityPercentage = velocityPercentage;
            this.last7Days = last7Days;
            this.last30Days = last30Days;
        }
    }

    public static class InventoryOverview {
        public Long totalItems;
        public Long activeItems;
        public Long lowStockItems;
        public Long outOfStockItems;
        public Integer totalValue;

        public InventoryOverview(Long totalItems, Long activeItems, Long lowStockItems,
                                Long outOfStockItems, Integer totalValue) {
            this.totalItems = totalItems;
            this.activeItems = activeItems;
            this.lowStockItems = lowStockItems;
            this.outOfStockItems = outOfStockItems;
            this.totalValue = totalValue;
        }
    }

    public static class WorkerStats {
        public UUID workerId;
        public Long totalTasks;
        public Long completedTasks;
        public Long inProgressTasks;
        public BigDecimal accuracy; // percentage

        public WorkerStats(UUID workerId, Long totalTasks, Long completedTasks,
                          Long inProgressTasks, BigDecimal accuracy) {
            this.workerId = workerId;
            this.totalTasks = totalTasks;
            this.completedTasks = completedTasks;
            this.inProgressTasks = inProgressTasks;
            this.accuracy = accuracy;
        }
    }
}
