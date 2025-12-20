"use client";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { AIDashboardPanel } from "@/components/AIDashboardPanel";
import { AIServiceStatus } from "@/components/AIServiceStatus";
import { AI_SERVICES } from "@/lib/ai-services/registry";
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
  Legend,
} from "recharts";

const ordersData = [
  { day: "Mon", value: 42 },
  { day: "Tue", value: 55 },
  { day: "Wed", value: 48 },
  { day: "Thu", value: 60 },
  { day: "Fri", value: 50 },
  { day: "Sat", value: 44 },
  { day: "Sun", value: 38 },
];

const summaryData = [
  { name: "Completed", value: 72, color: "#CF0F47" },
  { name: "Pending", value: 18, color: "#F59E0B" },
  { name: "Processing", value: 10, color: "#3B82F6" },
];

const inventoryTrendData = [
  { month: "Jan", received: 4200, shipped: 2800 },
  { month: "Feb", received: 4500, shipped: 3000 },
  { month: "Mar", received: 4800, shipped: 3200 },
  { month: "Apr", received: 4100, shipped: 2900 },
  { month: "May", received: 4600, shipped: 3100 },
  { month: "Jun", received: 4400, shipped: 3000 },
];

const topProducts = [
  {
    name: "Wireless Earbuds",
    sku: "SKU-1001",
    icon: "headphones",
    color: "primary",
    units: 240,
    trend: "+12%",
  },
  {
    name: "Smart Projector",
    sku: "SKU-1002",
    icon: "tv",
    color: "info",
    units: 198,
    trend: "+8%",
  },
  {
    name: "Smart Mug",
    sku: "SKU-1003",
    icon: "coffee",
    color: "success",
    units: 156,
    trend: "+15%",
  },
  {
    name: "Instant Pot",
    sku: "SKU-1004",
    icon: "cooking",
    color: "warning",
    units: 142,
    trend: "+5%",
  },
];

export default function DashboardPage() {
  const { role, admin } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const isProcurementManager = role === "procurement_manager";
  const isAdmin = role === "admin";

  const kpiCards = [
    {
      label: "Total Orders",
      value: "156",
      icon: "inventory_2",
      color: "primary" as const,
    },
    {
      label: "Orders This Week",
      value: "89",
      icon: "trending_up",
      color: "success" as const,
    },
    {
      label: "Pending Tasks",
      value: "23",
      icon: "pending_actions",
      color: "warning" as const,
    },
    {
      label: "Anomalies",
      value: "4",
      icon: "warning",
      color: "error" as const,
    },
  ];

  const inventoryCards = [
    {
      label: "Orders Received",
      value: "4,236",
      icon: "inventory_2",
      color: "success" as const,
    },
    {
      label: "Orders Shipped",
      value: "2,778",
      icon: "local_shipping",
      color: "info" as const,
    },
    {
      label: "Orders Returned",
      value: "147",
      icon: "assignment_return",
      color: "warning" as const,
    },
    {
      label: "Orders Canceled",
      value: "537",
      icon: "cancel",
      color: "error" as const,
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-base-content">Dashboard</h1>
          <p className="text-base text-base-content/70 mt-2">
            Welcome back{admin?.name ? `, ${admin.name}` : ""}! Here's what's
            happening today.
          </p>
        </div>
        {/* AI Services Status Indicator */}
        <div className="flex items-center gap-3 px-4 py-2 bg-base-200 rounded-lg">
          <span className="text-sm font-medium text-base-content/70">
            AI Services:
          </span>
          <div className="flex items-center gap-2">
            <AIServiceStatus
              serviceId={AI_SERVICES.DEMAND_FORECASTING}
              size="sm"
            />
            <AIServiceStatus
              serviceId={AI_SERVICES.ANOMALY_DETECTION}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div>
        <h2 className="text-xl font-semibold text-base-content mb-4">
          Key Performance Indicators
        </h2>
        <SummaryCards cards={kpiCards} columns={4} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Chart */}
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-base-content">
                Weekly Orders
              </h3>
              <p className="text-sm text-base-content/60 mt-1">
                Orders processed this week
              </p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">
                bar_chart
              </span>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[8, 8, 0, 0]}
                  fill="#CF0F47"
                  opacity={0.9}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Pie Chart */}
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-base-content">
                Order Status
              </h3>
              <p className="text-sm text-base-content/60 mt-1">
                Current order distribution
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-success text-xl">
                pie_chart
              </span>
            </div>
          </div>
          <div className="h-48 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summaryData}
                  dataKey="value"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  startAngle={90}
                  endAngle={-270}
                >
                  {summaryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
              <div className="text-2xl font-bold text-base-content">156</div>
              <div className="text-xs text-base-content/60">Total Orders</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-base-200">
            <div className="flex justify-around text-xs">
              {summaryData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-base-content/70">{item.name}</span>
                  <span className="font-semibold text-base-content">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory Trend */}
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-base-content">
                Inventory Trend
              </h3>
              <p className="text-sm text-base-content/60 mt-1">
                Last 6 months overview
              </p>
            </div>
            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-info text-xl">
                trending_up
              </span>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inventoryTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                <Line
                  type="monotone"
                  dataKey="received"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Received"
                />
                <Line
                  type="monotone"
                  dataKey="shipped"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Shipped"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Inventory Overview and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Overview */}
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-base-content">
                Inventory Overview
              </h3>
              <p className="text-sm text-base-content/60 mt-1">
                Key inventory metrics at a glance
              </p>
            </div>
            <button className="btn btn-ghost btn-sm btn-circle">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <SummaryCards cards={inventoryCards} columns={4} />
        </div>

        {/* Top Selling Products */}
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-base-content">
                Top Products
              </h3>
              <p className="text-sm text-base-content/60 mt-1">
                Best selling items this month
              </p>
            </div>
            <button className="btn btn-ghost btn-sm btn-circle">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <ul className="space-y-3">
            {topProducts.map((product, index) => {
              const colorClasses: Record<string, { bg: string; text: string }> = {
                primary: { bg: "bg-primary/10", text: "text-primary" },
                info: { bg: "bg-info/10", text: "text-info" },
                success: { bg: "bg-success/10", text: "text-success" },
                warning: { bg: "bg-warning/10", text: "text-warning" },
              };
              const colors = colorClasses[product.color] || colorClasses.primary;

              return (
                <li
                  key={index}
                  className="flex items-center justify-between p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <span
                        className={`material-symbols-outlined ${colors.text} text-xl`}
                      >
                        {product.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-base-content truncate">
                        {product.name}
                      </div>
                      <div className="text-xs text-base-content/60">
                        {product.sku}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-bold text-base-content">
                      {product.units}
                    </div>
                    <div className="text-xs text-success font-medium">
                      {product.trend}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* AI Services Section - Role-Based Visibility */}
      {(isWarehouseManager || isProcurementManager || isAdmin) && (
        <div className="space-y-6">
          <div className="divider">
            <span className="text-xl font-semibold text-base-content">
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

          {/* Procurement Manager AI Panels */}
          {isProcurementManager && (
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


