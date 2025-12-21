"use client";
import { KpiTile } from "@/components/KpiTile";
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
} from "recharts";

const ordersData = [
  { day: "25", value: 42 },
  { day: "26", value: 55 },
  { day: "27", value: 48 },
  { day: "28", value: 60 },
  { day: "29", value: 50 },
  { day: "30", value: 44 },
];

const summaryData = [
  { name: "Completed", value: 72 },
  { name: "Remaining", value: 28 },
];

const COLORS = ["#CF0F47", "#E5E7EB"];

export default function DashboardPage() {
  const { role, admin } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const isProcurementManager = role === "procurement_manager";
  const isAdmin = role === "admin";

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
        {/* AI Services Status Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/60">AI Services:</span>
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
          <div className="text-4xl font-bold text-base-content mb-2">156</div>
          <div className="text-sm text-base-content/60">
            Orders processed this month
          </div>
          <div className="mt-4 pt-4 border-t border-base-200">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-success font-semibold">+12.5%</span>
              <span className="text-base-content/60">vs last month</span>
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
              <div className="text-success font-semibold text-lg">42%</div>
            </div>
          </div>
          <div className="text-center font-semibold text-lg mt-2">156</div>
          <div className="text-center text-sm text-base-content/60">
            Orders Completed
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
                26% ↑
              </div>
              <div className="text-2xl font-bold text-base-content">4,236</div>
              <div className="text-xs text-base-content/60 mt-1">
                Orders Received
              </div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-error mb-2 block">
                local_shipping
              </span>
              <div className="text-xs text-error font-semibold mb-1">20% ↓</div>
              <div className="text-2xl font-bold text-base-content">2,778</div>
              <div className="text-xs text-base-content/60 mt-1">
                Orders Shipped
              </div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-warning mb-2 block">
                assignment_return
              </span>
              <div className="text-xs text-error font-semibold mb-1">8% ↓</div>
              <div className="text-2xl font-bold text-base-content">147</div>
              <div className="text-xs text-base-content/60 mt-1">
                Orders Returned
              </div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-warning mb-2 block">
                cancel
              </span>
              <div className="text-xs text-success font-semibold mb-1">
                6% ↑
              </div>
              <div className="text-2xl font-bold text-base-content">537</div>
              <div className="text-xs text-base-content/60 mt-1">
                Orders Canceled
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
          <ul className="space-y-4">
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">
                    headphones
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Wireless Earbuds</div>
                  <div className="text-xs text-base-content/60">SKU-1001</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">240</div>
                <div className="text-xs text-base-content/60">units sold</div>
              </div>
            </li>
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-info">
                    tv
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Smart Projector</div>
                  <div className="text-xs text-base-content/60">SKU-1002</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">198</div>
                <div className="text-xs text-base-content/60">units sold</div>
              </div>
            </li>
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-success">
                    coffee
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Smart Mug</div>
                  <div className="text-xs text-base-content/60">SKU-1003</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">156</div>
                <div className="text-xs text-base-content/60">units sold</div>
              </div>
            </li>
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-warning">
                    cooking
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Instant Pot</div>
                  <div className="text-xs text-base-content/60">SKU-1004</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">142</div>
                <div className="text-xs text-base-content/60">units sold</div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* AI Services Section - Role-Based Visibility */}
      {(isWarehouseManager || isProcurementManager || isAdmin) && (
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
