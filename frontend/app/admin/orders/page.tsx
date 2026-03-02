"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SummaryCards } from "@/components/SummaryCards";
import { ordersApi, type Order } from "@/lib/api/orders";
import { logger } from "@/lib/utils/logger";

export default function OrdersPage() {
  const router = useRouter();
  const [summary, setSummary] = useState({
    inboundOrders: 0,
    outboundOrders: 0,
    inTransit: 0,
    openFulfillment: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const [inboundOrders, outboundOrders] = await Promise.all([
          ordersApi.getAllInbound(),
          ordersApi.getAllOutbound(),
        ]);

        setSummary({
          inboundOrders: inboundOrders.length,
          outboundOrders: outboundOrders.length,
          inTransit: outboundOrders.filter((order) => isInTransit(order)).length,
          openFulfillment: outboundOrders.filter((order) => needsFulfillment(order)).length,
        });
      } catch (error) {
        logger.error("Failed to load orders summary:", error);
        setSummary({
          inboundOrders: 0,
          outboundOrders: 0,
          inTransit: 0,
          openFulfillment: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadSummary();
  }, []);

  const summaryCards = [
    {
      label: "Inbound Orders",
      value: loading ? "..." : summary.inboundOrders,
      icon: "input",
      color: "primary" as const,
      onClick: () => {
        router.push("/admin/orders/inbound");
      },
    },
    {
      label: "Outbound Orders",
      value: loading ? "..." : summary.outboundOrders,
      icon: "shopping_cart",
      color: "info" as const,
      onClick: () => {
        router.push("/admin/orders/outbound");
      },
    },
    {
      label: "In Transit",
      value: loading ? "..." : summary.inTransit,
      icon: "local_shipping",
      color: "warning" as const,
    },
    {
      label: "Open Fulfillment",
      value: loading ? "..." : summary.openFulfillment,
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

function normalizeStatus(order: Order) {
  return (order.status || "").trim().toLowerCase();
}

function isInTransit(order: Order) {
  const status = normalizeStatus(order);
  return status === "in_transit" || status === "shipped" || status === "out_for_delivery";
}

function needsFulfillment(order: Order) {
  const status = normalizeStatus(order);
  return ["pending", "confirmed", "allocated", "processing", "picking", "packing"].includes(status);
}
