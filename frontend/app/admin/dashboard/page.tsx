"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { useAdmin } from "@/contexts/AdminContext";
import { useDashboardData } from "./useDashboardData";
import type { AnalyticsPeriod } from "@/lib/api/analytics";
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

const periodOptions: Array<{ value: AnalyticsPeriod; label: string; description: string }> = [
  { value: "current_month", label: "Current month", description: "Orders dated in this calendar month" },
  { value: "last_90_days", label: "Last 90 days", description: "Recent operational window" },
  { value: "all", label: "All available data", description: "All stored demo and operational history" },
];

function formatPeriodRange(chart: { date: string }[]) {
  if (!chart.length) {
    return "No stored order history";
  }
  const sorted = [...chart].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(sorted[0].date);
  const end = new Date(sorted[sorted.length - 1].date);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
  return `${fmt.format(start)}-${fmt.format(end)}`;
}

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
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>("all");

  const topProductsLimit = Math.min(
    Math.max(Number.parseInt(dashboardSettings.itemsPerPage, 10) || 4, 1),
    10
  );

  const {
    kpis,
    ordersChart,
    topProducts,
    inventoryOverview,
    allOrdersChart,
    loading,
    isRefreshing,
    error,
    reload,
  } = useDashboardData({ topProductsLimit, period: selectedPeriod });

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

  const selectedPeriodLabel =
    periodOptions.find((option) => option.value === selectedPeriod)?.label ?? "Selected period";
  const availableOrderRange = formatPeriodRange(allOrdersChart);
  const hasOlderDataButNoCurrentActivity =
    selectedPeriod === "current_month" &&
    (kpis?.ordersThisPeriod ?? 0) === 0 &&
    allOrdersChart.length > 0;

  const operationalInsights = useMemo(() => {
    const insights = [];
    if (hasOlderDataButNoCurrentActivity) {
      insights.push({
        icon: "calendar_month",
        title: "No current-month order activity",
        message: `Stored order history exists for ${availableOrderRange}. Switch the period to review it.`,
        href: "/admin/dashboard",
        action: "Change period",
      });
    }
    if ((inventoryOverview?.lowStockItems ?? 0) > 0 || (inventoryOverview?.outOfStockItems ?? 0) > 0) {
      insights.push({
        icon: "warning",
        title: "Stock exceptions need review",
        message: `${inventoryOverview?.lowStockItems ?? 0} low-stock and ${inventoryOverview?.outOfStockItems ?? 0} out-of-stock materials.`,
        href: "/admin/inventory",
        action: "Open inventory",
      });
    }
    if (topProducts.length === 0) {
      insights.push({
        icon: "inventory_2",
        title: "No product movement in period",
        message: "Top movers are based on completed outbound orders in the selected period.",
        href: "/admin/orders/outbound",
        action: "Review outbound",
      });
    }
    if (isAdmin) {
      insights.push({
        icon: "rule_settings",
        title: "Data quality checks",
        message: "Review zero-item shells, missing references, supplier purchasing rules, and stale data.",
        href: "/admin/data-quality",
        action: "Open data quality",
      });
    }
    insights.push({
      icon: "psychology",
      title: "AI service health moved",
      message: "Forecasting and solver health belong in Intelligent Engine, away from the daily dashboard.",
      href: "/admin/replenishment",
      action: "Open engine",
    });
    return insights.slice(0, 4);
  }, [
    availableOrderRange,
    hasOlderDataButNoCurrentActivity,
    inventoryOverview?.lowStockItems,
    inventoryOverview?.outOfStockItems,
    isAdmin,
    topProducts.length,
  ]);

  if (loading) {
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
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-3 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-primary">
              Core Metrics
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-base-content tracking-tight pb-1">Dashboard</h1>
          <p className="text-sm text-base-content/60 mt-1 font-medium">
            Welcome back{admin?.name ? `, ${admin.name}` : ""}! Here is what is happening today.
          </p>
        </div>
        <label className="form-control w-full md:w-64">
          <span className="label-text text-xs text-base-content/60 font-medium">Dashboard period</span>
          <select
            className="select select-bordered select-sm rounded-full"
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value as AnalyticsPeriod)}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {(isRefreshing || settingsLoading) && (
          <div className="flex items-center gap-2 text-xs text-base-content/60">
            <span className="loading loading-spinner loading-xs"></span>
            <span>{isRefreshing ? "Refreshing data..." : "Loading preferences..."}</span>
          </div>
        )}
      </div>

      {hasPartialData && dashboardSettings.showNotifications && (
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <span>Some dashboard panels could not be refreshed completely.</span>
        </div>
      )}

      {hasOlderDataButNoCurrentActivity && (
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <div>
            <div className="font-semibold">No activity in current month.</div>
            <div className="text-sm">
              Latest stored order data: {availableOrderRange}. Use Last 90 days or All available data to inspect older activity.
            </div>
          </div>
        </div>
      )}

      <div className={gridClass}>
        <div className="card bg-base-100 shadow-sm border-none rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Orders in {selectedPeriodLabel}</div>
            <span className="material-symbols-outlined text-primary">inventory_2</span>
          </div>
          <div className="text-4xl font-bold text-base-content mb-2">{kpis?.ordersThisPeriod ?? 0}</div>
          <div className="text-sm text-base-content/60">
            {periodOptions.find((option) => option.value === selectedPeriod)?.description}
          </div>
          <div className="mt-4 pt-4 border-t border-base-200">
            <div className="text-sm text-base-content/60">Total: {kpis?.totalOrders ?? 0} orders</div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border-none rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Order Statistics</div>
            <span className="material-symbols-outlined text-info">bar_chart</span>
          </div>
          {dashboardSettings.showCharts ? (
            <>
              <div className="text-xs text-base-content/60 mb-3">
                Orders created per day ({selectedPeriodLabel.toLowerCase()})
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

        <div className="card bg-base-100 shadow-sm border-none rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300">
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
              <div className="text-center text-sm text-base-content/60">Orders in {selectedPeriodLabel}</div>
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
        <div className="card bg-base-100 shadow-sm border-none rounded-2xl p-6 lg:col-span-2">
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

        <div className="card bg-base-100 shadow-sm border-none rounded-2xl p-6">
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
        <div className="card bg-base-100 shadow-sm border-none rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-base-content">Recent Operations</h2>
              <p className="text-sm text-base-content/60">
                Latest notifications and operational status changes
              </p>
            </div>
            <Link href="/admin/notifications" className="btn btn-ghost btn-sm">
              View notifications
            </Link>
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

      <div className="space-y-4">
        <div className="divider">
          <span className="text-lg font-semibold">Operational Insights</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {operationalInsights.map((insight) => (
            <Link
              key={insight.title}
              href={insight.href}
              className="card bg-base-100 shadow-sm border-none rounded-2xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">{insight.icon}</span>
                <div className="min-w-0">
                  <h3 className="font-bold text-base-content">{insight.title}</h3>
                  <p className="text-sm text-base-content/65 mt-1">{insight.message}</p>
                  <div className="text-sm font-semibold text-primary mt-3">{insight.action}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
