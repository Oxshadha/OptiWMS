"use client";
import { useState, useEffect } from "react";
import { KpiTile } from "@/components/KpiTile";
import { useAdmin } from "@/contexts/AdminContext";
import { AIDashboardPanel } from "@/components/AIDashboardPanel";
import { AIServiceStatus } from "@/components/AIServiceStatus";
import { AI_SERVICES } from "@/lib/ai-services/registry";
import { analyticsApi, DashboardKPIs, OrderChartData, TopProduct, InventoryOverview } from "@/lib/api/analytics";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  YAxis,
  CartesianGrid,
} from "recharts";

const COLORS = ["#CF0F47", "#E5E7EB"];

export default function DashboardPage() {
  console.log("[Dashboard] Component mounted");
  
  const { role, admin } = useAdmin();
  console.log("[Dashboard] Admin context:", { role, hasAdmin: !!admin });
  
  const isWarehouseManager = role === "warehouse_manager";
  const isInboundCoordinator = role === "inbound_coordinator";
  const isAdmin = role === "admin";

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [ordersChart, setOrdersChart] = useState<OrderChartData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [inventoryOverview, setInventoryOverview] = useState<InventoryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log("[Dashboard] Initial state:", { loading, error, hasToken: !!localStorage.getItem('accessToken') });

  useEffect(() => {
    const fetchDashboardData = async () => {
      console.log("[Dashboard] Starting data fetch...");
      
      // Wait a bit for auth token to be available
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if we have a token
      const token = localStorage.getItem('accessToken');
      console.log("[Dashboard] Token check:", token ? "Found" : "Not found");
      
      if (!token) {
        console.error("[Dashboard] No token found, redirecting to login");
        setError("Not authenticated. Please login.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log("[Dashboard] Fetching dashboard data...");

        // Add timeout to prevent hanging
        const fetchWithTimeout = async <T,>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
          const timeout = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
          );
          return Promise.race([promise, timeout]);
        };

        // Fetch all dashboard data in parallel with timeout
        console.log("[Dashboard] Calling analytics APIs...");
        const [kpisData, ordersChartData, topProductsData, inventoryData] = await Promise.all([
          fetchWithTimeout(analyticsApi.getDashboardKPIs(undefined, "monthly")).catch(err => {
            console.error("[Dashboard] KPIs fetch error:", err);
            return null;
          }),
          fetchWithTimeout(analyticsApi.getOrdersChart("daily")).catch(err => {
            console.error("[Dashboard] Orders chart fetch error:", err);
            return [];
          }),
          fetchWithTimeout(analyticsApi.getTopProducts(4)).catch(err => {
            console.error("[Dashboard] Top products fetch error:", err);
            return [];
          }),
          fetchWithTimeout(analyticsApi.getInventoryOverview()).catch(err => {
            console.error("[Dashboard] Inventory overview fetch error:", err);
            return null;
          }),
        ]);

        console.log("[Dashboard] Data fetched:", {
          kpis: !!kpisData,
          ordersChart: ordersChartData.length,
          topProducts: topProductsData.length,
          inventory: !!inventoryData,
        });

        setKpis(kpisData);
        setOrdersChart(ordersChartData);
        setTopProducts(topProductsData);
        setInventoryOverview(inventoryData);
        
        console.log("[Dashboard] State updated successfully");
      } catch (err) {
        console.error("[Dashboard] Failed to fetch dashboard data:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load dashboard data";
        setError(errorMessage);
        
        // If it's an authentication error, redirect to login
        if (errorMessage.includes('Not authenticated') || errorMessage.includes('Session expired')) {
          console.error("[Dashboard] Authentication error, redirecting to login");
          window.location.href = '/admin/login';
          return;
        }
      } finally {
        console.log("[Dashboard] Setting loading to false");
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Timeout fallback to prevent infinite loading
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn("[Dashboard] Loading timeout after 15s - clearing loading state");
        setLoading(false);
        if (!kpis && !ordersChart.length && !topProducts.length && !inventoryOverview) {
          setError("Dashboard data failed to load. Please check your connection and try again.");
        }
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [loading, kpis, ordersChart, topProducts, inventoryOverview]);

  // Transform orders chart data for display
  const ordersData = ordersChart.map(item => ({
    day: new Date(item.date).getDate().toString(),
    value: item.count,
  }));

  // Calculate summary data from KPIs
  const summaryData = kpis
    ? [
        { name: "Completed", value: kpis.completedTasks },
        { name: "Remaining", value: kpis.totalTasks - kpis.completedTasks },
      ]
    : [
        { name: "Completed", value: 0 },
        { name: "Remaining", value: 0 },
      ];

  const completionPercentage = kpis && kpis.totalTasks > 0
    ? Math.round((kpis.completedTasks / kpis.totalTasks) * 100)
    : 0;

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

  // Show error only if we have no data at all (allow partial data display)
  if (error && !kpis && !ordersChart.length && !topProducts.length && !inventoryOverview) {
    return (
      <div className="alert alert-error m-6">
        <span className="material-symbols-outlined">error</span>
        <div className="flex-1">
          <span>Error loading dashboard: {error}</span>
          <button 
            className="btn btn-sm btn-outline ml-4"
            onClick={() => {
              setLoading(true);
              setError(null);
              window.location.reload();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // Show warning if we have partial data
  const hasPartialData = (kpis || ordersChart.length > 0 || topProducts.length > 0 || inventoryOverview) && error;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Welcome back{admin?.name ? `, ${admin.name}` : ""}! Here's what's
            happening today.
          </p>
        </div>
        {/* AI Services Status Indicator - Single functional indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/60">AI:</span>
          <AIServiceStatus
            serviceId={AI_SERVICES.ANOMALY_DETECTION}
            size="sm"
          />
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">
              Orders This Month
            </div>
            <span className="material-symbols-outlined text-primary">
              inventory_2
            </span>
          </div>
          <div className="text-4xl font-bold text-base-content mb-2">
            {kpis?.ordersThisPeriod ?? 0}
          </div>
          <div className="text-sm text-base-content/60">
            Orders processed this month
          </div>
          <div className="mt-4 pt-4 border-t border-base-200">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base-content/60">
                Total: {kpis?.totalOrders ?? 0} orders
              </span>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">
              Order Statistics
            </div>
            <span className="material-symbols-outlined text-info">
              bar_chart
            </span>
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
                No order data available
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">
              Order Summary
            </div>
          </div>
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
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="text-success font-semibold text-lg">{completionPercentage}%</div>
            </div>
          </div>
          <div className="text-center font-semibold text-lg mt-2">{kpis?.totalTasks ?? 0}</div>
          <div className="text-center text-sm text-base-content/60">
            Tasks Total
          </div>
        </div>
      </div>

      {/* Inventory Overview and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-base-content">
              Inventory Overview
            </h3>
            <button className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-success mb-2 block">
                inventory_2
              </span>
              <div className="text-xs text-success font-semibold mb-1">
                Total Items
              </div>
              <div className="text-2xl font-bold text-base-content">
                {inventoryOverview?.totalItems ?? 0}
              </div>
              <div className="text-xs text-base-content/60 mt-1">
                Active: {inventoryOverview?.activeItems ?? 0}
              </div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-warning mb-2 block">
                warning
              </span>
              <div className="text-xs text-warning font-semibold mb-1">
                Low Stock
              </div>
              <div className="text-2xl font-bold text-base-content">
                {inventoryOverview?.lowStockItems ?? 0}
              </div>
              <div className="text-xs text-base-content/60 mt-1">
                Items below threshold
              </div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-error mb-2 block">
                cancel
              </span>
              <div className="text-xs text-error font-semibold mb-1">
                Out of Stock
              </div>
              <div className="text-2xl font-bold text-base-content">
                {inventoryOverview?.outOfStockItems ?? 0}
              </div>
              <div className="text-xs text-base-content/60 mt-1">
                Items unavailable
              </div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-info mb-2 block">
                attach_money
              </span>
              <div className="text-xs text-info font-semibold mb-1">
                Total Value
              </div>
              <div className="text-2xl font-bold text-base-content">
                ${(inventoryOverview?.totalValue ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-base-content/60 mt-1">
                Inventory value
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-base-content">
              Top Selling Products
            </h3>
            <button className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">more_vert</span>
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
                  <li key={product.materialId} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${colorClass.bg} rounded-lg flex items-center justify-center`}>
                        <span className={`material-symbols-outlined ${colorClass.text}`}>
                          {icon}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{product.materialName}</div>
                        <div className="text-xs text-base-content/60">{product.materialId.substring(0, 8)}</div>
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

      {/* AI Services Section - Role-Based Visibility */}
      {(isWarehouseManager || isInboundCoordinator || isAdmin) && (
        <div className="space-y-6">
          <div className="divider">
            <span className="text-lg font-semibold">
              AI Insights & Recommendations
            </span>
          </div>

          {/* Warehouse Manager AI Panels */}
          {isWarehouseManager && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIDashboardPanel
                serviceId={AI_SERVICES.OPTIMAL_STORAGE}
                title="Optimal Storage Suggestions"
                description="AI-recommended storage positions for incoming inventory"
              >
                <div className="text-sm text-base-content/60">
                  Storage optimization suggestions will appear here when the
                  service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.OPTIMAL_PICKING_PATH}
                title="Picking Path Efficiency"
                description="Optimized picking routes and efficiency metrics"
              >
                <div className="text-sm text-base-content/60">
                  Picking path recommendations will appear here when the service
                  is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.DEMAND_FORECASTING}
                title="Demand Forecast (View Only)"
                description="Future demand predictions for capacity planning"
              >
                <div className="text-sm text-base-content/60">
                  Demand forecasts will appear here when the service is
                  available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.MIN_MAX_INVENTORY}
                title="Inventory Levels (View Only)"
                description="Suggested min-max inventory levels for space planning"
              >
                <div className="text-sm text-base-content/60">
                  Inventory level suggestions will appear here when the service
                  is available.
                </div>
              </AIDashboardPanel>
            </div>
          )}

          {/* Inbound Coordinator AI Panels */}
          {isInboundCoordinator && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIDashboardPanel
                serviceId={AI_SERVICES.PROCUREMENT_AGENT}
                title="AI Procurement Recommendations"
                description="Order worthiness analysis and procurement suggestions"
              >
                <div className="space-y-4">
                  <div className="text-sm text-base-content/60">
                    Procurement recommendations will appear here when the
                    service is available.
                  </div>
                  <div className="alert alert-info">
                    <span className="material-symbols-outlined">info</span>
                    <span className="text-sm">
                      The AI agent analyzes demand, inventory, storage capacity,
                      and budget to suggest optimal orders.
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
                  Demand forecasts will appear here when the service is
                  available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.MIN_MAX_INVENTORY}
                title="Optimal Min-Max Inventory"
                description="Review and approve suggested inventory levels"
              >
                <div className="text-sm text-base-content/60">
                  Min-max inventory suggestions will appear here when the
                  service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.ANOMALY_DETECTION}
                title="Supplier Anomalies"
                description="Price spikes, late deliveries, and quality issues"
              >
                <div className="text-sm text-base-content/60">
                  Supplier anomaly alerts will appear here when the service is
                  available.
                </div>
              </AIDashboardPanel>
            </div>
          )}

          {/* Admin AI Panels - All Services */}
          {isAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIDashboardPanel
                serviceId={AI_SERVICES.DEMAND_FORECASTING}
                title="Demand Forecasting Service"
                description="Configure model parameters and view forecasts"
              >
                <div className="text-sm text-base-content/60">
                  Service configuration and metrics will appear here when the
                  service is available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.ANOMALY_DETECTION}
                title="Anomaly Detection Service"
                description="System performance anomalies and service health"
              >
                <div className="text-sm text-base-content/60">
                  System anomaly alerts will appear here when the service is
                  available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.MIN_MAX_INVENTORY}
                title="Min-Max Inventory Service"
                description="Service configuration and performance metrics"
              >
                <div className="text-sm text-base-content/60">
                  Service metrics will appear here when the service is
                  available.
                </div>
              </AIDashboardPanel>

              <AIDashboardPanel
                serviceId={AI_SERVICES.OPTIMAL_STORAGE}
                title="Optimal Storage Service"
                description="Slotting rules and algorithm configuration"
              >
                <div className="text-sm text-base-content/60">
                  Service configuration will appear here when the service is
                  available.
                </div>
              </AIDashboardPanel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
