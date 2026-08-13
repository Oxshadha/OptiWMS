package com.optiwms.coreapi.ai;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private static final String CANONICAL_TRAINING_SOURCE = "project_ops_v8";
    private static final String CANONICAL_VERSION = "PROJECT_OPERATIONAL_SIMULATION_V8";
    private static final String CANONICAL_EVIDENCE_SPLIT = "test";

    @PersistenceContext
    private EntityManager entityManager;

    public boolean hasCanonicalForecasts() {
        Number count = (Number) entityManager
                .createNativeQuery("""
                        SELECT COUNT(*) FROM forecast_results
                        WHERE training_source = :source
                        """)
                .setParameter("source", CANONICAL_TRAINING_SOURCE)
                .getSingleResult();
        return count != null && count.longValue() > 0;
    }

    public ResponseEntity<Object> getGatewayModels() {
        List<Map<String, Object>> rows = availableModels();
        Optional<Map<String, Object>> canonical = rows.stream()
                .filter(row -> Boolean.TRUE.equals(row.get("is_champion")))
                .findFirst().or(() -> rows.stream().findFirst());
        Map<String, Object> champion = canonical
                .map(row -> Map.<String, Object>of(
                        "name", String.valueOf(row.get("name")),
                        "dataset", CANONICAL_DATASET,
                        "version", CANONICAL_VERSION,
                        "is_champion", Boolean.TRUE.equals(row.get("is_champion")),
                        "source", "wms_forecast_results",
                        "data_quality_tier", CANONICAL_QUALITY_TIER,
                        "training_source", CANONICAL_TRAINING_SOURCE
                ))
                .orElse(null);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("champion", champion);
        response.put("available_models", rows);
        return ResponseEntity.ok(response);
    }

    @Transactional
    public ResponseEntity<Object> approveModel(String model, String approvedBy) {
        int registryUpdated = entityManager.createNativeQuery("""
                UPDATE forecast_model_registry
                SET status = 'PROMOTED', promoted_by = :approvedBy, promoted_at = now(), updated_at = now()
                WHERE dataset = :dataset AND version = :version
                  AND LOWER(model_name) = LOWER(:model) AND promotion_eligible = TRUE
                """).setParameter("approvedBy", approvedBy).setParameter("dataset", CANONICAL_DATASET)
                .setParameter("version", CANONICAL_VERSION)
                .setParameter("model", model).executeUpdate();
        if (registryUpdated == 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "rejected", "message", "Model is absent or has not passed the statistical promotion gate"));
        }
        entityManager.createNativeQuery("""
                UPDATE forecast_model_registry SET status = 'CHALLENGER', updated_at = now()
                WHERE dataset = :dataset AND version = :version
                  AND LOWER(model_name) <> LOWER(:model) AND status = 'PROMOTED'
                """).setParameter("dataset", CANONICAL_DATASET)
                .setParameter("version", CANONICAL_VERSION)
                .setParameter("model", model).executeUpdate();
        int forecastRows = entityManager.createNativeQuery("""
                UPDATE forecast_results SET decision_eligible = TRUE
                WHERE training_source = :source AND LOWER(model_name) = LOWER(:model)
                """).setParameter("source", CANONICAL_TRAINING_SOURCE).setParameter("model", model).executeUpdate();
        entityManager.createNativeQuery("""
                UPDATE forecast_model_evidence SET decision_eligible = TRUE
                WHERE dataset = :dataset AND LOWER(model_name) = LOWER(:model)
                """).setParameter("dataset", CANONICAL_DATASET).setParameter("model", model).executeUpdate();
        return ResponseEntity.ok(Map.of(
                "status", "PROMOTED", "model", model, "approved_by", approvedBy, "forecast_rows_approved", forecastRows));
    }

    public ResponseEntity<Object> getForecasts(
            String sku,
            Integer horizon,
            String dataset,
            String model,
            Integer runId,
            String warehouseId
    ) {
        return getForecasts(sku, horizon, dataset, model, runId, warehouseId, 0, 100);
    }

    public ResponseEntity<Object> getForecasts(
            String sku, Integer horizon, String dataset, String model, Integer runId,
            String warehouseId, Integer page, Integer size
    ) {
        String selectedModel = resolveModel(model, warehouseId);
        int safePage = pageNumber(page);
        int safeSize = pageSize(size);
        List<Object[]> rows = fetchForecastRows(selectedModel, sku, horizon, warehouseId, safeSize, safePage * safeSize);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", rows.stream().map(this::forecastItem).toList());
        response.put("count", rows.size());
        response.put("source", "wms_forecast_results");
        response.put("canonical", true);
        response.put("dataset_requested", dataset);
        response.put("model_requested", model);
        response.put("model_used", selectedModel);
        response.put("data_quality_tier", CANONICAL_QUALITY_TIER);
        response.put("training_source", CANONICAL_TRAINING_SOURCE);
        response.put("release_status", modelReleaseStatus(selectedModel));
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("has_more", rows.size() == safeSize);
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<Object> getForecastSkus(String model, String warehouseId) {
        String selectedModel = resolveModel(model, warehouseId);
        StringBuilder sql = new StringBuilder("""
                SELECT m.material_code,
                       COALESCE(NULLIF(m.description, ''), m.material_code),
                       LOWER(COALESCE(m.material_type, 'unknown')),
                       COUNT(*) AS horizon_count
                FROM forecast_results fr
                JOIN materials m ON m.id = fr.material_id
                WHERE LOWER(fr.model_name) = LOWER(:model)
                  AND fr.training_source = :source
                """);
        if (warehouseId != null && !warehouseId.isBlank()) {
            sql.append(" AND (fr.warehouse_id IS NULL OR fr.warehouse_id::text = :warehouseId)");
        }
        sql.append("""
                 GROUP BY m.material_code, m.description, m.material_type
                 ORDER BY CASE LOWER(m.material_type)
                            WHEN 'raw_material' THEN 1
                            WHEN 'packaging_material' THEN 2
                            WHEN 'product' THEN 3
                            ELSE 4
                          END,
                          m.material_code
                """);
        Query query = entityManager.createNativeQuery(sql.toString())
                .setParameter("model", selectedModel)
                .setParameter("source", CANONICAL_TRAINING_SOURCE);
        if (warehouseId != null && !warehouseId.isBlank()) query.setParameter("warehouseId", warehouseId);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        List<Map<String, Object>> items = rows.stream().map(row -> Map.<String, Object>of(
                "sku", String.valueOf(row[0]),
                "description", String.valueOf(row[1]),
                "material_type", String.valueOf(row[2]),
                "horizon_count", asInt(row[3])
        )).toList();
        return ResponseEntity.ok(Map.of("items", items, "count", items.size(), "model_used", selectedModel));
    }

    public boolean hasRows(String sku, Integer horizon, String model, String warehouseId) {
        String selectedModel = resolveModel(model, warehouseId);
        return !fetchForecastRows(selectedModel, sku, horizon, warehouseId, 1).isEmpty();
    }

    public ResponseEntity<Object> getForecastMetrics(
            String split, Integer horizon, String dataset, String model, String warehouseId
    ) {
        String selectedModel = resolveModel(model, warehouseId);
        String requestedSplit = canonicalEvidenceSplit(split);
        StringBuilder sql = new StringBuilder("""
                SELECT split, horizon, wape, mae, rmse, bias, under_forecast_rate,
                       interval_nominal_coverage, interval_empirical_coverage,
                       evaluation_rows, material_count
                FROM forecast_model_evidence
                WHERE dataset = :dataset
                  AND LOWER(model_name) = LOWER(:model)
                  AND split = :split
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND warehouse_id::text = :warehouseId");
        if (horizon != null) sql.append(" AND horizon = :horizon");
        sql.append(" ORDER BY horizon");
        Query query = entityManager.createNativeQuery(sql.toString())
                .setParameter("dataset", CANONICAL_DATASET)
                .setParameter("model", selectedModel)
                .setParameter("split", requestedSplit);
        if (warehouseId != null && !warehouseId.isBlank()) query.setParameter("warehouseId", warehouseId);
        if (horizon != null) query.setParameter("horizon", horizon);
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
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
                WITH inv AS (
                    SELECT i.material_id,
                           SUM(i.quantity) AS quantity,
                           SUM(i.available_quantity) AS available_quantity,
                           MAX(i.buffer_stock) AS buffer_stock,
                           MAX(i.reorder_point) AS reorder_point,
                           MAX(i.max_stock) AS max_stock,
                           MAX(i.moq) AS moq,
                           MAX(i.lead_time_days) AS lead_time_days
                    FROM inventory i
                    JOIN materials source_material ON source_material.id = i.material_id
                    WHERE i.data_quality_tier = :quality
                      AND source_material.data_quality_tier = :quality
                      AND i.location_code IS NOT NULL
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND i.warehouse_id::text = :warehouseId");
        sql.append("""
                    GROUP BY i.material_id
                ), demand AS (
                    SELECT dh.material_id, AVG(dh.demand_units) AS average_monthly_demand
                    FROM demand_history dh
                    WHERE dh.data_quality_tier = :quality
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND dh.warehouse_id::text = :warehouseId");
        sql.append("""
                    GROUP BY dh.material_id
                ), sku_error AS (
                    SELECT b.material_id,
                           CASE WHEN SUM(b.y_true) > 0
                                THEN SUM(b.absolute_error) / SUM(b.y_true)
                                ELSE NULL END AS sku_wape
                    FROM forecast_backtest_rows b
                    WHERE b.dataset = :dataset
                      AND LOWER(b.model_name) = LOWER(:model)
                      AND b.split = :split
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND b.warehouse_id::text = :warehouseId");
        sql.append("""
                    GROUP BY b.material_id
                )
                SELECT m.material_code, COALESCE(NULLIF(m.description, ''), m.material_code),
                       LOWER(COALESCE(m.material_type, 'unknown')),
                       m.abc_class, m.fms_class,
                       COALESCE(i.buffer_stock, 0), COALESCE(i.reorder_point, 0),
                       COALESCE(i.max_stock, 0), COALESCE(i.available_quantity, i.quantity, 0),
                       CASE WHEN COALESCE(i.available_quantity, i.quantity, 0) < COALESCE(i.reorder_point, 0)
                            THEN GREATEST(COALESCE(i.max_stock, 0) - COALESCE(i.available_quantity, i.quantity, 0), 0)
                            ELSE 0 END,
                       COALESCE(d.average_monthly_demand, 0), e.sku_wape,
                       COALESCE(i.moq, 0), COALESCE(m.order_multiple, 1),
                       COALESCE(i.lead_time_days, 30), COALESCE(m.unit_cost_standard, 0)
                FROM inv i
                JOIN materials m ON m.id = i.material_id
                LEFT JOIN demand d ON d.material_id = m.id
                LEFT JOIN sku_error e ON e.material_id = m.id
                WHERE m.decision_eligible = TRUE
                  AND m.material_type IN ('raw_material', 'packaging_material')
                """);
        if (sku != null && !sku.isBlank()) sql.append(" AND m.material_code = :sku");
        sql.append(" ORDER BY m.material_code LIMIT 5000");
        Query q = entityManager.createNativeQuery(sql.toString())
                .setParameter("quality", CANONICAL_QUALITY_TIER)
                .setParameter("dataset", CANONICAL_DATASET)
                .setParameter("model", selectedModel)
                .setParameter("split", CANONICAL_EVIDENCE_SPLIT);
        if (warehouseId != null && !warehouseId.isBlank()) q.setParameter("warehouseId", warehouseId);
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
            item.put("description", String.valueOf(row[1]));
            item.put("category", String.valueOf(row[2]));
            item.put("abc_class", row[3]);
            item.put("fms_class", row[4]);
            item.put("amalgamated_class", String.valueOf(row[3]) + String.valueOf(row[4]));
            item.put("safety_stock", asDouble(row[5]));
            item.put("reorder_point", asDouble(row[6]));
            item.put("target_max", asDouble(row[7]));
            item.put("on_hand_inventory", asDouble(row[8]));
            item.put("suggested_order_qty", asDouble(row[9]));
            item.put("average_monthly_demand", asDouble(row[10]));
            item.put("sku_wape", asNullableDouble(row[11]));
            item.put("moq", asDouble(row[12]));
            item.put("order_multiple", asDouble(row[13]));
            item.put("lead_time_days", asInt(row[14]));
            item.put("unit_cost", asDouble(row[15]));
            item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
            item.put("stock_source", "live_wms_inventory_snapshot");
            item.put("demand_source", "project_operational_demand_history");
            item.put("policy_source", "wms_inventory_min_max_plus_promoted_forecast");
            return item;
        }).toList();
        return ResponseEntity.ok(Map.of("items", items, "count", items.size(), "source", "wms_inventory_policy", "canonical", true));
    }

    public ResponseEntity<Object> getRawMaterialRequirements(String rmSku, String model, String warehouseId) {
        String selectedModel = resolveModel(model, warehouseId);
        StringBuilder sql = new StringBuilder("""
                WITH forecast AS (
                    SELECT fr.material_id, SUM(fr.forecast_p50) AS gross_requirement_qty
                    FROM forecast_results fr
                    WHERE LOWER(fr.model_name) = LOWER(:model)
                      AND fr.training_source = :source
                      AND fr.decision_eligible = TRUE
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND fr.warehouse_id::text = :warehouseId");
        sql.append("""
                    GROUP BY fr.material_id
                ), inv AS (
                    SELECT i.material_id,
                           SUM(i.available_quantity) AS available_quantity,
                           MAX(i.buffer_stock) AS buffer_stock,
                           MAX(i.reorder_point) AS reorder_point
                    FROM inventory i
                    WHERE i.data_quality_tier = :quality
                      AND i.location_code IS NOT NULL
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND i.warehouse_id::text = :warehouseId");
        sql.append("""
                    GROUP BY i.material_id
                )
                SELECT m.material_code, LOWER(m.material_type), f.gross_requirement_qty,
                       COALESCE(i.available_quantity, 0), COALESCE(i.buffer_stock, 0),
                       COALESCE(i.reorder_point, 0),
                       GREATEST(f.gross_requirement_qty + COALESCE(i.buffer_stock, 0)
                           - COALESCE(i.available_quantity, 0), 0)
                FROM forecast f
                JOIN materials m ON m.id = f.material_id
                LEFT JOIN inv i ON i.material_id = m.id
                WHERE m.decision_eligible = TRUE
                  AND m.material_type IN ('raw_material', 'packaging_material')
                """);
        if (rmSku != null && !rmSku.isBlank()) sql.append(" AND m.material_code = :rmSku");
        sql.append(" ORDER BY m.material_code LIMIT 5000");
        Query q = entityManager.createNativeQuery(sql.toString())
                .setParameter("model", selectedModel)
                .setParameter("source", CANONICAL_TRAINING_SOURCE)
                .setParameter("quality", CANONICAL_QUALITY_TIER);
        if (warehouseId != null && !warehouseId.isBlank()) q.setParameter("warehouseId", warehouseId);
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

    public ResponseEntity<Object> getDemandHistory(String sku, String warehouseId, Integer page, Integer size) {
        int safeSize = pageSize(size);
        int safePage = pageNumber(page);
        StringBuilder sql = new StringBuilder("""
                SELECT m.material_code, LOWER(m.material_type), dh.period, dh.demand_units,
                       dh.promotion_flag, dh.holiday_flag, dh.lead_time_days
                FROM demand_history dh JOIN materials m ON m.id = dh.material_id
                WHERE dh.data_quality_tier = :quality
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND dh.warehouse_id::text = :warehouseId");
        if (sku != null && !sku.isBlank()) sql.append(" AND m.material_code = :sku");
        sql.append(" ORDER BY dh.period DESC, m.material_code LIMIT :limit OFFSET :offset");
        Query query = entityManager.createNativeQuery(sql.toString())
                .setParameter("quality", CANONICAL_QUALITY_TIER)
                .setParameter("limit", safeSize).setParameter("offset", safePage * safeSize);
        if (warehouseId != null && !warehouseId.isBlank()) query.setParameter("warehouseId", warehouseId);
        if (sku != null && !sku.isBlank()) query.setParameter("sku", sku);
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
        List<Map<String, Object>> items = rows.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("sku", row[0]); item.put("material_type", row[1]); item.put("month", toIsoDate(row[2]));
            item.put("actual_demand", asDouble(row[3])); item.put("promotion_flag", row[4]);
            item.put("holiday_flag", row[5]); item.put("lead_time_days", asNullableDouble(row[6]));
            return item;
        }).toList();
        return paged(items, safePage, safeSize, "wms_demand_history");
    }

    public ResponseEntity<Object> getBacktests(String sku, String model, String warehouseId, Integer page, Integer size) {
        String selectedModel = resolveModel(model, warehouseId);
        int safeSize = pageSize(size);
        int safePage = pageNumber(page);
        StringBuilder sql = new StringBuilder("""
                SELECT m.material_code,
                       (b.origin_month + ((b.horizon - 1) * interval '1 month'))::date,
                       b.horizon, b.y_true, b.forecast_p05,
                       b.forecast_p50, b.forecast_p95, b.residual, b.absolute_error, b.interval_covered
                FROM forecast_backtest_rows b JOIN materials m ON m.id = b.material_id
                WHERE b.dataset = :dataset AND LOWER(b.model_name) = LOWER(:model)
                  AND b.split = :split
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND b.warehouse_id::text = :warehouseId");
        if (sku != null && !sku.isBlank()) sql.append(" AND m.material_code = :sku");
        sql.append(" ORDER BY b.origin_month DESC, m.material_code LIMIT :limit OFFSET :offset");
        Query query = entityManager.createNativeQuery(sql.toString())
                .setParameter("dataset", CANONICAL_DATASET).setParameter("model", selectedModel)
                .setParameter("split", CANONICAL_EVIDENCE_SPLIT)
                .setParameter("limit", safeSize).setParameter("offset", safePage * safeSize);
        if (warehouseId != null && !warehouseId.isBlank()) query.setParameter("warehouseId", warehouseId);
        if (sku != null && !sku.isBlank()) query.setParameter("sku", sku);
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
        List<Map<String, Object>> items = rows.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("sku", row[0]); item.put("month", toIsoDate(row[1])); item.put("horizon", asInt(row[2]));
            item.put("y_true", asDouble(row[3])); item.put("p10", asNullableDouble(row[4]));
            item.put("p50", asDouble(row[5])); item.put("p90", asNullableDouble(row[6]));
            item.put("residual", asDouble(row[7])); item.put("absolute_error", asDouble(row[8]));
            item.put("interval_covered", row[9]); item.put("model", selectedModel);
            return item;
        }).toList();
        return paged(items, safePage, safeSize, "wms_forecast_backtest_rows");
    }

    public ResponseEntity<Object> getIntervalCalibration(String model, String warehouseId) {
        String selectedModel = resolveModel(model, warehouseId);
        StringBuilder sql = new StringBuilder("""
                SELECT horizon, COUNT(*), AVG(CASE WHEN interval_covered THEN 1.0 ELSE 0.0 END),
                       AVG(forecast_p95 - forecast_p05)
                FROM forecast_backtest_rows
                WHERE dataset = :dataset AND LOWER(model_name) = LOWER(:model) AND split = :split
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND warehouse_id::text = :warehouseId");
        sql.append(" GROUP BY horizon ORDER BY horizon");
        Query query = entityManager.createNativeQuery(sql.toString())
                .setParameter("dataset", CANONICAL_DATASET).setParameter("model", selectedModel)
                .setParameter("split", CANONICAL_EVIDENCE_SPLIT);
        if (warehouseId != null && !warehouseId.isBlank()) query.setParameter("warehouseId", warehouseId);
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
        List<Map<String, Object>> items = rows.stream().map(row -> Map.<String, Object>of(
                "horizon", asInt(row[0]), "evaluation_rows", asInt(row[1]),
                "empirical_coverage", asDouble(row[2]), "mean_interval_width", asDouble(row[3]),
                "nominal_coverage", 0.90)).toList();
        return ResponseEntity.ok(Map.of("items", items, "count", items.size(), "source", "wms_forecast_backtest_rows"));
    }

    public ResponseEntity<Object> getGenerationProvenance() {
        @SuppressWarnings("unchecked") List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT dataset_version, dataset_hash, status, row_counts, validation, started_at, finished_at
                FROM project_dataset_load_audit WHERE dataset_version = :version
                ORDER BY started_at DESC LIMIT 1
                """).setParameter("version", CANONICAL_VERSION).getResultList();
        if (rows.isEmpty()) return ResponseEntity.ok(Map.of("item", Map.of(), "source", "project_dataset_load_audit"));
        Object[] row = rows.get(0);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("dataset_version", row[0]); item.put("dataset_hash", row[1]); item.put("status", row[2]);
        item.put("row_counts", row[3]); item.put("validation", row[4]);
        item.put("started_at", row[5]); item.put("finished_at", row[6]);
        return ResponseEntity.ok(Map.of("item", item, "source", "project_dataset_load_audit"));
    }

    private String canonicalEvidenceSplit(String requestedSplit) {
        if (requestedSplit == null || requestedSplit.isBlank()) {
            return CANONICAL_EVIDENCE_SPLIT;
        }
        String normalized = requestedSplit.trim().toLowerCase(Locale.ROOT);
        // Older dashboard builds called the locked holdout "untouched_test".
        // V8 publishes the same untouched holdout under its contract name "test".
        return "untouched_test".equals(normalized) ? CANONICAL_EVIDENCE_SPLIT : normalized;
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
        item.put("training_source", CANONICAL_TRAINING_SOURCE);

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
        if (!normalized.isBlank() && hasModelRows(normalized, warehouseId)) {
            return normalized;
        }
        @SuppressWarnings("unchecked")
        List<String> registry = entityManager.createNativeQuery("""
                SELECT model_name FROM forecast_model_registry
                WHERE dataset = :dataset AND version = :version
                ORDER BY CASE status WHEN 'PROMOTED' THEN 0 WHEN 'PENDING_MANAGER_APPROVAL' THEN 1 ELSE 2 END,
                         promotion_eligible DESC, updated_at DESC LIMIT 1
                """).setParameter("dataset", CANONICAL_DATASET)
                .setParameter("version", CANONICAL_VERSION)
                .getResultList();
        if (!registry.isEmpty() && hasModelRows(registry.get(0), warehouseId)) return registry.get(0);
        return normalized.isBlank() ? CANONICAL_MODEL : normalized;
    }

    private Map<String, Object> fetchTestEvidence(String model, String warehouseId) {
        StringBuilder sql = new StringBuilder("""
                SELECT wape, rmse, ABS(bias)
                FROM forecast_model_evidence
                WHERE dataset = :dataset
                  AND LOWER(model_name) = LOWER(:model)
                  AND split = 'test'
                """);
        if (warehouseId != null && !warehouseId.isBlank()) sql.append(" AND warehouse_id::text = :warehouseId");
        sql.append(" ORDER BY created_at DESC LIMIT 1");
        Query query = entityManager.createNativeQuery(sql.toString())
                .setParameter("dataset", CANONICAL_DATASET)
                .setParameter("model", model);
        if (warehouseId != null && !warehouseId.isBlank()) query.setParameter("warehouseId", warehouseId);
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
        if (rows.isEmpty()) return Map.of();
        Object[] row = rows.get(0);
        return Map.of("wape", asNullableDouble(row[0]), "rmse", asNullableDouble(row[1]), "abs_bias", asNullableDouble(row[2]));
    }

    private boolean hasModelRows(String model, String warehouseId) {
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*)
                FROM forecast_results fr
                WHERE LOWER(fr.model_name) = LOWER(:model)
                  AND fr.training_source = :source
                """);
        if (warehouseId != null && !warehouseId.isBlank()) {
            sql.append(" AND (fr.warehouse_id IS NULL OR fr.warehouse_id::text = :warehouse_id)");
        }
        Query q = entityManager.createNativeQuery(sql.toString())
                .setParameter("model", model)
                .setParameter("source", CANONICAL_TRAINING_SOURCE);
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
                WHERE training_source = :source
                GROUP BY model_name
                ORDER BY CASE WHEN model_name = :canonical THEN 0 ELSE 1 END, forecast_rows DESC, model_name ASC
                """)
                .setParameter("canonical", CANONICAL_MODEL)
                .setParameter("source", CANONICAL_TRAINING_SOURCE)
                .getResultList();
        return rows.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", String.valueOf(row[0]));
            item.put("dataset", CANONICAL_DATASET);
            item.put("artifact_count", asInt(row[1]));
            item.put("material_count", asInt(row[2]));
            item.put("is_champion", "PROMOTED".equalsIgnoreCase(modelReleaseStatus(String.valueOf(row[0]))));
            item.put("source", "wms_forecast_results");
            item.put("data_quality_tier", CANONICAL_QUALITY_TIER);
            return item;
        }).toList();
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> fetchForecastRows(String model, String sku, Integer horizon, String warehouseId, int limit) {
        return fetchForecastRows(model, sku, horizon, warehouseId, limit, 0);
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> fetchForecastRows(
            String model, String sku, Integer horizon, String warehouseId, int limit, int offset) {
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
                  AND fr.training_source = :source
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
        sql.append(" ORDER BY fr.forecast_period ASC, fr.horizon ASC, m.material_code ASC LIMIT :limit OFFSET :offset");
        Query q = entityManager.createNativeQuery(sql.toString())
                .setParameter("model", model)
                .setParameter("source", CANONICAL_TRAINING_SOURCE)
                .setParameter("limit", limit)
                .setParameter("offset", offset);
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
                  AND fr.training_source = :source
                """);
        if (warehouseId != null && !warehouseId.isBlank()) {
            sql.append(" AND (fr.warehouse_id IS NULL OR fr.warehouse_id::text = :warehouse_id)");
        }
        Query q = entityManager.createNativeQuery(sql.toString())
                .setParameter("model", model)
                .setParameter("source", CANONICAL_TRAINING_SOURCE);
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
        item.put("training_source", CANONICAL_TRAINING_SOURCE);
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

    private String modelReleaseStatus(String model) {
        @SuppressWarnings("unchecked")
        List<String> rows = entityManager.createNativeQuery("""
                SELECT status FROM forecast_model_registry
                WHERE dataset = :dataset AND version = :version
                  AND LOWER(model_name) = LOWER(:model)
                ORDER BY updated_at DESC LIMIT 1
                """).setParameter("dataset", CANONICAL_DATASET)
                .setParameter("version", CANONICAL_VERSION)
                .setParameter("model", model).getResultList();
        return rows.isEmpty() ? "UNREGISTERED" : rows.get(0);
    }

    private static int pageNumber(Integer page) {
        return page == null ? 0 : Math.max(0, page);
    }

    private static int pageSize(Integer size) {
        return size == null ? 100 : Math.max(1, Math.min(200, size));
    }

    private static ResponseEntity<Object> paged(
            List<Map<String, Object>> items, int page, int size, String source) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("count", items.size());
        response.put("page", page);
        response.put("size", size);
        response.put("has_more", items.size() == size);
        response.put("source", source);
        return ResponseEntity.ok(response);
    }
}
