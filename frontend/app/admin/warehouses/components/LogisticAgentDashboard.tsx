import { useState, useEffect } from "react";
import { logisticAgentApi, DashboardMetrics, PerformanceMetrics, HealthCheckResponse } from "@/lib/api/logistic-agent";

interface LogisticAgentDashboardProps {
  warehouseId?: string;
}

export function LogisticAgentDashboard({ warehouseId }: LogisticAgentDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all data in parallel
      const [dashboardData, performanceData, healthData] = await Promise.all([
        logisticAgentApi.getDashboard(),
        logisticAgentApi.getPerformance(),
        logisticAgentApi.getHealthCheck(),
      ]);

      setMetrics(dashboardData);
      setPerformance(performanceData);
      setHealth(healthData);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error("Failed to load logistic agent data:", err);
      // If the error is an authentication redirect, don't show the scary Logistic Agent error
      if (err?.message?.includes("Session expired") || err?.message?.includes("Not authenticated")) {
        return; 
      }
      setError("Failed to connect to Logistic Agent. Make sure it's running on port 3001.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="card bg-base-100 border border-error rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-2xl">error</span>
          <div>
            <h3 className="text-lg font-semibold text-error mb-2">Logistic Agent Unavailable</h3>
            <p className="text-base-content/70 text-sm">{error}</p>
            <button
              onClick={loadData}
              className="btn btn-sm btn-error mt-3"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-base-content flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">route</span>
            Route Optimizer
          </h2>
          <p className="text-sm text-base-content/60 mt-1">
            Central data hub - Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="btn btn-sm btn-ghost gap-1"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Refresh
        </button>
      </div>

      {isLoading && !metrics ? (
        <div className="flex justify-center items-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : (
        <>
          {/* Main Metrics */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="card bg-base-100 border border-primary rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-base-content/70">Orders Processed</div>
                  <span className="material-symbols-outlined text-primary">orders</span>
                </div>
                <div className="text-3xl font-bold text-primary">{Math.floor(metrics.orders_processed)}</div>
                <div className="text-xs text-base-content/50 mt-2">Central hub total</div>
              </div>

              <div className="card bg-base-100 border border-success rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-base-content/70">Avg Route Time</div>
                  <span className="material-symbols-outlined text-success">schedule</span>
                </div>
                <div className="text-3xl font-bold text-success">{metrics.avg_route_time.toFixed(1)}s</div>
                <div className="text-xs text-base-content/50 mt-2">Path optimization</div>
              </div>

              <div className="card bg-base-100 border border-warning rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-base-content/70">Forecast Accuracy</div>
                  <span className="material-symbols-outlined text-warning">trending_up</span>
                </div>
                <div className="text-3xl font-bold text-warning">{(metrics.forecast_accuracy * 100).toFixed(1)}%</div>
                <div className="text-xs text-base-content/50 mt-2">Prediction quality</div>
              </div>

              <div className="card bg-base-100 border border-info rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-base-content/70">Efficiency Score</div>
                  <span className="material-symbols-outlined text-info">speed</span>
                </div>
                <div className="text-3xl font-bold text-info">{(metrics.efficiency_score * 100).toFixed(0)}%</div>
                <div className="text-xs text-base-content/50 mt-2">Overall optimization</div>
              </div>

              <div className="card bg-base-100 border border-accent rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-base-content/70">Utilization</div>
                  <span className="material-symbols-outlined text-accent">database</span>
                </div>
                <div className="text-3xl font-bold text-accent">{(metrics.warehouse_utilization * 100).toFixed(1)}%</div>
                <div className="text-xs text-base-content/50 mt-2">Warehouse capacity</div>
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {performance && (
            <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-base-content mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">analytics</span>
                Performance Metrics by Service
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="text-xs font-semibold text-base-content/60 uppercase mb-2">Path Optimization (8081)</div>
                  <div className="text-2xl font-bold text-primary">{performance.path_optimization_avg_time.toFixed(0)}ms</div>
                  <div className="text-xs text-base-content/50 mt-1">Average response time</div>
                </div>
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="text-xs font-semibold text-base-content/60 uppercase mb-2">Forecast Service (8082)</div>
                  <div className="text-2xl font-bold text-success">{performance.forecast_avg_time.toFixed(0)}ms</div>
                  <div className="text-xs text-base-content/50 mt-1">Average response time</div>
                </div>
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="text-xs font-semibold text-base-content/60 uppercase mb-2">Slotting Service (8083)</div>
                  <div className="text-2xl font-bold text-warning">{performance.slotting_avg_time.toFixed(0)}ms</div>
                  <div className="text-xs text-base-content/50 mt-1">Average response time</div>
                </div>
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="text-xs font-semibold text-base-content/60 uppercase mb-2">Orchestrator (8084)</div>
                  <div className="text-2xl font-bold text-info">{performance.orchestrator_avg_time.toFixed(0)}ms</div>
                  <div className="text-xs text-base-content/50 mt-1">Average response time</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-base-300">
                <div className="text-sm text-base-content/70">
                  <strong>Total Requests:</strong> {performance.total_requests}
                </div>
              </div>
            </div>
          )}

          {/* Service Health */}
          {health && (
            <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-base-content mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">health_and_safety</span>
                Service Health Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {health.services.map((service, idx) => {
                  const isHealthy = service.status === "healthy" || service.status === "ok";
                  const statusColor = isHealthy ? "text-success" : "text-error";
                  const borderColor = isHealthy ? "border-success" : "border-error";

                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 bg-base-200 ${borderColor} border`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm font-semibold text-base-content/70">{service.service}</div>
                        <span className={`material-symbols-outlined text-sm ${statusColor}`}>
                          {isHealthy ? "check_circle" : "error"}
                        </span>
                      </div>
                      <div className={`text-lg font-bold ${statusColor}`}>
                        {isHealthy ? "Active" : "Down"}
                      </div>
                      <div className="text-xs text-base-content/50 mt-2 space-y-1">
                        <div>Port: {service.port}</div>
                        <div>Response: {service.response_time_ms}ms</div>
                        <div>Checked: {new Date(service.last_check).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => logisticAgentApi.getWarehouseLayout().then(console.log)}
              className="btn btn-sm btn-primary gap-1"
              title="Fetch current warehouse layout"
            >
              <span className="material-symbols-outlined text-sm">map</span>
              Get Warehouse Layout
            </button>
            <button
              onClick={() => {
                if (warehouseId) {
                  logisticAgentApi.syncWarehouse(warehouseId).then(() => {
                    alert("Warehouse synced successfully!");
                    loadData();
                  });
                }
              }}
              disabled={!warehouseId}
              className="btn btn-sm btn-primary gap-1"
              title="Synchronize this warehouse with logistic agent"
            >
              <span className="material-symbols-outlined text-sm">sync</span>
              Sync Warehouse
            </button>
            <a
              href="http://localhost:8080/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-secondary gap-1"
              title="Open API documentation"
            >
              <span className="material-symbols-outlined text-sm">api</span>
              API Docs
            </a>
          </div>
        </>
      )}
    </div>
  );
}
