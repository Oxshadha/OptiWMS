"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";

const orders = [
  {
    id: "SO-1001",
    customer: "Acme Corp",
    status: "Pending",
    total: "$426",
    date: "2025-12-15",
    items: 12,
  },
  {
    id: "SO-1002",
    customer: "Bright Retail",
    status: "Shipped",
    total: "$1,210",
    date: "2025-12-14",
    items: 8,
  },
  {
    id: "SO-1003",
    customer: "Delta Mart",
    status: "Allocated",
    total: "$980",
    date: "2025-12-14",
    items: 15,
  },
  {
    id: "SO-1004",
    customer: "Echo Stores",
    status: "Delivered",
    total: "$315",
    date: "2025-12-13",
    items: 5,
  },
  {
    id: "SO-1005",
    customer: "Falcon Inc",
    status: "Pending",
    total: "$750",
    date: "2025-12-15",
    items: 9,
  },
  {
    id: "SO-1006",
    customer: "Global Trade",
    status: "Shipped",
    total: "$2,100",
    date: "2025-12-14",
    items: 20,
  },
];

const statusClass = (s: string) => {
  if (s === "Delivered") return "badge-success";
  if (s === "Shipped") return "badge-info";
  if (s === "Allocated") return "badge-warning";
  if (s === "Pending") return "badge-error";
  return "badge-outline";
};

const tabs = ["All Orders", "Pending", "Shipped", "Delivered"];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState("All Orders");
  const [sortBy, setSortBy] = useState("date");

  const filteredOrders =
    activeTab === "All Orders"
      ? orders
      : orders.filter((o) => o.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">
          Orders ({orders.length})
        </h1>
        <div className="flex gap-3">
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">swap_vert</span>
            <span>Sort by</span>
          </button>
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">filter_list</span>
            <span>Filter by (4)</span>
          </button>
          <Link href="/admin/orders/create" className="btn btn-sm btn-primary">
            <span className="material-symbols-outlined">add</span>
            <span>Create Order</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-6 py-2 rounded-lg text-sm transition-all",
              activeTab === tab
                ? "bg-neutral text-neutral-content font-medium"
                : "text-base-content/60 hover:text-base-content"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">Order ID</th>
                <th className="font-semibold text-base-content">Customer</th>
                <th className="font-semibold text-base-content">Items</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">Total</th>
                <th className="font-semibold text-base-content">Date</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-base-200/50">
                  <td className="font-semibold text-primary">{o.id}</td>
                  <td>{o.customer}</td>
                  <td>{o.items} items</td>
                  <td>
                    <span className={`badge ${statusClass(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="font-semibold">{o.total}</td>
                  <td className="text-base-content/70">{o.date}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-xs" title="View">
                        <span className="material-symbols-outlined text-sm">
                          visibility
                        </span>
                      </button>
                      <button className="btn btn-ghost btn-xs" title="Edit">
                        <span className="material-symbols-outlined text-sm">
                          edit
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Orders</div>
              <div className="text-2xl font-bold text-base-content">
                {orders.length}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">
              inventory_2
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Pending</div>
              <div className="text-2xl font-bold text-error">
                {orders.filter((o) => o.status === "Pending").length}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-error">
              schedule
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Shipped</div>
              <div className="text-2xl font-bold text-info">
                {orders.filter((o) => o.status === "Shipped").length}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              local_shipping
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Delivered</div>
              <div className="text-2xl font-bold text-success">
                {orders.filter((o) => o.status === "Delivered").length}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">
              check_circle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
