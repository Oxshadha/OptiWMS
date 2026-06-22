package com.optiwms.coreapp.slotting;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;

import java.util.List;

@Component
public class MaterialIssueStatsRefreshScheduler {

    private final MaterialIssueStatsService issueStatsService;
    private final WarehouseRepository warehouseRepository;

    public MaterialIssueStatsRefreshScheduler(
            MaterialIssueStatsService issueStatsService,
            WarehouseRepository warehouseRepository) {
        this.issueStatsService = issueStatsService;
        this.warehouseRepository = warehouseRepository;
    }

    /** Nightly refresh so plan generation reads pre-aggregated ABC-FMS stats. */
    @Scheduled(cron = "0 30 2 * * *")
    public void refreshAllWarehouses() {
        List<WarehouseEntity> warehouses = warehouseRepository.findAll();
        for (WarehouseEntity warehouse : warehouses) {
            issueStatsService.refreshForWarehouse(warehouse.getId());
        }
    }
}
