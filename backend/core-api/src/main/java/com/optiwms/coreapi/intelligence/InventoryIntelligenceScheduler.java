package com.optiwms.coreapi.intelligence;

import com.optiwms.coreapi.ai.AiProxyService;
import com.optiwms.coreapp.forecastspace.InventoryPolicyRecommendationService;
import com.optiwms.coreapp.slotting.SlottingPlanService;
import com.optiwms.infra.forecastspace.InventoryPolicyRecommendationRunRepository;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Produces reviewable recommendations on the normal cadence; it never auto-approves. */
@Component
public class InventoryIntelligenceScheduler {
    private static final Logger log = LoggerFactory.getLogger(InventoryIntelligenceScheduler.class);
    private static final String DATASET_VERSION = "PROJECT_OPERATIONAL_SIMULATION_V8";
    private static final String DATASET = "PROJECT_OPS_RM_PM";
    private static final String MODEL = "PROJECT_OPS_EXTRA_TREES_CAUSAL";

    private final WarehouseRepository warehouses;
    private final InventoryPolicyRecommendationRunRepository policyRuns;
    private final SlottingPlanRepository slottingPlans;
    private final InventoryPolicyRecommendationService policyService;
    private final SlottingPlanService slottingService;
    private final AiProxyService aiProxyService;

    @Value("${intelligence.scheduling.enabled:true}")
    private boolean enabled;

    public InventoryIntelligenceScheduler(WarehouseRepository warehouses,
            InventoryPolicyRecommendationRunRepository policyRuns,
            SlottingPlanRepository slottingPlans,
            InventoryPolicyRecommendationService policyService,
            SlottingPlanService slottingService,
            AiProxyService aiProxyService) {
        this.warehouses = warehouses;
        this.policyRuns = policyRuns;
        this.slottingPlans = slottingPlans;
        this.policyService = policyService;
        this.slottingService = slottingService;
        this.aiProxyService = aiProxyService;
    }

    @Scheduled(cron = "${intelligence.policy.cron:0 15 2 * * *}", zone = "Asia/Colombo")
    public void refreshForecastAndPolicyDaily() {
        if (!enabled) return;
        for (WarehouseEntity warehouse : warehouses.findByDatasetVersion(DATASET_VERSION)) {
            try {
                var latest = policyRuns.findByWarehouseIdOrderByCreatedAtDesc(warehouse.getId());
                if (!latest.isEmpty() && latest.get(0).getCreatedAt() != null
                        && latest.get(0).getCreatedAt().isAfter(OffsetDateTime.now().minusHours(20))) {
                    continue;
                }
                var publish = aiProxyService.triggerForecastRun(DATASET, MODEL, "online", warehouse.getId().toString());
                if (!publish.getStatusCode().is2xxSuccessful()) {
                    log.warn("Canonical forecast refresh returned {}; policy will use the last eligible publish for warehouse {}",
                            publish.getStatusCode().value(), warehouse.getCode());
                }
                policyService.createRun(new InventoryPolicyRecommendationService.CreatePolicyRunRequest(
                        warehouse.getId(), 6, null, MODEL, null, "inventory-intelligence-scheduler",
                        "Daily forecast and inventory-policy review; manager approval required."));
            } catch (Exception ex) {
                log.error("Daily inventory-intelligence refresh failed for warehouse {}: {}",
                        warehouse.getCode(), ex.getMessage(), ex);
            }
        }
    }

    @Scheduled(cron = "${intelligence.slotting.cron:0 30 3 1 * *}", zone = "Asia/Colombo")
    public void createMonthlyLowDisruptionSlottingReview() {
        if (!enabled) return;
        for (WarehouseEntity warehouse : warehouses.findByDatasetVersion(DATASET_VERSION)) {
            try {
                var latest = slottingPlans.findByWarehouseIdOrderByCreatedAtDesc(warehouse.getId());
                if (!latest.isEmpty() && latest.get(0).getCreatedAt() != null
                        && latest.get(0).getCreatedAt().isAfter(OffsetDateTime.now().minusDays(25))) {
                    continue;
                }
                slottingService.createPlan(new SlottingPlanService.CreatePlanRequest(
                        warehouse.getId(), 1, LocalDate.now(), null, new BigDecimal("5"),
                        "inventory-intelligence-scheduler",
                        "Monthly low-disruption review; approval and off-peak scheduling required.", true));
            } catch (Exception ex) {
                log.error("Monthly slotting review failed for warehouse {}: {}",
                        warehouse.getCode(), ex.getMessage(), ex);
            }
        }
    }
}
