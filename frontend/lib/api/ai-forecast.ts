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
  error_rate: number;
  latency_avg_ms: number;
  latency_p95_ms: number;
}

export interface InferenceAuditItem {
  ts: string;
  dataset?: string;
  model?: string;
  horizon?: number;
  series_count?: number;
  latency_ms?: number;
  errors_count?: number;
  fallback_count?: number;
}

export interface InferenceAuditResponse {
  summary: InferenceAuditSummary;
  items: InferenceAuditItem[];
}

export interface InferenceAlertRule {
  rule: string;
  severity: string;
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

export interface PagedResponse<T> {
  items: T[];
  count: number;
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
    warehouseId?: string;
  } = {}) {
    const query = buildQuery({
      split: params.split,
      horizon: params.horizon,
      dataset: params.dataset,
      model: params.model,
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

  triggerForecastRun(params: { dataset?: string; modelName?: string; warehouseId?: string } = {}) {
    const query = buildQuery({
      dataset: params.dataset ?? 'B',
      modelName: params.modelName ?? 'CATBOOST',
      warehouseId: params.warehouseId,
    });
    return apiClient.post(`/ai/jobs/forecast-run${query}`);
  },

  getHealth() {
    return apiClient.get<Record<string, unknown>>('/ai/health');
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
    return apiClient.get<InferenceAuditResponse>(`/ai/artifacts/inference-audit${query}`);
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
    return apiClient.get<InferenceAlertsResponse>(`/ai/artifacts/inference-alerts${query}`);
  },
};
