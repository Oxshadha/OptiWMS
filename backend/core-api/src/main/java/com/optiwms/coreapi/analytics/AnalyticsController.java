package com.optiwms.coreapi.analytics;

import com.optiwms.coreapp.analytics.AnalyticsService;
import com.optiwms.domain.workers.WorkerAchievement;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    // Worker Productivity
    @GetMapping("/worker-productivity")
    public ResponseEntity<List<WorkerProductivityMetricsDto>> getWorkerProductivity(
            @RequestParam(required = false) String period,
            @RequestParam(required = false) UUID warehouseId
    ) {
        List<AnalyticsService.WorkerProductivityMetrics> metrics = service.getWorkerProductivity(period, warehouseId);
        List<WorkerProductivityMetricsDto> dtos = metrics.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // Leaderboard
    @GetMapping("/leaderboard")
    public ResponseEntity<List<LeaderboardEntryDto>> getLeaderboard(
            @RequestParam String period, // "weekly" | "monthly"
            @RequestParam(required = false) UUID warehouseId
    ) {
        List<AnalyticsService.LeaderboardEntry> leaderboard = service.getLeaderboard(period, warehouseId);
        List<LeaderboardEntryDto> dtos = leaderboard.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // Dashboard KPIs
    @GetMapping("/dashboard/kpis")
    public ResponseEntity<DashboardKPIsDto> getDashboardKPIs(
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String period
    ) {
        AnalyticsService.DashboardKPIs kpis = service.getDashboardKPIs(warehouseId, period);
        return ResponseEntity.ok(toDto(kpis));
    }

    // Orders Chart
    @GetMapping("/dashboard/orders-chart")
    public ResponseEntity<List<OrderChartDataDto>> getOrdersChart(
            @RequestParam String period, // "daily" | "weekly" | "monthly"
            @RequestParam(required = false) UUID warehouseId
    ) {
        List<AnalyticsService.OrderChartData> chartData = service.getOrdersChart(period, warehouseId);
        List<OrderChartDataDto> dtos = chartData.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // Top Products
    @GetMapping("/dashboard/top-products")
    public ResponseEntity<List<TopProductDto>> getTopProducts(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) UUID warehouseId
    ) {
        List<AnalyticsService.TopProduct> topProducts = service.getTopProducts(limit, warehouseId);
        List<TopProductDto> dtos = topProducts.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // Inventory Overview
    @GetMapping("/dashboard/inventory-overview")
    public ResponseEntity<InventoryOverviewDto> getInventoryOverview(
            @RequestParam(required = false) UUID warehouseId
    ) {
        AnalyticsService.InventoryOverview overview = service.getInventoryOverview(warehouseId);
        return ResponseEntity.ok(toDto(overview));
    }

    // Worker Stats
    @GetMapping("/workers/{workerId}/stats")
    public ResponseEntity<WorkerStatsDto> getWorkerStats(@PathVariable UUID workerId) {
        try {
            AnalyticsService.WorkerStats stats = service.getWorkerStats(workerId);
            return ResponseEntity.ok(toDto(stats));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Worker Achievements
    @GetMapping("/workers/{workerId}/achievements")
    public ResponseEntity<List<AchievementDto>> getWorkerAchievements(@PathVariable UUID workerId) {
        List<WorkerAchievement> achievements = service.getWorkerAchievements(workerId);
        List<AchievementDto> dtos = achievements.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // Conversion methods
    private WorkerProductivityMetricsDto toDto(AnalyticsService.WorkerProductivityMetrics metrics) {
        return new WorkerProductivityMetricsDto(
                metrics.workerId,
                metrics.workerName,
                metrics.totalTasks,
                metrics.completedTasks,
                metrics.totalTimeMinutes,
                metrics.averageTimeMinutes,
                metrics.efficiency
        );
    }

    private LeaderboardEntryDto toDto(AnalyticsService.LeaderboardEntry entry) {
        return new LeaderboardEntryDto(
                entry.workerId,
                entry.workerName,
                entry.taskCount,
                entry.rank
        );
    }

    private DashboardKPIsDto toDto(AnalyticsService.DashboardKPIs kpis) {
        return new DashboardKPIsDto(
                kpis.totalOrders,
                kpis.ordersThisPeriod,
                kpis.totalItems,
                kpis.lowStockItems,
                kpis.totalTasks,
                kpis.completedTasks
        );
    }

    private OrderChartDataDto toDto(AnalyticsService.OrderChartData data) {
        return new OrderChartDataDto(data.date, data.count);
    }

    private TopProductDto toDto(AnalyticsService.TopProduct product) {
        return new TopProductDto(
                product.materialId,
                product.materialName,
                product.quantity
        );
    }

    private InventoryOverviewDto toDto(AnalyticsService.InventoryOverview overview) {
        return new InventoryOverviewDto(
                overview.totalItems,
                overview.activeItems,
                overview.lowStockItems,
                overview.outOfStockItems,
                overview.totalValue
        );
    }

    private WorkerStatsDto toDto(AnalyticsService.WorkerStats stats) {
        return new WorkerStatsDto(
                stats.workerId,
                stats.totalTasks,
                stats.completedTasks,
                stats.inProgressTasks,
                stats.accuracy
        );
    }

    private AchievementDto toDto(WorkerAchievement achievement) {
        return new AchievementDto(
                achievement.getId(),
                achievement.getWorkerId(),
                achievement.getAchievementType(),
                achievement.getEarnedAt() != null ? achievement.getEarnedAt().toLocalDateTime() : null,
                achievement.getMetadata()
        );
    }

    // DTOs
    public record WorkerProductivityMetricsDto(
            UUID workerId,
            String workerName,
            Integer totalTasks,
            Integer completedTasks,
            Long totalTimeMinutes,
            BigDecimal averageTimeMinutes,
            BigDecimal efficiency
    ) {}

    public record LeaderboardEntryDto(
            UUID workerId,
            String workerName,
            Integer taskCount,
            Integer rank
    ) {}

    public record DashboardKPIsDto(
            Long totalOrders,
            Long ordersThisPeriod,
            Long totalItems,
            Long lowStockItems,
            Long totalTasks,
            Long completedTasks
    ) {}

    public record OrderChartDataDto(
            String date,
            Integer count
    ) {}

    public record TopProductDto(
            UUID materialId,
            String materialName,
            Integer quantity
    ) {}

    public record InventoryOverviewDto(
            Long totalItems,
            Long activeItems,
            Long lowStockItems,
            Long outOfStockItems,
            Integer totalValue
    ) {}

    public record WorkerStatsDto(
            UUID workerId,
            Long totalTasks,
            Long completedTasks,
            Long inProgressTasks,
            BigDecimal accuracy
    ) {}

    public record AchievementDto(
            UUID id,
            UUID workerId,
            String achievementType,
            java.time.LocalDateTime earnedAt,
            String metadata
    ) {}
}

