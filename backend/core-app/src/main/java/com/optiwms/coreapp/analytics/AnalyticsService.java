package com.optiwms.coreapp.analytics;

import com.optiwms.domain.workers.WorkerAchievement;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.orders.OrderEntity;
import com.optiwms.infra.orders.OrderRepository;
import com.optiwms.infra.tasks.TaskEntity;
import com.optiwms.infra.tasks.TaskRepository;
import com.optiwms.infra.users.UserRepository;
import com.optiwms.infra.workers.WorkerAchievementEntity;
import com.optiwms.infra.workers.WorkerAchievementRepository;
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
    private final InventoryItemRepository inventoryRepository;
    private final UserRepository userRepository;
    private final WorkerAchievementRepository achievementRepository;

    public AnalyticsService(
            TaskRepository taskRepository,
            OrderRepository orderRepository,
            InventoryItemRepository inventoryRepository,
            UserRepository userRepository,
            WorkerAchievementRepository achievementRepository) {
        this.taskRepository = taskRepository;
        this.orderRepository = orderRepository;
        this.inventoryRepository = inventoryRepository;
        this.userRepository = userRepository;
        this.achievementRepository = achievementRepository;
    }

    // Worker Productivity
    public List<WorkerProductivityMetrics> getWorkerProductivity(String period, UUID warehouseId) {
        LocalDateTime startDate = getStartDateForPeriod(period);
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
        long ordersThisPeriod = orders.stream()
                .filter(o -> o.getOrderDate() != null && o.getOrderDate().atStartOfDay().isAfter(startDate))
                .count();

        // Inventory
        List<InventoryItemEntity> inventory = warehouseId != null
                ? inventoryRepository.findByWarehouseId(warehouseId)
                : inventoryRepository.findAll();
        long totalItems = inventory.size();
        long lowStockItems = inventory.stream()
                .filter(i -> "low_stock".equals(i.getStatus()))
                .count();

        // Tasks
        List<TaskEntity> tasks = getTasksForPeriod(startDate, warehouseId);
        long totalTasks = tasks.size();
        long completedTasks = tasks.stream()
                .filter(t -> "completed".equals(t.getStatus()))
                .count();

        return new DashboardKPIs(
                totalOrders,
                ordersThisPeriod,
                totalItems,
                lowStockItems,
                totalTasks,
                completedTasks
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
        List<InventoryItemEntity> inventory = warehouseId != null
                ? inventoryRepository.findByWarehouseId(warehouseId)
                : inventoryRepository.findAll();

        Map<UUID, Integer> productQuantities = new HashMap<>();
        Map<UUID, String> productNames = new HashMap<>();

        for (InventoryItemEntity item : inventory) {
            UUID materialId = item.getMaterialId();
            productQuantities.put(materialId,
                    productQuantities.getOrDefault(materialId, 0)
                            + (item.getQuantity() != null ? item.getQuantity() : 0));
        }

        List<TopProduct> topProducts = productQuantities.entrySet().stream()
                .map(entry -> new TopProduct(
                        entry.getKey(),
                        productNames.getOrDefault(entry.getKey(), "Unknown"),
                        entry.getValue()
                ))
                .sorted((a, b) -> b.quantity.compareTo(a.quantity))
                .limit(limit != null ? limit : 10)
                .collect(Collectors.toList());

        return topProducts;
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

        Integer totalValue = inventory.stream()
                .mapToInt(i -> i.getQuantity() != null ? i.getQuantity() : 0)
                .sum();

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

    private WorkerAchievement toDomain(WorkerAchievementEntity entity) {
        WorkerAchievement achievement = new WorkerAchievement();
        achievement.setId(entity.getId());
        achievement.setWorkerId(entity.getWorkerId());
        achievement.setAchievementType(entity.getAchievementType());
        achievement.setEarnedAt(entity.getEarnedAt());
        achievement.setMetadata(entity.getMetadata());
        return achievement;
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

        public DashboardKPIs(Long totalOrders, Long ordersThisPeriod, Long totalItems,
                            Long lowStockItems, Long totalTasks, Long completedTasks) {
            this.totalOrders = totalOrders;
            this.ordersThisPeriod = ordersThisPeriod;
            this.totalItems = totalItems;
            this.lowStockItems = lowStockItems;
            this.totalTasks = totalTasks;
            this.completedTasks = completedTasks;
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
