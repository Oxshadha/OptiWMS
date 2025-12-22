"use client";

import { WorkerProductivityMetrics } from "@/lib/api/analytics";

interface ProductivityChartProps {
  metrics: WorkerProductivityMetrics[];
  metricType: "picksPerHour" | "errorRate" | "dwellTime";
  title: string;
}

export function ProductivityChart({ metrics, metricType, title }: ProductivityChartProps) {
  const maxValue = Math.max(
    ...metrics.map((m) => {
      switch (metricType) {
        case "picksPerHour":
          return m.picksPerHour;
        case "errorRate":
          return m.errorRate;
        case "dwellTime":
          return m.averageDwellTime;
        default:
          return 0;
      }
    }),
    1
  );

  const getValue = (metric: WorkerProductivityMetrics) => {
    switch (metricType) {
      case "picksPerHour":
        return metric.picksPerHour;
      case "errorRate":
        return metric.errorRate;
      case "dwellTime":
        return metric.averageDwellTime;
      default:
        return 0;
    }
  };

  const getUnit = () => {
    switch (metricType) {
      case "picksPerHour":
        return "PPH";
      case "errorRate":
        return "%";
      case "dwellTime":
        return "min";
      default:
        return "";
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h3 className="card-title text-lg">{title}</h3>
        <div className="space-y-3 mt-4">
          {metrics.map((metric) => {
            const value = getValue(metric);
            const percentage = (value / maxValue) * 100;
            return (
              <div key={metric.workerId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{metric.workerName}</span>
                  <span className="text-base-content/60">
                    {value.toFixed(metricType === "picksPerHour" ? 1 : 2)} {getUnit()}
                  </span>
                </div>
                <div className="w-full bg-base-200 rounded-full h-2.5">
                  <div
                    className={`
                      h-2.5 rounded-full transition-all
                      ${metricType === "errorRate" && value > 3 ? "bg-error" : ""}
                      ${metricType === "errorRate" && value <= 3 && value > 1 ? "bg-warning" : ""}
                      ${metricType === "errorRate" && value <= 1 ? "bg-success" : ""}
                      ${metricType === "picksPerHour" ? "bg-primary" : ""}
                      ${metricType === "dwellTime" ? "bg-info" : ""}
                    `}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {metrics.length === 0 && (
          <div className="text-center py-8 text-base-content/60">
            No productivity data available
          </div>
        )}
      </div>
    </div>
  );
}

