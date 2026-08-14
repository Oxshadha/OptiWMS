package com.optiwms.coreapi.assistant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AssistantToolService {
    public static final String DATASET_VERSION = "PROJECT_OPERATIONAL_SIMULATION_V8";
    public static final String DATASET = "PROJECT_OPS_RM_PM";
    public static final String MODEL = "PROJECT_OPS_EXTRA_TREES_CAUSAL";

    @PersistenceContext
    private EntityManager entityManager;

    public Map<String, Object> skuOutlook(UUID warehouseId, String sku, int horizon, String correlationId) {
        List<Object[]> materialRows = query("""
                SELECT m.id, m.material_code, m.description, m.unit_type, m.min_order_quantity,
                       m.order_multiple, m.units_per_handling_unit,
                       COALESCE(SUM(i.available_quantity), 0),
                       MAX(i.reorder_point), MAX(i.order_quantity), MAX(i.lead_time_days),
                       MAX(i.pallet_requirement)
                FROM materials m
                LEFT JOIN inventory i ON i.material_id = m.id AND i.warehouse_id = :warehouse
                WHERE UPPER(m.material_code) = UPPER(:sku)
                  AND (
                    EXISTS (SELECT 1 FROM inventory scoped_inventory
                            WHERE scoped_inventory.material_id = m.id
                              AND scoped_inventory.warehouse_id = :warehouse)
                    OR EXISTS (SELECT 1 FROM forecast_results scoped_forecast
                               WHERE scoped_forecast.material_id = m.id
                                 AND scoped_forecast.warehouse_id = :warehouse
                                 AND scoped_forecast.training_source = 'project_ops_v8')
                  )
                GROUP BY m.id, m.material_code, m.description, m.unit_type, m.min_order_quantity,
                         m.order_multiple, m.units_per_handling_unit
                """, Map.of("warehouse", warehouseId, "sku", sku));
        if (materialRows.isEmpty()) {
            return envelope(warehouseId, correlationId, Map.of("sku", sku),
                    List.of("SKU was not found in the authorized warehouse catalog."),
                    List.of("materials.material_code:" + sku));
        }
        Object[] m = materialRows.get(0);
        UUID materialId = (UUID) m[0];
        List<Object[]> forecastRows = query("""
                SELECT forecast_period, horizon, forecast_p10, forecast_p50, forecast_p90, model_name, created_at
                FROM forecast_results
                WHERE material_id = :material AND warehouse_id = :warehouse
                  AND decision_eligible = TRUE AND training_source = 'project_ops_v8'
                  AND horizon <= :horizon
                ORDER BY forecast_period, horizon
                """, Map.of("material", materialId, "warehouse", warehouseId, "horizon", horizon));
        List<Map<String, Object>> series = forecastRows.stream().map(row -> map(
                "period", row[0], "horizon", row[1], "p10", row[2], "p50", row[3], "p90", row[4],
                "unit", m[3] != null ? m[3] : "units")).toList();

        List<Object[]> policyRows = query("""
                SELECT l.id, l.proposed_reorder_point, l.proposed_order_qty, l.proposed_target_stock,
                       l.target_pallet_positions, l.recommendation_status, l.rationale, r.id,
                       l.stockout_risk_score, r.created_at
                FROM inventory_policy_recommendation_lines l
                JOIN inventory_policy_recommendation_runs r ON r.id = l.run_id
                WHERE l.material_id = :material AND r.warehouse_id = :warehouse
                  AND UPPER(COALESCE(r.status, '')) NOT IN
                      ('FAILED', 'ROLLED_BACK', 'REJECTED', 'CANCELLED', 'EXPIRED')
                ORDER BY r.created_at DESC LIMIT 1
                """, Map.of("material", materialId, "warehouse", warehouseId));

        Map<String, Object> facts = map(
                "sku", m[1], "productName", m[2], "unit", m[3] != null ? m[3] : "units",
                "availableStock", m[7], "reorderPoint", m[8], "currentOrderQuantity", m[9],
                "leadTimeDays", m[10], "currentPalletPositions", m[11],
                "moq", m[4], "orderMultiple", m[5], "unitsPerHandlingUnit", m[6],
                "forecast", series);
        List<String> warnings = new ArrayList<>();
        List<String> refs = new ArrayList<>(List.of("materials:" + materialId, "forecast_results:" + materialId));
        if (!policyRows.isEmpty()) {
            Object[] p = policyRows.get(0);
            facts.put("recommendation", map(
                    "id", p[0], "proposedReorderPoint", p[1], "proposedOrderQuantity", p[2],
                    "proposedTargetStock", p[3], "targetPalletPositions", p[4], "status", p[5],
                    "stockoutRiskScore", p[8], "calculation", p[6],
                    "deepLink", "/admin/inventory-intelligence?recommendation=" + p[0]));
            refs.add("inventory_policy_recommendation_lines:" + p[0]);
            refs.add("inventory_policy_recommendation_runs:" + p[7]);
        } else {
            warnings.add("No policy recommendation has been calculated for this SKU.");
        }
        if (series.isEmpty()) warnings.add("No decision-eligible forecast rows are available for the requested horizon.");
        return envelope(warehouseId, correlationId, facts, warnings, refs);
    }

    public Map<String, Object> inventoryRisks(UUID warehouseId, String severity, int limit, String correlationId) {
        String severityFilter = severity == null ? "" : severity.trim().toUpperCase(Locale.ROOT);
        StringBuilder sql = new StringBuilder("""
                SELECT l.id, l.material_code, m.description, l.recommendation_status,
                       l.stockout_risk_score, l.current_available_stock, l.proposed_reorder_point,
                       l.proposed_order_qty, l.moq, l.order_multiple, l.lead_time_days, r.created_at
                FROM inventory_policy_recommendation_lines l
                JOIN inventory_policy_recommendation_runs r ON r.id = l.run_id
                JOIN materials m ON m.id = l.material_id
                WHERE r.warehouse_id = :warehouse
                  AND r.id = (SELECT id FROM inventory_policy_recommendation_runs
                              WHERE warehouse_id = :warehouse
                                AND UPPER(COALESCE(status, '')) NOT IN
                                    ('FAILED', 'ROLLED_BACK', 'REJECTED', 'CANCELLED', 'EXPIRED')
                              ORDER BY created_at DESC LIMIT 1)
                """);
        if ("HIGH".equals(severityFilter)) sql.append(" AND l.stockout_risk_score >= 0.70");
        else if ("MEDIUM".equals(severityFilter)) sql.append(" AND l.stockout_risk_score >= 0.35 AND l.stockout_risk_score < 0.70");
        else if ("LOW".equals(severityFilter)) sql.append(" AND l.stockout_risk_score < 0.35");
        else if (!severityFilter.isBlank()) sql.append(" AND UPPER(l.recommendation_status) = :severity");
        sql.append(" ORDER BY l.stockout_risk_score DESC, l.material_code LIMIT :limit");
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("warehouse", warehouseId);
        params.put("limit", Math.max(1, Math.min(limit, 100)));
        if (!severityFilter.isBlank() && !Set.of("HIGH", "MEDIUM", "LOW").contains(severityFilter)) {
            params.put("severity", severityFilter);
        }
        List<Object[]> rows = query(sql.toString(), params);
        List<Map<String, Object>> risks = rows.stream().map(row -> map(
                "recommendationId", row[0], "sku", row[1], "productName", row[2], "status", row[3],
                "stockoutRiskScore", row[4], "availableStock", row[5], "reorderPoint", row[6],
                "proposedOrderQuantity", row[7], "moq", row[8], "orderMultiple", row[9],
                "leadTimeDays", row[10], "asOf", row[11], "unit", "units",
                "deepLink", "/admin/inventory-intelligence?recommendation=" + row[0])).toList();
        return envelope(warehouseId, correlationId, map("risks", risks, "resultCount", risks.size()),
                rows.isEmpty() ? List.of("No matching inventory risks exist in the latest planning run.") : List.of(),
                rows.stream().map(row -> "inventory_policy_recommendation_lines:" + row[0]).toList());
    }

    public Map<String, Object> recommendationExplanation(UUID warehouseId, UUID recommendationId, String correlationId) {
        List<Object[]> rows = query("""
                SELECT l.material_code, m.description, l.current_available_stock, l.forecast_p50, l.forecast_p90,
                       l.proposed_reorder_point, l.proposed_order_qty, l.moq, l.order_multiple, l.lead_time_days,
                       l.target_pallet_positions, l.stockout_risk_score, l.recommendation_status, l.rationale,
                       r.id, r.planning_cycle_id, r.created_at
                FROM inventory_policy_recommendation_lines l
                JOIN inventory_policy_recommendation_runs r ON r.id = l.run_id
                JOIN materials m ON m.id = l.material_id
                WHERE l.id = :id AND r.warehouse_id = :warehouse
                """, Map.of("id", recommendationId, "warehouse", warehouseId));
        if (rows.isEmpty()) {
            return envelope(warehouseId, correlationId, Map.of("recommendationId", recommendationId),
                    List.of("Recommendation was not found in the authorized warehouse."), List.of());
        }
        Object[] r = rows.get(0);
        Map<String, Object> facts = map(
                "recommendationId", recommendationId, "sku", r[0], "productName", r[1],
                "availableStock", r[2], "forecastDemandP50", r[3], "forecastDemandP90", r[4],
                "proposedReorderPoint", r[5], "proposedOrderQuantity", r[6], "moq", r[7],
                "orderMultiple", r[8], "leadTimeDays", r[9], "targetPalletPositions", r[10],
                "stockoutRiskScore", r[11], "status", r[12], "calculationExplanation", r[13],
                "planningCycleId", r[15], "unit", "units",
                "deepLink", "/admin/inventory-intelligence?recommendation=" + recommendationId);
        return envelope(warehouseId, correlationId, facts, List.of(),
                List.of("inventory_policy_recommendation_lines:" + recommendationId,
                        "inventory_policy_recommendation_runs:" + r[14]));
    }

    public Map<String, Object> planningCycleStatus(UUID warehouseId, UUID cycleId, String correlationId) {
        List<Object[]> rows = query("""
                SELECT pc.lifecycle_status, pc.cadence, pc.scheduled_for, pc.started_at, pc.completed_at,
                       pc.failure_reason, pc.created_at,
                       (SELECT COUNT(*) FROM inventory_policy_recommendation_runs p WHERE p.planning_cycle_id=pc.id),
                       (SELECT COUNT(*) FROM space_optimization_runs s WHERE s.planning_cycle_id=pc.id),
                       (SELECT COUNT(*) FROM slotting_plans sp WHERE sp.planning_cycle_id=pc.id),
                       (SELECT COUNT(*) FROM stock_transfer_lines st WHERE st.planning_cycle_id=pc.id),
                       (SELECT COUNT(*) FROM stock_transfer_lines st WHERE st.planning_cycle_id=pc.id AND st.status='completed')
                FROM planning_cycles pc WHERE pc.id=:id AND pc.warehouse_id=:warehouse
                """, Map.of("id", cycleId, "warehouse", warehouseId));
        if (rows.isEmpty()) {
            return envelope(warehouseId, correlationId, Map.of("planningCycleId", cycleId),
                    List.of("Planning cycle was not found in the authorized warehouse."), List.of());
        }
        Object[] r = rows.get(0);
        Map<String, Object> facts = map(
                "planningCycleId", cycleId, "status", r[0], "cadence", r[1], "scheduledFor", r[2],
                "startedAt", r[3], "completedAt", r[4], "failureReason", r[5], "createdAt", r[6],
                "policyRuns", r[7], "spaceRuns", r[8], "slottingPlans", r[9],
                "relocationTasks", r[10], "completedRelocations", r[11],
                "deepLink", "/admin/inventory-intelligence?cycle=" + cycleId);
        return envelope(warehouseId, correlationId, facts, List.of(), List.of("planning_cycles:" + cycleId));
    }

    private Map<String, Object> envelope(UUID warehouseId, String correlationId, Map<String, Object> facts,
                                         List<String> warnings, List<String> sourceRefs) {
        return map("asOf", OffsetDateTime.now(), "warehouse", warehouseId, "dataset", DATASET,
                "datasetVersion", DATASET_VERSION, "modelName", MODEL, "facts", facts,
                "warnings", warnings, "sourceRecordReferences", sourceRefs, "correlationId", correlationId);
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> query(String sql, Map<String, Object> parameters) {
        Query query = entityManager.createNativeQuery(sql);
        parameters.forEach(query::setParameter);
        return query.getResultList();
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        return result;
    }
}
