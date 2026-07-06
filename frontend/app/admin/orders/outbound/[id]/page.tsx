"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { ordersApi, Order } from "@/lib/api/orders";
import { orderItemsApi, OrderItem } from "@/lib/api/orderItems";
import { customersApi, Customer } from "@/lib/api/customers";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { materialsApi, Material } from "@/lib/api/materials";
import { logger } from "@/lib/utils/logger";
import { downloadHtmlDocument, escapeHtml } from "@/lib/utils/documents";

const statusConfig = {
  pending: { label: "Pending" },
  picking: { label: "Picking" },
  picked: { label: "Picked" },
  packing: { label: "Packing" },
  ready_to_ship: { label: "Ready to Ship" },
  shipped: { label: "Shipped" },
  delivered: { label: "Delivered" },
  cancelled: { label: "Cancelled" },
};

const priorityConfig = {
  low: { label: "Low" },
  normal: { label: "Normal" },
  high: { label: "High" },
  urgent: { label: "Urgent" },
};

function getOutboundStatusTone(status: string): StatusTone {
  if (status === "delivered" || status === "ready_to_ship") return "success";
  if (status === "cancelled") return "danger";
  if (status === "picking" || status === "picked" || status === "packing" || status === "shipped") return "info";
  return "warning";
}

function getOutboundPriorityTone(priority: string): StatusTone {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  return "neutral";
}

export default function OutboundOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const orderDetailQuery = useQuery({
    queryKey: ["admin-orders", "outbound", "detail", orderId],
    queryFn: async () => {
      const [orderData, itemsData] = await Promise.allSettled([
        ordersApi.getById(orderId),
        orderItemsApi.getByOrderId(orderId),
      ]);

      if (orderData.status === "rejected") {
        throw new Error("Failed to load order");
      }
      const orderResult = orderData.value;

      let orderItemsResult: OrderItem[] = [];
      const materialsMap = new Map<string, Material>();

      if (itemsData.status === "fulfilled") {
        orderItemsResult = itemsData.value;
        const materialIds = itemsData.value.map((item) => item.materialId);
        const materialsData = await Promise.allSettled(
          materialIds.map((id) => materialsApi.getById(id))
        );
        materialsData.forEach((result, index) => {
          if (result.status === "fulfilled") {
            materialsMap.set(materialIds[index], result.value);
          }
        });
      }

      let customerResult: Customer | null = null;
      if (orderResult.customerId) {
        try {
          customerResult = await customersApi.getById(orderResult.customerId);
        } catch (err) {
          logger.warn("Failed to load customer:", err);
        }
      }

      let warehouseResult: Warehouse | null = null;
      try {
        warehouseResult = await warehousesApi.getById(orderResult.warehouseId);
      } catch (err) {
        logger.warn("Failed to load warehouse:", err);
      }

      return {
        order: orderResult,
        orderItems: orderItemsResult,
        customer: customerResult,
        warehouse: warehouseResult,
        materials: materialsMap,
      };
    },
    enabled: !!orderId,
  });

  const order = orderDetailQuery.data?.order as Order | undefined;
  const orderItems = orderDetailQuery.data?.orderItems || [];
  const customer = orderDetailQuery.data?.customer || null;
  const warehouse = orderDetailQuery.data?.warehouse || null;
  const materials = orderDetailQuery.data?.materials || new Map<string, Material>();
  const isLoading = orderDetailQuery.isPending && !orderDetailQuery.data;
  const error = orderDetailQuery.error instanceof Error
    ? orderDetailQuery.error.message
    : orderDetailQuery.error
      ? "Failed to load order details"
      : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <span className="material-symbols-outlined text-6xl text-error mb-4">error</span>
            <h2 className="card-title justify-center">Order Not Found</h2>
            <p className="text-base-content/60">{error || "The order you're looking for doesn't exist."}</p>
            <div className="card-actions justify-center mt-4">
              <Link href="/admin/orders/outbound" className="btn btn-primary">
                Back to Orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
  const priority = priorityConfig[order.priority as keyof typeof priorityConfig] || priorityConfig.normal;

  const totalItems = orderItems.length;
  const pickedItems = orderItems.filter((item) => item.status === "picked" || item.pickedQuantity > 0).length;
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const pickedQuantity = orderItems.reduce((sum, item) => sum + (item.pickedQuantity || 0), 0);

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/orders/outbound" className="btn btn-ghost btn-sm mb-2">
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Orders
            </Link>
            <h1 className="text-3xl font-bold">Outbound Order: {order.orderNumber}</h1>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => {
                downloadHtmlDocument(
                  `outbound-order-${order.orderNumber || order.id}.html`,
                  `Outbound Order ${order.orderNumber || order.id}`,
                  `
                    <h1>Outbound Order ${escapeHtml(order.orderNumber || order.id)}</h1>
                    <p class="muted">Generated from OptiWMS</p>
                    <div class="grid section">
                      <div class="card"><strong>Status:</strong><br />${escapeHtml(order.status || "pending")}</div>
                      <div class="card"><strong>Priority:</strong><br />${escapeHtml(order.priority || "normal")}</div>
                      <div class="card"><strong>Customer:</strong><br />${escapeHtml(customer?.name || "N/A")}</div>
                      <div class="card"><strong>Warehouse:</strong><br />${escapeHtml(warehouse?.name || "N/A")}</div>
                      <div class="card"><strong>Total Items:</strong><br />${totalItems.toString()}</div>
                      <div class="card"><strong>Total Quantity:</strong><br />${totalQuantity.toString()}</div>
                      <div class="card"><strong>Picked Items:</strong><br />${pickedItems.toString()}</div>
                      <div class="card"><strong>Picked Quantity:</strong><br />${pickedQuantity.toString()}</div>
                    </div>
                  `
                );
              }}
            >
              <span className="material-symbols-outlined">print</span>
              Download Order Sheet
            </button>
          </div>
        </div>

        {/* Order Info Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Order Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="text-sm text-base-content/60">Order Number</label>
                <p className="font-semibold">{order.orderNumber}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Status</label>
                <p>
                  <StatusChip label={status.label} tone={getOutboundStatusTone(order.status || "pending")} showDot />
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Priority</label>
                <p>
                  <StatusChip label={priority.label} tone={getOutboundPriorityTone(order.priority || "normal")} />
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Order Date</label>
                <p className="font-semibold">{order.orderDate || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Customer</label>
                <p className="font-semibold">{customer?.name || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Warehouse</label>
                <p className="font-semibold">{warehouse?.name || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Expected Date</label>
                <p className="font-semibold">{order.expectedDate || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Total Amount</label>
                <p className="font-semibold">{order.totalAmount || "N/A"}</p>
              </div>
            </div>
            {order.notes && (
              <div className="mt-4">
                <label className="text-sm text-base-content/60">Notes</label>
                <p className="mt-1">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Order Items Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Order Items</h2>
              <StatusChip
                label={`${pickedItems}/${totalItems} Items Picked (${pickedQuantity}/${totalQuantity} Qty)`}
                tone="neutral"
              />
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[28rem]">
              <table className="table table-zebra">
                <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
                  <tr>
                    <th>Material</th>
                    <th>Description</th>
                    <th>Location</th>
                    <th>Quantity</th>
                    <th>Picked</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-base-content/60">
                        No items found
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item) => {
                      const material = materials.get(item.materialId);
                      const itemStatus = item.status === "picked" || item.pickedQuantity > 0 ? "picked" : "pending";

                      return (
                        <tr key={item.id}>
                          <td>
                            <div>
                              <div className="font-mono font-semibold text-primary">
                                {material?.materialCode || item.materialId}
                              </div>
                              {material?.description && (
                                <div className="text-xs text-base-content/60 mt-0.5">
                                  {material.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="text-sm text-base-content/70">
                              {material?.description || "N/A"}
                            </div>
                          </td>
                          <td>
                            {item.locationCode ? (
                              <div className="text-sm">{item.locationCode}</div>
                            ) : (
                              <div className="text-xs text-base-content/60">
                                Assigned during picking
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="font-semibold">{item.quantity}</div>
                          </td>
                          <td>
                            <div className="font-semibold">{item.pickedQuantity || 0}</div>
                          </td>
                          <td>
                            <StatusChip
                              label={itemStatus === "picked" ? "Picked" : "Pending"}
                              tone={itemStatus === "picked" ? "success" : "warning"}
                              showDot
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
