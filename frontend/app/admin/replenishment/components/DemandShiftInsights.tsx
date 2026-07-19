"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  slottingIntelligenceApi,
  type DemandInsight,
} from "@/lib/api/slotting-intelligence";

type DemandShiftInsightsProps = {
  warehouseId?: string;
  compact?: boolean;
  limit?: number;
};

function trendIcon(trend: DemandInsight["trend"]) {
  if (trend === "RISING") return "↑";
  if (trend === "FALLING") return "↓";
  return "→";
}

function trendClass(trend: DemandInsight["trend"]) {
  return clsx(
    "badge badge-sm font-semibold",
    trend === "RISING" && "badge-success",
    trend === "STABLE" && "badge-ghost",
    trend === "FALLING" && "badge-warning"
  );
}

function riskLabel(score: number) {
  if (score >= 0.7) return { text: "High", className: "text-error font-semibold" };
  if (score >= 0.4) return { text: "Medium", className: "text-warning" };
  return { text: "Low", className: "text-success" };
}

export function DemandShiftInsights({
  warehouseId,
  compact = false,
  limit = 12,
}: DemandShiftInsightsProps) {
  const [insights, setInsights] = useState<DemandInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!warehouseId) {
        setInsights([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await slottingIntelligenceApi.getDemandInsights(warehouseId);
        if (!cancelled) setInsights(data.slice(0, limit));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load demand insights");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [warehouseId, limit]);

  if (!warehouseId) {
    return (
      <div className="text-sm text-base-content/60">
        Select a warehouse to view demand shift insights.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-base-content/60">Loading demand insights…</div>;
  }

  if (error) {
    return <div className="alert alert-warning text-sm">{error}</div>;
  }

  if (insights.length === 0) {
    return (
      <div className="text-sm text-base-content/60">
        No forecast-driven insights yet. Run forecasts or issue-stats refresh to populate.
      </div>
    );
  }

  const rising = insights.filter((i) => i.trend === "RISING").length;
  const falling = insights.filter((i) => i.trend === "FALLING").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="badge badge-outline">{rising} rising</span>
        <span className="badge badge-outline">{falling} falling</span>
        <span className="badge badge-outline">{insights.length} SKUs tracked</span>
      </div>

      {compact ? (
        <ul className="space-y-2">
          {insights.map((row) => {
            const risk = riskLabel(row.stockoutRisk);
            return (
              <li
                key={row.materialId}
                className="flex items-center justify-between gap-2 text-sm border-b border-base-300/50 pb-2"
              >
                <span className="font-mono font-semibold">{row.materialCode}</span>
                <span className={trendClass(row.trend)}>
                  {trendIcon(row.trend)} {row.trend}
                </span>
                <span className="text-xs text-base-content/60">
                  {row.currentBins} → {row.recommendedBins} bins
                </span>
                <span className={clsx("text-xs", risk.className)}>{risk.text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Trend</th>
                <th>6m forecast</th>
                <th>Current bins</th>
                <th>Recommended</th>
                <th>ROP risk</th>
                <th>Evidence</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((row) => {
                const risk = riskLabel(row.stockoutRisk);
                const action =
                  row.trend === "RISING"
                    ? "Expand nearby"
                    : row.trend === "FALLING" && row.reclaimableBins > 0
                      ? `Reclaim ${row.reclaimableBins} carefully`
                      : "Hold";
                return (
                  <tr key={row.materialId}>
                    <td className="font-mono font-semibold">{row.materialCode}</td>
                    <td>
                      <span className={trendClass(row.trend)}>
                        {trendIcon(row.trend)} {row.trend}
                      </span>
                    </td>
                    <td>{Math.round(row.forecastP50).toLocaleString()} u</td>
                    <td>{row.currentBins}</td>
                    <td>{row.recommendedBins}</td>
                    <td className={risk.className}>{risk.text}</td>
                    <td className="text-xs">
                      {row.evidenceStatus === "FORECAST_BACKED"
                        ? `${row.confidencePct}% interval quality`
                        : row.evidenceStatus === "PARTIAL_FORECAST"
                          ? `${row.confidencePct}% partial horizon`
                          : "Historical fallback"}
                    </td>
                    <td className="text-xs">{action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
