"use client";

import { useState } from "react";
import Link from "next/link";

const reports = [
  {
    id: 1,
    name: "Daily Inbound",
    desc: "Receipts, putaway, QC",
    size: "180 KB",
    type: "Inbound",
    lastGenerated: "2025-12-15 10:30 AM",
    icon: "download",
  },
  {
    id: 2,
    name: "Daily Outbound",
    desc: "Orders, picks, shipments",
    size: "220 KB",
    type: "Outbound",
    lastGenerated: "2025-12-15 11:15 AM",
    icon: "upload",
  },
  {
    id: 3,
    name: "Inventory Snapshot",
    desc: "Stock by location and SKU",
    size: "310 KB",
    type: "Inventory",
    lastGenerated: "2025-12-15 09:00 AM",
    icon: "inventory",
  },
  {
    id: 4,
    name: "Sales Report",
    desc: "Revenue, orders, customers",
    size: "450 KB",
    type: "Sales",
    lastGenerated: "2025-12-14 05:00 PM",
    icon: "payments",
  },
  {
    id: 5,
    name: "Warehouse Utilization",
    desc: "Space usage and efficiency",
    size: "125 KB",
    type: "Analytics",
    lastGenerated: "2025-12-15 08:00 AM",
    icon: "warehouse",
  },
  {
    id: 6,
    name: "Customer Activity",
    desc: "Orders, returns, engagement",
    size: "280 KB",
    type: "Customer",
    lastGenerated: "2025-12-14 04:30 PM",
    icon: "group",
  },
];

const reportTypes = [
  "All",
  "Inbound",
  "Outbound",
  "Inventory",
  "Sales",
  "Analytics",
  "Customer",
];

export default function ReportsPage() {
  const [activeType, setActiveType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReports = reports.filter((r) => {
    const matchesType = activeType === "All" || r.type === activeType;
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">
          Reports ({reports.length})
        </h1>
        <div className="flex gap-3">
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">schedule</span>
            <span>Schedule Report</span>
          </button>
          <Link href="/admin/reports/custom" className="btn btn-sm btn-primary">
            <span className="material-symbols-outlined">add</span>
            <span>Create Custom Report</span>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="material-symbols-outlined text-base-content/60">
              search
            </span>
            <input
              type="text"
              className="grow"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
          {reportTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                activeType === type
                  ? "bg-neutral text-neutral-content font-medium"
                  : "text-base-content/60 hover:text-base-content"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((r) => (
          <div
            key={r.id}
            className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">
                  {r.icon}
                </span>
              </div>
              <span className="badge badge-outline">{r.type}</span>
            </div>
            <h3 className="text-lg font-bold text-base-content mb-2">
              {r.name}
            </h3>
            <p className="text-sm text-base-content/60 mb-4">{r.desc}</p>
            <div className="flex items-center justify-between pt-4 border-t border-base-200">
              <div className="text-xs text-base-content/50">
                <div>Size: {r.size}</div>
                <div>Last: {r.lastGenerated}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" title="Preview">
                  <span className="material-symbols-outlined">visibility</span>
                </button>
                <button className="btn btn-primary btn-sm">
                  <span className="material-symbols-outlined">download</span>
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">
            description
          </span>
          <h3 className="text-lg font-semibold text-base-content mb-2">
            No reports found
          </h3>
          <p className="text-sm text-base-content/60">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}
