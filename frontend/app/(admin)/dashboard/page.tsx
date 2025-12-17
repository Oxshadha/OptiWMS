"use client";
import { KpiTile } from "@/components/KpiTile";
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
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
        <p className="text-sm text-base-content/60 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Orders This Month</div>
            <span className="material-symbols-outlined text-primary">inventory_2</span>
          </div>
          <div className="text-4xl font-bold text-base-content mb-2">$6,357</div>
          <div className="text-sm text-base-content/60">58% Prepaid • 42% CoD</div>
          <div className="mt-4 pt-4 border-t border-base-200">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-success font-semibold">+12.5%</span>
              <span className="text-base-content/60">vs last month</span>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Order Statistics</div>
            <span className="material-symbols-outlined text-info">bar_chart</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersData}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px' 
                  }} 
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#CF0F47" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-base-content/70 font-medium">Order Summary</div>
            <span className="text-success font-semibold">42%</span>
          </div>
          <div className="h-40 flex items-center justify-center">
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center font-semibold text-lg mt-2">$5,961</div>
          <div className="text-center text-sm text-base-content/60">Orders Completed</div>
        </div>
      </div>

      {/* Inventory Overview and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-base-content">Inventory Overview</h3>
            <button className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-success mb-2 block">inventory_2</span>
              <div className="text-xs text-success font-semibold mb-1">26% ↑</div>
              <div className="text-2xl font-bold text-base-content">4,236</div>
              <div className="text-xs text-base-content/60 mt-1">Orders Received</div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-error mb-2 block">local_shipping</span>
              <div className="text-xs text-error font-semibold mb-1">20% ↓</div>
              <div className="text-2xl font-bold text-base-content">2,778</div>
              <div className="text-xs text-base-content/60 mt-1">Orders Shipped</div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-warning mb-2 block">assignment_return</span>
              <div className="text-xs text-error font-semibold mb-1">8% ↓</div>
              <div className="text-2xl font-bold text-base-content">147</div>
              <div className="text-xs text-base-content/60 mt-1">Orders Returned</div>
            </div>
            <div className="text-center p-4 bg-base-200 rounded-lg">
              <span className="material-symbols-outlined text-3xl text-warning mb-2 block">cancel</span>
              <div className="text-xs text-success font-semibold mb-1">6% ↑</div>
              <div className="text-2xl font-bold text-base-content">537</div>
              <div className="text-xs text-base-content/60 mt-1">Orders Canceled</div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-base-content">Top Selling Products</h3>
            <button className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <ul className="space-y-4">
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">headphones</span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Wireless Earbuds</div>
                  <div className="text-xs text-base-content/60">SKU-1001</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">$126</div>
                <div className="text-xs text-base-content/60">240 sold</div>
              </div>
            </li>
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-info">tv</span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Smart Projector</div>
                  <div className="text-xs text-base-content/60">SKU-1002</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">$170</div>
                <div className="text-xs text-base-content/60">56 sold</div>
              </div>
            </li>
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-success">coffee</span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Smart Mug</div>
                  <div className="text-xs text-base-content/60">SKU-1003</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">$424</div>
                <div className="text-xs text-base-content/60">18 sold</div>
              </div>
            </li>
            <li className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-warning">cooking</span>
                </div>
                <div>
                  <div className="font-semibold text-sm">Instant Pot</div>
                  <div className="text-xs text-base-content/60">SKU-1004</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base-content">$398</div>
                <div className="text-xs text-base-content/60">90 sold</div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:border-primary transition-colors text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">add_circle</span>
            </div>
            <div>
              <div className="font-semibold text-base-content">Create Order</div>
              <div className="text-xs text-base-content/60">New sales order</div>
            </div>
          </div>
        </button>
        <button className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:border-primary transition-colors text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-info text-2xl">inventory</span>
            </div>
            <div>
              <div className="font-semibold text-base-content">Add Inventory</div>
              <div className="text-xs text-base-content/60">Stock addition</div>
            </div>
          </div>
        </button>
        <button className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:border-primary transition-colors text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-success text-2xl">local_shipping</span>
            </div>
            <div>
              <div className="font-semibold text-base-content">New Shipment</div>
              <div className="text-xs text-base-content/60">Create shipment</div>
            </div>
          </div>
        </button>
        <button className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:border-primary transition-colors text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-warning text-2xl">description</span>
            </div>
            <div>
              <div className="font-semibold text-base-content">Generate Report</div>
              <div className="text-xs text-base-content/60">View reports</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
