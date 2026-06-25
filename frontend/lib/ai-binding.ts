/**
 * Single source of truth for forecast dataset/model binding across UI workspaces.
 * Override defaults with NEXT_PUBLIC_AI_DATASET / NEXT_PUBLIC_AI_MODEL.
 */
import { aiForecastApi } from './api/ai-forecast';

export type ForecastBinding = {
  dataset: string;
  model: string;
  runId?: number;
};

const DEFAULT_BINDING: ForecastBinding = {
  dataset: process.env.NEXT_PUBLIC_AI_DATASET?.trim() || 'B',
  model: process.env.NEXT_PUBLIC_AI_MODEL?.trim() || 'CATBOOST',
};

let cachedBinding: ForecastBinding | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

export function getDefaultForecastBinding(): ForecastBinding {
  return { ...DEFAULT_BINDING };
}

export async function resolveForecastBinding(options?: {
  warehouseId?: string;
  forceRefresh?: boolean;
}): Promise<ForecastBinding> {
  if (!options?.forceRefresh && cachedBinding && Date.now() < cacheExpiresAt) {
    return cachedBinding;
  }

  try {
    const summary = await aiForecastApi.getForecastDashboardSummary({
      dataset: DEFAULT_BINDING.dataset,
      model: DEFAULT_BINDING.model,
      warehouseId: options?.warehouseId,
    });
    const item = summary?.item;
    if (item?.dataset && item?.model) {
      cachedBinding = {
        dataset: String(item.dataset),
        model: String(item.model),
        runId: item.run_id,
      };
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return cachedBinding;
    }
  } catch {
    // Try forecast rows next.
  }

  try {
    const forecastRes = await aiForecastApi.getForecasts({
      dataset: DEFAULT_BINDING.dataset,
      model: DEFAULT_BINDING.model,
      warehouseId: options?.warehouseId,
      horizon: 1,
    });
    const rows = forecastRes.items ?? [];
    if (rows.length > 0) {
      const latest = [...rows].sort((a, b) => b.run_id - a.run_id)[0];
      if (latest.dataset && latest.model) {
        cachedBinding = {
          dataset: String(latest.dataset),
          model: String(latest.model),
          runId: latest.run_id,
        };
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return cachedBinding;
      }
    }
  } catch {
    // Use static defaults.
  }

  return { ...DEFAULT_BINDING };
}
