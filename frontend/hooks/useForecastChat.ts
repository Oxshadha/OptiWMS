import { useCallback, useState } from "react";

export type ForecastPointForChat = { month: string; p50: number };

export type ForecastChatContext = {
  sku?: string | null;
  forecastPoints: ForecastPointForChat[];
  selectedMonth?: string | null;
  /** p50 forecast value for the nearest future month */
  predictedUnits?: number | null;
  /** Model confidence score 0-1, derived from MAPE */
  confidence?: number | null;
  /** Current MAPE % for this SKU / model */
  mape?: number | null;
  capturedAt: string;
};

export function useForecastChat() {
  const [context, setContext] = useState<ForecastChatContext | null>(null);

  const captureOpenContext = useCallback(
    (payload: {
      sku?: string | null;
      forecastPoints?: ForecastPointForChat[];
      selectedMonth?: string | null;
      predictedUnits?: number | null;
      confidence?: number | null;
      mape?: number | null;
    }) => {
      const ctx: ForecastChatContext = {
        sku: payload.sku ?? null,
        forecastPoints: payload.forecastPoints ?? [],
        selectedMonth: payload.selectedMonth ?? null,
        predictedUnits: payload.predictedUnits ?? null,
        confidence: payload.confidence ?? null,
        mape: payload.mape ?? null,
        capturedAt: new Date().toISOString(),
      };
      setContext(ctx);
      return ctx;
    },
    [],
  );

  return { context, captureOpenContext } as const;
}
