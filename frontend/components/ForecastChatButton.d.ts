/**
 * Type surface for the untyped ForecastChatButton.jsx component. Without this,
 * its `= []` default props are inferred as `never[]` and every call site fails.
 */
export interface ForecastChatPoint {
  sku: string;
  month: string;
  p50: number;
}

export interface ForecastChatContext {
  sku?: string;
  forecastPoints?: ForecastChatPoint[];
  selectedMonth?: string;
  predictedUnits?: number | null;
  confidence?: number | null;
  mape?: number | null;
}

export interface ForecastChatButtonProps {
  sku?: string;
  skuOptions?: string[];
  forecastPoints?: ForecastChatPoint[];
  selectedMonth?: string;
  predictedUnits?: number | null;
  confidence?: number | null;
  mape?: number | null;
  onSkuChange?: (sku: string) => void;
  onOpen?: () => void;
}

declare const ForecastChatButton: (props: ForecastChatButtonProps) => JSX.Element;
export default ForecastChatButton;
