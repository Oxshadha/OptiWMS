"use client";

import Link from "next/link";
import { SummaryCards } from "@/components/SummaryCards";

export default function OrdersPage() {
  const summary = {
    inboundOrders: 145,
    outboundOrders: 245,
    inTransit: 23,
    pendingPicking: 18,
  };

  const summaryCards = [
    {
      label: "Inbound Orders",
      value: summary.inboundOrders,
      icon: "input",
      color: "primary" as const,
      onClick: () => {
        window.location.href = "/admin/orders/inbound";
      },
    },
    {
      label: "Outbound Orders",
      value: summary.outboundOrders,
      icon: "shopping_cart",
      color: "info" as const,
      onClick: () => {
        window.location.href = "/admin/orders/outbound";
      },
    },
    {
      label: "In Transit",
      value: summary.inTransit,
      icon: "local_shipping",
      color: "warning" as const,
    },
    {
      label: "Pending Picking",
      value: summary.pendingPicking,
      icon: "schedule",
      color: "error" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Orders</h1>
        <p className="text-sm text-base-content/60 mt-1">Manage inbound and outbound orders</p>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/admin/orders/inbound"
          className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-base-content mb-2">Inbound Orders</h2>
              <p className="text-sm text-base-content/60 mb-4">
                Manage purchase orders from suppliers
              </p>
              <div className="flex items-center gap-2 text-primary">
                <span>View Inbound Orders</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
            <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-primary">input</span>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/orders/outbound"
          className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-base-content mb-2">Outbound Orders</h2>
              <p className="text-sm text-base-content/60 mb-4">
                Manage customer orders and fulfillment
              </p>
              <div className="flex items-center gap-2 text-primary">
                <span>View Outbound Orders</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
            <div className="w-16 h-16 bg-info/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-info">shopping_cart</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
