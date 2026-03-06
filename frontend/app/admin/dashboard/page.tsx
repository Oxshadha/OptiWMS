"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { useAdmin } from "@/contexts/AdminContext";
import { AIDashboardPanel } from "@/components/AIDashboardPanel";
import { AIServiceStatus } from "@/components/AIServiceStatus";
import { AI_SERVICES } from "@/lib/ai-services/registry";
import { useDashboardData } from "./useDashboardData";
import { usersApi } from "@/lib/api/users";
import { getScopedSettings } from "@/lib/user-preferences";
import { applyAppTheme } from "@/lib/theme";
import { notificationsApi, type Notification } from "@/lib/api/notifications";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#CF0F47", "#E5E7EB"];

const defaultDashboardSettings = {
  darkMode: false,
  autoRefresh: true,
  refreshInterval: "30",
  itemsPerPage: "10",
  defaultView: "grid",
  showCharts: true,
  showNotifications: true,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

function formatChartDate(date: string, locale: string, dateFormat: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  if (dateFormat === "YYYY-MM-DD") {
    return parsed.toISOString().slice(5, 10);
  }

  if (dateFormat === "DD/MM/YYYY") {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
    }).format(parsed);
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export default function DashboardPage() {
  logger.debug("[Dashboard] Component mounted");

  const { role, admin } = useAdmin();
  const [dashboardSettings, setDashboardSettings] = useState(defaultDashboardSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const topProductsLimit = Math.min(
    Math.max(Number.parseInt(dashboardSettings.itemsPerPage, 10) || 4, 1),
    10
  );

  const {
    kpis,
    ordersChart,
    topProducts,
    inventoryOverview,
    loading,
    error,
    reload,
  } = useDashboardData({ topProductsLimit });

  const isWarehouseManager = role === "warehouse_manager";
  const isInboundCoordinator = role === "inbound_coordinator";
  const isAdmin = role === "admin";
  const locale = "en-US";

  useEffect(() => {
    const loadSettings = async () => {
      if (!admin?.id) {
        setSettingsLoading(false);
        return;
      }

      try {
        setSettingsLoading(true);
        const user = await usersApi.getById(admin.id);
        if (!user.dashboardSettings) {
          setDashboardSettings(defaultDashboardSettings);
          return;
        }

        const parsed = getScopedSettings<typeof defaultDashboardSettings>(
          user.dashboardSettings,
          "adminDashboardSettings"
        );

        setDashboardSettings((prev) => ({ ...prev, ...parsed }));
      } catch (loadError) {
        logger.error("[Dashboard] Failed to load dashboard settings:", loadError);
      } finally {
        setSettingsLoading(false);
      }
    };

    void loadSettings();
  }, [admin?.id]);

  useEffect(() => {
    applyAppTheme(dashboardSettings.darkMode);
  }, [dashboardSettings.darkMode]);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!admin?.id || !dashboardSettings.showNotifications) {
        setNotifications([]);
        return;
      }

      try {
        const nextNotifications = await notificationsApi.getAll(admin.id, undefined, {
          role: role || undefined,
          warehouseId: admin.warehouseId,
        });
        setNotifications(nextNotifications.slice(0, 5));
      } catch (loadError) {
        logger.error("[Dashboard] Failed to load notifications:", loadError);
        setNotifications([]);
      }
    };

    void loadNotifications();

    if (!dashboardSettings.showNotifications) {
      return;
    }

    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [admin?.id, admin?.warehouseId, dashboardSettings.showNotifications, role]);

  useEffect(() => {
    if (settingsLoading || !dashboardSettings.autoRefresh) {
      return;
    }

    const intervalMs = Math.max(
      (Number.parseInt(dashboardSettings.refreshInterval, 10) || 30) * 1000,
      10000
    );

    const interval = setInterval(() => {
      reload();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [
    dashboardSettings.autoRefresh,
    dashboardSettings.refreshInterval,
    reload,
    settingsLoading,
  ]);

  const gridClass = useMemo(() => {
    if (dashboardSettings.defaultView === "list") {
      return "grid grid-cols-1 gap-6";
    }
    if (dashboardSettings.defaultView === "table") {
      return "grid grid-cols-1 md:grid-cols-2 gap-6";
    }
    return "grid grid-cols-1 lg:grid-cols-3 gap-6";
  }, [dashboardSettings.defaultView]);

  const ordersData = ordersChart.map((item) => ({
    day: formatChartDate(item.date, locale, dashboardSettings.dateFormat),
    value: item.count,
  }));

  const totalOrdersInPeriod = kpis?.totalOrdersThisPeriod ?? kpis?.totalTasks ?? 0;
  const completedOrdersInPeriod = kpis?.completedOrdersThisPeriod ?? kpis?.completedTasks ?? 0;
  const summaryData = kpis
    ? [
        { name: "Completed", value: completedOrdersInPeriod },
        { name: "Remaining", value: Math.max(0, totalOrdersInPeriod - completedOrdersInPeriod) },
      ]
    : [
        { name: "Completed", value: 0 },
        { name: "Remaining", value: 0 },
      ];

  const completionPercentage =
    totalOrdersInPeriod > 0
      ? Math.round((completedOrdersInPeriod / totalOrdersInPeriod) * 100)
      : 0;

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-sm text-base-content/70">Loading dashboard data...</p>
          <p className="mt-2 text-xs text-base-content/50">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (error && !kpis && !ordersChart.length && !topProducts.length && !inventoryOverview) {
    return (
      <div className="alert alert-error m-6">
        <span className="material-symbols-outlined">error</span>
        <div className="flex-1">
          <span>Error loading dashboard: {error}</span>
          <button className="btn btn-sm btn-outline ml-4" onClick={() => reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasPartialData =
    (kpis || ordersChart.length > 0 || topProducts.length > 0 || inventoryOverview) && error;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Welcome back{admin?.name ? `, ${admin.name}` : ""}! Here's what's happening today.
          </p>
        </div>
        {dashboardSettings.showNotifications && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-content/60">AI:</span>
            <AIServiceStatus serviceId={AI_SERVICES.ANOMALY_DETECTION} size="sm" />
          </div>
        )}
      </div>

      {hasPartialData && dashboardSettings.showNotifications && (
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <span>Some dashboard panels could not be refreshed completely.</span>
        </div>
      )}

      <div className={gridClass}>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Orders This Month</div>
            <span className="material-symbols-outlined text-primary">inventory_2</span>
          </div>
          <div className="text-4xl font-bold text-base-content mb-2">{kpis?.ordersThisPeriod ?? 0}</div>
          <div className="text-sm text-base-content/60">Orders processed this month</div>
          <div className="mt-4 pt-4 border-t border-base-200">
            <div className="text-sm text-base-content/60">Total: {kpis?.totalOrders ?? 0} orders</div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Order Statistics</div>
            <span className="material-symbols-outlined text-info">bar_chart</span>
          </div>
          {dashboardSettings.showCharts ? (
            <>
              <div className="text-xs text-base-content/60 mb-3">
                Orders created per day (current monthly window)
              </div>
              <div className="h-40">
                {ordersData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ordersData}>
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#CF0F47" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-base-content/60 text-sm">
                    No orders in selected period
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-base-200 rounded-lg flex justify-between">
                <span>Completed</span>
                <span className="font-semibold">{completedOrdersInPeriod}</span>
              </div>
              <div className="p-3 bg-base-200 rounded-lg flex justify-between">
                <span>Remaining</span>
                <span className="font-semibold">
                  {Math.max(0, totalOrdersInPeriod - completedOrdersInPeriod)}
                </span>
              </div>
              <div className="p-3 bg-base-200 rounded-lg flex justify-between">
                <span>Refresh</span>
                <span className="font-semibold">
                  {dashboardSettings.autoRefresh
                    ? `${dashboardSettings.refreshInterval}s`
                    : "Manual"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Order Summary</div>
          </div>
          {dashboardSettings.showCharts ? (
            <>
              <div className="h-40 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summaryData}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={70}
                      startAngle={180}
                      endAngle={0}
                      paddingAngle={2}
                    >
                      {summaryData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                  <div className="text-success font-semibold text-lg">{completionPercentage}%</div>
                </div>
              </div>
              <div className="text-center font-semibold text-lg mt-2">{totalOrdersInPeriod}</div>
              <div className="text-center text-sm text-base-content/60">Orders This Period</div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl font-bold text-base-content">{completionPercentage}%</div>
              <div className="text-sm text-base-content/60">Completion rate</div>
              <div className="p-3 bg-base-200 rounded-lg flex justify-between">
                <span>Orders This Period</span>
                <span className="font-semibold">{totalOrdersInPeriod}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={gridClass}>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-base-content">Inventory Overview</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => reload()}>
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-success mb-2 block">
                inventory_2
              </span>
              <div className="text-xs text-success font-semibold mb-1">Total Items</div>
              <div className="text-2xl font-bold text-base-content">{inventoryOverview?.totalItems ?? 0}</div>
              <div className="text-xs text-base-content/60 mt-1">
                Active: {inventoryOverview?.activeItems ?? 0}
              </div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-warning mb-2 block">
                warning
              </span>
              <div className="text-xs text-warning font-semibold mb-1">Low Stock</div>
              <div className="text-2xl font-bold text-base-content">
                {inventoryOverview?.lowStockItems ?? 0}
              </div>
              <div className="text-xs text-base-content/60 mt-1">Items below threshold</div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-error mb-2 block">
                cancel
              </span>
              <div className="text-xs text-error font-semibold mb-1">Out of Stock</div>
              <div className="text-2xl font-bold text-base-content">
                {inventoryOverview?.outOfStockItems ?? 0}
              </div>
              <div className="text-xs text-base-content/60 mt-1">Items unavailable</div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-base-content">Top Moving Products</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => reload()}>
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
          {topProducts.length > 0 ? (
            <ul className="space-y-4">
              {topProducts.map((product, index) => {
                const colorClasses = [
                  { bg: "bg-primary/10", text: "text-primary" },
                  { bg: "bg-info/10", text: "text-info" },
                  { bg: "bg-success/10", text: "text-success" },
                  { bg: "bg-warning/10", text: "text-warning" },
                ];
                const icons = ["inventory_2", "package", "shopping_cart", "category"];
                const colorClass = colorClasses[index % colorClasses.length];
                const icon = icons[index % icons.length];

                return (
                  <li
                    key={product.materialId}
                    className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${colorClass.bg} rounded-lg flex items-center justify-center`}>
                        <span className={`material-symbols-outlined ${colorClass.text}`}>{icon}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{product.materialName}</div>
                        <div className="text-xs text-base-content/60">
                          {product.materialId.substring(0, 8)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-base-content">{product.quantity}</div>
                      <div className="text-xs text-base-content/60">units</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center py-8 text-base-content/60">
              <span className="material-symbols-outlined text-4xl mb-2 block">inventory_2</span>
              <p>No product data available</p>
            </div>
          )}
        </div>
      </div>

      {dashboardSettings.showNotifications && (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-base-content">Operations Feed</h2>
              <p className="text-sm text-base-content/60">
                Latest operational updates between inventory insight cards and the AI dashboard
              </p>
            </div>
            <a href="/admin/notifications" className="btn btn-ghost btn-sm">
              View All
            </a>
          </div>
          {notifications.length === 0 ? (
            <div className="text-sm text-base-content/60">No recent notifications.</div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.actionUrl || "/admin/notifications"}
                  className={`rounded-lg border p-3 ${
                    notification.read
                      ? "border-base-300 bg-base-100"
                      : "border-primary/20 bg-primary/5"
                  } block hover:border-primary/30 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-base-content">{notification.title}</div>
                      <div className="text-sm text-base-content/70 mt-1">{notification.message}</div>
                    </div>
                    <span className="text-xs text-base-content/50 whitespace-nowrap">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {(isWarehouseManager || isInboundCoordinator || isAdmin) && (
        <div className="space-y-6">
          <div className="divider">
            <span className="text-lg font-semibold">AI Insights & Recommendations</span>
          </div>

          {isWarehouseManager && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIDashboardPanel
                serviceId={AI_SERVICES.OPTIMAL_STORAGE}
                title="Optimal Storage Suggestions"
                description="AI-recommended storage positions for incoming inventory"
              >
                <div className="text-sm text-base-content/60">
                  Storage optimization suggestions will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.OPTIMAL_PICKING_PATH}
                title="Picking Path Efficiency"
                description="Optimized picking routes and efficiency metrics"
              >
                <div className="text-sm text-base-content/60">
                  Picking path recommendations will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.DEMAND_FORECASTING}
                title="Demand Forecast (View Only)"
                description="Future demand predictions for capacity planning"
              >
                <div className="text-sm text-base-content/60">
                  Demand forecasts will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.MIN_MAX_INVENTORY}
                title="Inventory Levels (View Only)"
                description="Suggested min-max inventory levels for space planning"
              >
                <div className="text-sm text-base-content/60">
                  Inventory level suggestions will appear here when the service is available.
                </div>
              </AIDashboardPanel>
            </div>
          )}

          {isInboundCoordinator && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIDashboardPanel
                serviceId={AI_SERVICES.PROCUREMENT_AGENT}
                title="AI Procurement Recommendations"
                description="Order worthiness analysis and procurement suggestions"
              >
                <div className="space-y-4">
                  <div className="text-sm text-base-content/60">
                    Procurement recommendations will appear here when the service is available.
                  </div>
                  <div className="alert alert-info">
                    <span className="material-symbols-outlined">info</span>
                    <span className="text-sm">
                      The AI agent analyzes demand, inventory, storage capacity, and budget to
                      suggest optimal orders.
                    </span>
                  </div>
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.DEMAND_FORECASTING}
                title="Demand Forecasting"
                description="90-day demand predictions with confidence intervals"
              >
                <div className="text-sm text-base-content/60">
                  Demand forecasts will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.MIN_MAX_INVENTORY}
                title="Optimal Min-Max Inventory"
                description="Review and approve suggested inventory levels"
              >
                <div className="text-sm text-base-content/60">
                  Min-max inventory suggestions will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.ANOMALY_DETECTION}
                title="Supplier Anomalies"
                description="Price spikes, late deliveries, and quality issues"
              >
                <div className="text-sm text-base-content/60">
                  Supplier anomaly alerts will appear here when the service is available.
                </div>
              </AIDashboardPanel>
            </div>
          )}

          {isAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIDashboardPanel
                serviceId={AI_SERVICES.DEMAND_FORECASTING}
                title="Demand Forecasting Service"
                description="Configure model parameters and view forecasts"
              >
                <div className="text-sm text-base-content/60">
                  Service configuration and metrics will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.ANOMALY_DETECTION}
                title="Anomaly Detection Service"
                description="System performance anomalies and service health"
              >
                <div className="text-sm text-base-content/60">
                  System anomaly alerts will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.MIN_MAX_INVENTORY}
                title="Min-Max Inventory Service"
                description="Service configuration and performance metrics"
              >
                <div className="text-sm text-base-content/60">
                  Service metrics will appear here when the service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.OPTIMAL_STORAGE}
                title="Optimal Storage Service"
                description="Slotting rules and algorithm configuration"
              >
                <div className="text-sm text-base-content/60">
                  Service configuration will appear here when the service is available.
                </div>
              </AIDashboardPanel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
