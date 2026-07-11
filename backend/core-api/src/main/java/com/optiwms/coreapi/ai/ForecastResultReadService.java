package com.optiwms.coreapi.ai;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.*;

@Service
public class ForecastResultReadService {
    /**
     * The project-operational simulation is the single planning source used by
     * the WMS demo. It is explicitly labelled in every response; it must never
     * be presented as externally observed production history.
     */
    private static final String CANONICAL_DATASET = "PROJECT_OPS_RM_PM";
    private static final String CANONICAL_MODEL = "PROJECT_OPS_EXTRA_TREES_CAUSAL";
    private static final String CANONICAL_QUALITY_TIER = "PROJECT_OPERATIONAL_SIMULATION";

    @PersistenceContext
    private EntityManager entityManager;

    public boolean hasCanonicalForecasts() {
        Number count = (Number) entityManager
                .createNativeQuery("""
                        SELECT COUNT(*) FROM forecast_results
                        WHERE model_name = :model AND decision_eligible = TRUE
                        """)
                .setParameter("model", CANONICAL_MODEL)
                .getSingleResult();
        return count != null && count.longValue() > 0;
    }

    public ResponseEntity<Object> getGatewayModels() {
        List<Map<String, Object>> rows = availableModels();
        Optional<Map<String, Object>> canonical = rows.stream()
                .filter(row -> CANONICAL_MODEL.equalsIgnoreCase(String.valueOf(row.get("name"))))
                .findFirst();
        Map<String, Object> champion = canonical
                .map(row -> Map.<String, Object>of(
                        "name", CANONICAL_MODEL,
                        "dataset", CANONICAL_DATASET,
                        "version", "v8",
                        "is_champion", true,
                        "source", "wms_forecast_results",
                        "data_quality_tier", CANONICAL_QUALITY_TIER,
                        "training_source", "v8_controlled_synthetic_validation"
                ))
                .orElse(null);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("champion", champion);
        response.put("available_models", rows);
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<Object> getForecasts(
            String sku,
            Integer horizon,
            String dataset,
            String model,
            Integer runId,
            String warehouseId
    ) {
        String selectedModel = resolveModel(model, warehouseId);
        List<Object[]> rows = fetchForecastRows(selectedModel, sku, horizon, warehouseId, 50_000);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", rows.stream().map(this::forecastItem).toList());
        response.put("count", rows.size());
        response.put("source", "wms_forecast_results");
        response.put("canonical", true);
        response.put("dataset_requested", dataset);
        response.put("model_requested", model);
        response.put("model_used", selectedModel);
        response.put("data_quality_tier", CANONICAL_QUALITY_TIER);
        response.put("training_source", "v8_controlled_synthetic_validation");
        return ResponseEntity.ok(response);
    }

    public boolean hasRows(String sku, Integer horizon, String model, String warehouseId) {
        String selectedModel = resolveModel(model, warehouseId);
        return !fetchForecastRows(selectedModel, sku, horizon, warehouseId, 1).isEmpty();
    }

    public ResponseEntity<Object> getForecastMetrics(
            String split, Integer horizon, String dataset, String model, String warehouseId
    ) {
        String selectedModel = resolveModel(model, warehouseId);
        String requestedSplit = split == null || split.isBlank() ? "test" : split;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT split, horizon, wape, mae, rmse, bias, under_forecast_rate,
                       interval_nominal_coverage, interval_empirical_coverage,
                       evaluation_rows, material_count
                FROM forecast_model_evidence
                WHERE dataset = :dataset
                  AND LOWER(model_name) = LOWER(:model)
                  AND split = :split
                  AND decision_eligible = TRUE
                  AND (:warehouseId IS NULL OR warehouse_id::text = :warehouseId)
                  AND (:horizon IS NULL OR horizon = :horizon)
                ORDER BY horizon
                """)
                .setParameter("dataset", CANONICAL_DATASET)
                .setParameter("model", selectedModel)
                .setParameter("split", requestedSplit)
                .setParameter("warehouseId", blankToNull(warehouseId))
                .setParameter("horizon", horizon)
                .getResultList();
        List<Map<String, Object>> items = rows.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("run_id", 0);
            item.put("dataset", CANONICAL_DATASET);
            item.put("model", selectedModel);
            item.put("warehouse_id", warehouseId);
            item.put("split", String.valueOf(row[0]));
            item.put("horizon", asInt(row[1]));
            item.put("WAPE", asNullableDouble(row[2]));
            item.put("MAE", asNullableDouble(row[3]));
            item.put("RMSE", asNullableDouble(row[4]));
            item.put("Bias", asNullableDouble(row[5]));
            item.put("under_forecast_rate", asNullableDouble(row[6]));
            item.put("nominal_interval_coverage", asNullableDouble(row[7]));
            item.put("empirical_interval_coverage", asNullableDouble(row[8]));
            item.put("evaluation_rows", asInt(row[9]));
            item.put("material_count", asInt(row[10]));
            item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
            item.put("evaluation_protocol", "locked selection plus untouched rolling-origin test");
            return item;
        }).toList();
        return ResponseEntity.ok(Map.of(
                "items", items,
                "count", items.size(),
                "source", "wms_forecast_model_evidence",
                "canonical", true
        ));
    }

    public ResponseEntity<Object> getInventoryRecommendations(String sku, String model, String warehouseId) {
        String selectedModel = resolveModel(model, warehouseId);
        StringBuilder sql = new StringBuilder("""
                SELECT m.material_code, LOWER(COALESCE(m.material_type, 'unknown')),
                       COALESCE(i.buffer_stock, 0), COALESCE(i.reorder_point, 0),
                       COALESCE(i.max_stock, 0), COALESCE(i.available_quantity, i.quantity, 0),
                       CASE WHEN COALESCE(i.available_quantity, i.quantity, 0) < COALESCE(i.reorder_point, 0)
                            THEN GREATEST(COALESCE(i.max_stock, 0) - COALESCE(i.available_quantity, i.quantity, 0), 0)
                            ELSE 0 END
                FROM inventory i
                JOIN materials m ON m.id = i.material_id
                WHERE i.warehouse_id::text = :warehouseId
                  AND m.decision_eligible = TRUE
                  AND m.material_type IN ('raw_material', 'packaging_material')
                """);
        if (sku != null && !sku.isBlank()) sql.append(" AND m.material_code = :sku");
        sql.append(" ORDER BY m.material_code LIMIT 5000");
        Query q = entityManager.createNativeQuery(sql.toString()).setParameter("warehouseId", warehouseId);
        if (sku != null && !sku.isBlank()) q.setParameter("sku", sku);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<Map<String, Object>> items = rows.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("run_id", 0);
            item.put("dataset", CANONICAL_DATASET);
            item.put("model", selectedModel);
            item.put("warehouse_id", warehouseId);
            item.put("sku", String.valueOf(row[0]));
            item.put("category", String.valueOf(row[1]));
            item.put("safety_stock", asDouble(row[2]));
            item.put("reorder_point", asDouble(row[3]));
            item.put("target_max", asDouble(row[4]));
            item.put("on_hand_inventory", asDouble(row[5]));
            item.put("suggested_order_qty", asDouble(row[6]));
            item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
            item.put("policy_source", "wms_inventory_min_max");
            return item;
        }).toList();
        return ResponseEntity.ok(Map.of("items", items, "count", items.size(), "source", "wms_inventory_policy", "canonical", true));
    }

    public ResponseEntity<Object> getRawMaterialRequirements(String rmSku, String model, String warehouseId) {
        String selectedModel = resolveModel(model, warehouseId);
        StringBuilder sql = new StringBuilder("""
                SELECT m.material_code, LOWER(m.material_type),
                       SUM(fr.forecast_p50), COALESCE(i.available_quantity, i.quantity, 0),
                       COALESCE(i.buffer_stock, 0), COALESCE(i.reorder_point, 0),
                       GREATEST(SUM(fr.forecast_p50) + COALESCE(i.buffer_stock, 0)
                           - COALESCE(i.available_quantity, i.quantity, 0), 0)
                FROM forecast_results fr
                JOIN materials m ON m.id = fr.material_id
                LEFT JOIN inventory i ON i.material_id = m.id AND i.warehouse_id = fr.warehouse_id
                    AND i.location_code IS NULL
                WHERE fr.warehouse_id::text = :warehouseId
                  AND LOWER(fr.model_name) = LOWER(:model)
                  AND fr.decision_eligible = TRUE
                  AND m.material_type IN ('raw_material', 'packaging_material')
                """);
        if (rmSku != null && !rmSku.isBlank()) sql.append(" AND m.material_code = :rmSku");
        sql.append(" GROUP BY m.material_code, m.material_type, i.available_quantity, i.quantity, i.buffer_stock, i.reorder_point ORDER BY m.material_code LIMIT 5000");
        Query q = entityManager.createNativeQuery(sql.toString())
                .setParameter("warehouseId", warehouseId)
                .setParameter("model", selectedModel);
        if (rmSku != null && !rmSku.isBlank()) q.setParameter("rmSku", rmSku);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<Map<String, Object>> items = rows.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("run_id", 0);
            item.put("dataset", CANONICAL_DATASET);
            item.put("model", selectedModel);
            item.put("warehouse_id", warehouseId);
            item.put("rm_sku", String.valueOf(row[0]));
            item.put("rm_category", String.valueOf(row[1]));
            item.put("fg_sku_count", 0);
            item.put("gross_requirement_qty", asDouble(row[2]));
            item.put("on_hand_inventory", asDouble(row[3]));
            item.put("safety_stock", asDouble(row[4]));
            item.put("reorder_point", asDouble(row[5]));
            item.put("net_requirement_qty", asDouble(row[6]));
            item.put("suggested_procure_qty", asDouble(row[6]));
            item.put("planning_mode", "direct_rm_pm_forecast");
            item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
            return item;
        }).toList();
        return ResponseEntity.ok(Map.of("items", items, "count", items.size(), "source", "wms_direct_rm_pm_plan", "canonical", true));
    }

    public ResponseEntity<Object> getDashboardSummary(
            String dataset,
            String model,
            Integer runId,
            String warehouseId,
            String sku,
            Integer horizon,
            Integer topN
    ) {
        String selectedModel = resolveModel(model, warehouseId);
        List<Object[]> summaryRows = fetchForecastSummaryRows(selectedModel, warehouseId);
        if (summaryRows.isEmpty()) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("item", null);
            response.put("top_reorder", List.of());
            response.put("forecast_points", List.of());
            return ResponseEntity.ok(response);
        }

        Object[] s = summaryRows.get(0);
        int forecastRows = asInt(s[0]);
        int skuCount = asInt(s[1]);
        int horizonCount = asInt(s[2]);
        List<Object[]> forecastRowsList = fetchForecastRows(selectedModel, sku, horizon, warehouseId, 5_000);

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("run_id", 0);
        item.put("dataset", CANONICAL_DATASET);
        item.put("model", selectedModel);
        item.put("warehouse_id", warehouseId);
        item.put("forecast_rows", forecastRows);
        item.put("metric_rows", 0);
        item.put("inventory_rows", 0);
        item.put("sku_count", skuCount);
        item.put("horizon_count", horizonCount);
        item.put("reorder_now_count", 0);
        item.put("overstock_risk_count", 0);
        item.put("total_suggested_order_qty", 0);
        item.put("avg_wape_test", null);
        item.put("avg_rmse_test", null);
        item.put("avg_mase_test", null);
        item.put("avg_abs_bias_test", null);
        item.put("rmse_vs_avg_demand_pct", null);
        item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
        item.put("training_source", "v8_controlled_synthetic_validation");

        Map<String, Object> testEvidence = fetchTestEvidence(selectedModel, warehouseId);
        if (!testEvidence.isEmpty()) {
            item.put("metric_rows", 1);
            item.put("avg_wape_test", testEvidence.get("wape"));
            item.put("avg_rmse_test", testEvidence.get("rmse"));
            item.put("avg_abs_bias_test", testEvidence.get("abs_bias"));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("item", item);
        response.put("top_reorder", List.of());
        response.put("forecast_points", forecastRowsList.stream().map(this::dashboardForecastPoint).toList());
        response.put("source", "wms_forecast_results");
        response.put("canonical", true);
        return ResponseEntity.ok(response);
    }

    private String resolveModel(String requestedModel, String warehouseId) {
        String normalized = requestedModel != null ? requestedModel.trim() : "";
        if (hasModelRows(CANONICAL_MODEL, warehouseId)) {
            return CANONICAL_MODEL;
        }
        if (!normalized.isBlank() && hasModelRows(normalized, warehouseId)) {
            return normalized;
        }
        return normalized.isBlank() ? CANONICAL_MODEL : normalized;
    }

    private Map<String, Object> fetchTestEvidence(String model, String warehouseId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT wape, rmse, ABS(bias)
                FROM forecast_model_evidence
                WHERE dataset = :dataset
                  AND LOWER(model_name) = LOWER(:model)
                  AND split = 'test'
                  AND decision_eligible = TRUE
                  AND (:warehouseId IS NULL OR warehouse_id::text = :warehouseId)
                ORDER BY created_at DESC
                LIMIT 1
                """)
                .setParameter("dataset", CANONICAL_DATASET)
                .setParameter("model", model)
                .setParameter("warehouseId", blankToNull(warehouseId))
                .getResultList();
        if (rows.isEmpty()) return Map.of();
        Object[] row = rows.get(0);
        return Map.of("wape", asNullableDouble(row[0]), "rmse", asNullableDouble(row[1]), "abs_bias", asNullableDouble(row[2]));
    }

    private boolean hasModelRows(String model, String warehouseId) {
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*)
                FROM forecast_results fr
                WHERE LOWER(fr.model_name) = LOWER(:model)
                  AND fr.decision_eligible = TRUE
                """);
        if (warehouseId != null && !warehouseId.isBlank()) {
            sql.append(" AND (fr.warehouse_id IS NULL OR fr.warehouse_id::text = :warehouse_id)");
        }
        Query q = entityManager.createNativeQuery(sql.toString()).setParameter("model", model);
        if (warehouseId != null && !warehouseId.isBlank()) {
            q.setParameter("warehouse_id", warehouseId);
        }
        Number count = (Number) q.getSingleResult();
        return count != null && count.longValue() > 0;
    }

    private List<Map<String, Object>> availableModels() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT model_name, COUNT(*) AS forecast_rows, COUNT(DISTINCT material_id) AS materials
                FROM forecast_results
                WHERE decision_eligible = TRUE
                GROUP BY model_name
                ORDER BY CASE WHEN model_name = :canonical THEN 0 ELSE 1 END, forecast_rows DESC, model_name ASC
                """)
                .setParameter("canonical", CANONICAL_MODEL)
                .getResultList();
        return rows.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", String.valueOf(row[0]));
            item.put("dataset", CANONICAL_DATASET);
            item.put("artifact_count", asInt(row[1]));
            item.put("material_count", asInt(row[2]));
            item.put("is_champion", CANONICAL_MODEL.equalsIgnoreCase(String.valueOf(row[0])));
            item.put("source", "wms_forecast_results");
            item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
            return item;
        }).toList();
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> fetchForecastRows(String model, String sku, Integer horizon, String warehouseId, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT
                    m.material_code,
                    COALESCE(NULLIF(m.description, ''), m.material_code) AS description,
                    LOWER(COALESCE(m.material_type, 'unknown')) AS material_type,
                    fr.forecast_period,
                    fr.horizon,
                    fr.model_name,
                    fr.forecast_p10,
                    fr.forecast_p50,
                    fr.forecast_p90,
                    fr.actual_demand,
                    fr.wape,
                    fr.method,
                    fr.created_at,
                    fr.warehouse_id::text
                FROM forecast_results fr
                JOIN materials m ON m.id = fr.material_id
                WHERE LOWER(fr.model_name) = LOWER(:model)
                  AND fr.decision_eligible = TRUE
                """);
        if (sku != null && !sku.isBlank()) {
            sql.append(" AND m.material_code = :sku");
        }
        if (horizon != null) {
            sql.append(" AND fr.horizon = :horizon");
        }
        if (warehouseId != null && !warehouseId.isBlank()) {
            sql.append(" AND (fr.warehouse_id IS NULL OR fr.warehouse_id::text = :warehouse_id)");
        }
        sql.append(" ORDER BY fr.forecast_period ASC, fr.horizon ASC, m.material_code ASC LIMIT :limit");
        Query q = entityManager.createNativeQuery(sql.toString())
                .setParameter("model", model)
                .setParameter("limit", limit);
        if (sku != null && !sku.isBlank()) {
            q.setParameter("sku", sku);
        }
        if (horizon != null) {
            q.setParameter("horizon", horizon);
        }
        if (warehouseId != null && !warehouseId.isBlank()) {
            q.setParameter("warehouse_id", warehouseId);
        }
        return q.getResultList();
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> fetchForecastSummaryRows(String model, String warehouseId) {
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*) AS forecast_rows,
                       COUNT(DISTINCT fr.material_id) AS sku_count,
                       COUNT(DISTINCT fr.horizon) AS horizon_count
                FROM forecast_results fr
                WHERE LOWER(fr.model_name) = LOWER(:model)
                  AND fr.decision_eligible = TRUE
                """);
        if (warehouseId != null && !warehouseId.isBlank()) {
            sql.append(" AND (fr.warehouse_id IS NULL OR fr.warehouse_id::text = :warehouse_id)");
        }
        Query q = entityManager.createNativeQuery(sql.toString()).setParameter("model", model);
        if (warehouseId != null && !warehouseId.isBlank()) {
            q.setParameter("warehouse_id", warehouseId);
        }
        return q.getResultList();
    }

    private Map<String, Object> forecastItem(Object[] row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("run_id", 0);
        item.put("dataset", CANONICAL_DATASET);
        item.put("model", String.valueOf(row[5]));
        item.put("warehouse_id", row[13]);
        item.put("sku", String.valueOf(row[0]));
        item.put("category", row[2]);
        item.put("month", toIsoDate(row[3]));
        item.put("horizon", asInt(row[4]));
        item.put("p10", asDouble(row[6]));
        item.put("p50", asDouble(row[7]));
        item.put("p90", asDouble(row[8]));
        item.put("y_true", asNullableDouble(row[9]));
        item.put("method", row[11]);
        item.put("source", "wms_forecast_results");
        item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
        item.put("training_source", "v8_controlled_synthetic_validation");
        return item;
    }

    private Map<String, Object> dashboardForecastPoint(Object[] row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("sku", String.valueOf(row[0]));
        item.put("horizon", asInt(row[4]));
        item.put("month", toIsoDate(row[3]));
        item.put("p10", asDouble(row[6]));
        item.put("p50", asDouble(row[7]));
        item.put("p90", asDouble(row[8]));
        item.put("y_true", asNullableDouble(row[9]));
        return item;
    }

    private static String toIsoDate(Object value) {
        if (value instanceof Date d) {
            return d.toLocalDate().toString();
        }
        if (value instanceof LocalDate d) {
            return d.toString();
        }
        return value != null ? String.valueOf(value) : null;
    }

    private static int asInt(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        return value == null ? 0 : Integer.parseInt(String.valueOf(value));
    }

    private static double asDouble(Object value) {
        if (value instanceof BigDecimal bd) {
            return bd.doubleValue();
        }
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        return value == null ? 0.0 : Double.parseDouble(String.valueOf(value));
    }

    private static Double asNullableDouble(Object value) {
        return value == null ? null : asDouble(value);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
