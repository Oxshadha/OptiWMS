import { apiClient } from './client';

export interface ForecastPoint {
  run_id: number;
  dataset: string;
  model: string;
  warehouse_id?: string | null;
  sku: string;
  category?: string | null;
  month: string;
  horizon: number;
  p10: number;
  p50: number;
  p90: number;
  y_true?: number | null;
}

export interface InventoryRecommendation {
  run_id: number;
  dataset: string;
  model: string;
  warehouse_id?: string | null;
  sku: string;
  category?: string | null;
  safety_stock: number;
  reorder_point: number;
  target_max: number;
  on_hand_inventory?: number | null;
  suggested_order_qty: number;
}

export interface ForecastMetric {
  run_id: number;
  dataset: string;
  model: string;
  warehouse_id?: string | null;
  split: string;
  horizon: number;
  WAPE?: number;
  MASE_mean?: number;
  RMSE?: number;
  Bias?: number;
}

export interface InferenceAuditSummary {
  count: number;
  fallback_rate: number;
  error_rate?: number;
  total_errors?: number;
  latency_avg_ms: number;
  latency_p95_ms: number;
}

export interface InferenceAuditItem {
  ts?: string;
  event?: string;
  dataset?: string;
  model?: string;
  model_name?: string;
  horizon?: number;
  series_count?: number;
  response_count?: number;
  latency_ms?: number;
  errors_count?: number;
  fallback_count?: number;
  fallback_used?: boolean;
  baseline_method?: string | null;
  fallback_methods?: string[] | null;
}

export interface InferenceAuditResponse {
  summary: InferenceAuditSummary;
  items: InferenceAuditItem[];
}

export interface InferenceAlertRule {
  rule: string;
  status: string;
  severity?: string;
  threshold: number;
  value: number;
  message: string;
}

export interface InferenceAlertsResponse {
  status: string;
  summary: InferenceAuditSummary;
  rules_triggered: InferenceAlertRule[];
  window_size: number;
  dataset?: string;
  model_name?: string;
}

export interface ForecastDashboardSummary {
  item: {
    run_id: number;
    dataset: string;
    model: string;
    warehouse_id?: string | null;
    forecast_rows: number;
    metric_rows: number;
    inventory_rows: number;
    sku_count: number;
    horizon_count: number;
    reorder_now_count: number;
    overstock_risk_count: number;
    total_suggested_order_qty: number;
    avg_wape_test?: number | null;
    avg_rmse_test?: number | null;
    avg_mase_test?: number | null;
    avg_abs_bias_test?: number | null;
    rmse_vs_avg_demand_pct?: number | null;
  } | null;
  top_reorder: Array<{
    sku: string;
    category?: string | null;
    on_hand_inventory?: number | null;
    reorder_point: number;
    target_max: number;
    suggested_order_qty: number;
  }>;
  forecast_points: Array<{
    sku: string;
    horizon: number;
    month: string;
    p10: number;
    p50: number;
    p90: number;
    y_true?: number | null;
  }>;
}

export interface RuntimeContractHealth {
  status: string;
  mode?: string;
  reason?: string;
  schema?: string;
  missing_tables?: string[];
  missing_columns?: Record<string, string[]>;
}

export interface OperationalHealthSnapshot {
  id?: number;
  status: string;
  drift_status?: string;
  freshness_status?: string;
  inference_status?: string;
  created_at?: string;
  details?: Record<string, unknown>;
}

export interface OperationalHealthHistoryResponse {
  count: number;
  items: OperationalHealthSnapshot[];
}

export interface ProductionReadinessCheck {
  name: string;
  pass: boolean;
  value?: unknown;
  details?: Record<string, unknown>;
  threshold?: number;
  window_hours?: number;
}

export interface ProductionReadinessResponse {
  ready: boolean;
  dataset?: string;
  model_name?: string;
  split: string;
  inference_window: number;
  soak_hours: number;
  checks: ProductionReadinessCheck[];
  latest_operational_health?: OperationalHealthSnapshot;
}

export interface GatewayModelsResponse {
  champion?: {
    name: string;
    version?: string;
    is_champion?: boolean;
  };
  available_models?: Array<{
    name: string;
    artifact_count?: number;
    is_champion?: boolean;
  }>;
}

export interface GovernanceStatus {
  enabled: boolean;
  interval_seconds: number;
  dataset: string;
  model_name: string;
  split: string;
  inference_window: number;
  soak_hours: number;
  auto_promote: boolean;
  auto_rollback: boolean;
  rollback_model_name: string;
  last_action?: {
    ts?: string | null;
    action?: string;
    status?: string;
    message?: string;
    entry_id?: number;
    [key: string]: unknown;
  };
}

export interface ReleaseEvidenceBundle {
  dataset?: string;
  model_name?: string;
  split: string;
  inference_window: number;
  soak_hours: number;
  runtime_contract: Record<string, unknown>;
  acceptance_gate: Record<string, unknown>;
  production_readiness: Record<string, unknown>;
  inference_alerts: Record<string, unknown>;
  latest_operational_health: Record<string, unknown>;
  operational_health_history: Record<string, unknown>;
  latest_published_run?: Record<string, unknown> | null;
  registry_entries: Array<Record<string, unknown>>;
}

function normalizeInferenceSummary(raw: unknown): InferenceAuditSummary {
  const s = (raw ?? {}) as Record<string, unknown>;
  const count = Number(s.count ?? 0);
  const fallbackRate = Number(s.fallback_rate ?? 0);
  const totalErrors = Number(s.total_errors ?? 0);
  const latencyAvg = Number(s.latency_avg_ms ?? s.avg_latency_ms ?? 0);
  const latencyP95 = Number(s.latency_p95_ms ?? s.p95_latency_ms ?? 0);
  const computedErrorRate = count > 0 ? totalErrors / count : 0;
  const errorRate = Number(s.error_rate ?? computedErrorRate);
  return {
    count: Number.isFinite(count) ? count : 0,
    fallback_rate: Number.isFinite(fallbackRate) ? fallbackRate : 0,
    total_errors: Number.isFinite(totalErrors) ? totalErrors : 0,
    error_rate: Number.isFinite(errorRate) ? errorRate : 0,
    latency_avg_ms: Number.isFinite(latencyAvg) ? latencyAvg : 0,
    latency_p95_ms: Number.isFinite(latencyP95) ? latencyP95 : 0,
  };
}

export interface PagedResponse<T> {
  items: T[];
  count: number;
}

export interface ForecastRunTriggerResponse {
  job?: string;
  status?: string;
  run_id?: number;
  mode_requested?: string;
  triggered_at?: string;
  publish_result?: Record<string, unknown>;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v));
    }
  });
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export const aiForecastApi = {
  getForecasts(params: {
    sku?: string;
    horizon?: number;
    dataset?: string;
    model?: string;
    warehouseId?: string;
    runId?: number;
  } = {}) {
    const query = buildQuery({
      sku: params.sku,
      horizon: params.horizon,
      dataset: params.dataset,
      model: params.model,
      warehouseId: params.warehouseId,
      run_id: params.runId,
    });
    return apiClient.get<PagedResponse<ForecastPoint>>(`/ai/forecasts${query}`);
  },

  getForecastMetrics(params: {
    split?: string;
    horizon?: number;
    dataset?: string;
    model?: string;
    runId?: number;
    warehouseId?: string;
  } = {}) {
    const query = buildQuery({
      split: params.split,
      horizon: params.horizon,
      dataset: params.dataset,
      model: params.model,
      run_id: params.runId,
      warehouseId: params.warehouseId,
    });
    return apiClient.get<PagedResponse<ForecastMetric>>(`/ai/forecast-metrics${query}`);
  },

  getInventoryRecommendations(params: {
    sku?: string;
    dataset?: string;
    model?: string;
    warehouseId?: string;
    runId?: number;
  } = {}) {
    const query = buildQuery({
      sku: params.sku,
      dataset: params.dataset,
      model: params.model,
      warehouseId: params.warehouseId,
      run_id: params.runId,
    });
    return apiClient.get<PagedResponse<InventoryRecommendation>>(`/ai/inventory-recommendations${query}`);
  },

  triggerForecastRun(params: {
    dataset?: string;
    modelName?: string;
    mode?: "snapshot" | "online" | "auto";
    warehouseId?: string;
    criticalOverride?: boolean;
  } = {}) {
    const query = buildQuery({
      dataset: params.dataset ?? 'P',
      modelName: params.modelName ?? 'LIGHTGBM',
      mode: params.mode ?? 'snapshot',
      warehouseId: params.warehouseId,
      critical_override: params.criticalOverride === true ? "true" : undefined,
    });
    return apiClient.post<ForecastRunTriggerResponse>(`/ai/jobs/forecast-run${query}`);
  },

  getHealth() {
    return apiClient.get<Record<string, unknown>>('/ai/health');
  },

  getRuntimeContractHealth(force?: boolean) {
    const query = buildQuery({ force: force === true ? "true" : undefined });
    return apiClient.get<RuntimeContractHealth>(`/ai/health/runtime-contract${query}`);
  },

  getInferenceAudit(params: {
    limit?: number;
    dataset?: string;
    modelName?: string;
  } = {}) {
    const query = buildQuery({
      limit: params.limit,
      dataset: params.dataset,
      model_name: params.modelName,
    });
    return apiClient.get(`/ai/artifacts/inference-audit${query}`).then((raw) => {
      const body = (raw ?? {}) as Record<string, unknown>;
      return {
        summary: normalizeInferenceSummary(body.summary),
        items: Array.isArray(body.items) ? (body.items as InferenceAuditItem[]) : [],
      } as InferenceAuditResponse;
    });
  },

  getInferenceAlerts(params: {
    limit?: number;
    dataset?: string;
    modelName?: string;
  } = {}) {
    const query = buildQuery({
      limit: params.limit,
      dataset: params.dataset,
      model_name: params.modelName,
    });
    return apiClient.get(`/ai/artifacts/inference-alerts${query}`).then((raw) => {
      const body = (raw ?? {}) as Record<string, unknown>;
      const rules = Array.isArray(body.rules_triggered) ? body.rules_triggered : [];
      return {
        status: String(body.status ?? "ok"),
        summary: normalizeInferenceSummary(body.summary),
        rules_triggered: rules.map((r) => {
          const item = (r ?? {}) as Record<string, unknown>;
          const status = String(item.status ?? item.severity ?? "info");
          return {
            rule: String(item.rule ?? ""),
            status,
            severity: status,
            threshold: Number(item.threshold ?? 0),
            value: Number(item.value ?? 0),
            message: String(item.message ?? ""),
          } as InferenceAlertRule;
        }),
        window_size: Number(body.window_size ?? 0),
        dataset: body.dataset ? String(body.dataset) : undefined,
        model_name: body.model_name ? String(body.model_name) : undefined,
      } as InferenceAlertsResponse;
    });
  },

  getForecastDashboardSummary(params: {
    dataset?: string;
    model?: string;
    warehouseId?: string;
    runId?: number;
    sku?: string;
    horizon?: number;
    topN?: number;
  } = {}) {
    const query = buildQuery({
      dataset: params.dataset,
      model: params.model,
      warehouseId: params.warehouseId,
      run_id: params.runId,
      sku: params.sku,
      horizon: params.horizon,
      top_n: params.topN,
    });
    return apiClient.get<ForecastDashboardSummary>(`/ai/forecast-dashboard-summary${query}`);
  },

  getOperationalHealth() {
    return apiClient.get<OperationalHealthSnapshot>('/ai/artifacts/operational-health');
  },

  refreshOperationalHealth() {
    return apiClient.post<OperationalHealthSnapshot>('/ai/artifacts/operational-health/refresh');
  },

  getOperationalHealthHistory(limit?: number) {
    const query = buildQuery({ limit });
    return apiClient.get<OperationalHealthHistoryResponse>(`/ai/artifacts/operational-health/history${query}`);
  },

  getProductionReadiness(params: {
    dataset?: string;
    modelName?: string;
    split?: string;
    inferenceWindow?: number;
    soakHours?: number;
  } = {}) {
    const query = buildQuery({
      dataset: params.dataset,
      model_name: params.modelName,
      split: params.split ?? "test",
      inference_window: params.inferenceWindow ?? 500,
      soak_hours: params.soakHours ?? 24,
    });
    return apiClient.get<ProductionReadinessResponse>(`/ai/artifacts/production-readiness${query}`);
  },

  getGatewayModels() {
    return apiClient.get<GatewayModelsResponse>('/ai/gateway/models');
  },

  getGovernanceStatus() {
    return apiClient.get<GovernanceStatus>('/ai/artifacts/governance/status');
  },

  runGovernanceTick() {
    return apiClient.post<GovernanceStatus>('/ai/artifacts/governance/tick');
  },

  getReleaseEvidence(params: {
    dataset?: string;
    modelName?: string;
    split?: string;
    inferenceWindow?: number;
    soakHours?: number;
    historyLimit?: number;
  } = {}) {
    const query = buildQuery({
      dataset: params.dataset,
      model_name: params.modelName,
      split: params.split ?? "test",
      inference_window: params.inferenceWindow ?? 200,
      soak_hours: params.soakHours ?? 24,
      history_limit: params.historyLimit ?? 100,
    });
    return apiClient.get<ReleaseEvidenceBundle>(`/ai/artifacts/release-evidence${query}`);
  },
};
