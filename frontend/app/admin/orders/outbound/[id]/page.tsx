"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ordersApi, Order } from "@/lib/api/orders";
import { orderItemsApi, OrderItem } from "@/lib/api/orderItems";
import { customersApi, Customer } from "@/lib/api/customers";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { materialsApi, Material } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";

const statusConfig = {
  pending: { label: "Pending", class: "badge-outline" },
  picking: { label: "Picking", class: "badge-primary" },
  picked: { label: "Picked", class: "badge-info" },
  packing: { label: "Packing", class: "badge-warning" },
  ready_to_ship: { label: "Ready to Ship", class: "badge-success" },
  shipped: { label: "Shipped", class: "badge-info" },
  delivered: { label: "Delivered", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};

const priorityConfig = {
  low: { label: "Low", class: "badge-outline" },
  normal: { label: "Normal", class: "badge-info" },
  high: { label: "High", class: "badge-warning" },
  urgent: { label: "Urgent", class: "badge-error" },
};

export default function OutboundOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [materials, setMaterials] = useState<Map<string, Material>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrderDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load order, items, customer, warehouse, and materials in parallel
        const [orderData, itemsData] = await Promise.allSettled([
          ordersApi.getById(orderId),
          orderItemsApi.getByOrderId(orderId),
        ]);

        if (orderData.status === "rejected") {
          throw new Error("Failed to load order");
        }
        const orderResult = orderData.value;
        setOrder(orderResult);

        if (itemsData.status === "fulfilled") {
          setOrderItems(itemsData.value);

          // Load materials for all items
          const materialIds = itemsData.value.map((item) => item.materialId);
          const materialsData = await Promise.allSettled(
            materialIds.map((id) => materialsApi.getById(id))
          );
          const materialsMap = new Map<string, Material>();
          materialsData.forEach((result, index) => {
            if (result.status === "fulfilled") {
              materialsMap.set(materialIds[index], result.value);
            }
          });
          setMaterials(materialsMap);
        }

        // Load customer if exists
        if (orderResult.customerId) {
          try {
            const customerData = await customersApi.getById(orderResult.customerId);
            setCustomer(customerData);
          } catch (err) {
            console.warn("Failed to load customer:", err);
          }
        }

        // Load warehouse
        try {
          const warehouseData = await warehousesApi.getById(orderResult.warehouseId);
          setWarehouse(warehouseData);
        } catch (err) {
          console.warn("Failed to load warehouse:", err);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load order details";
        setError(errorMessage);
        showToast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

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
            <button className="btn btn-ghost" onClick={() => window.print()}>
              <span className="material-symbols-outlined">print</span>
              Print
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
                  {status.class === "badge-outline" ? (
                    <span
                      className="badge text-xs whitespace-nowrap"
                      style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                    >
                      {status.label}
                    </span>
                  ) : (
                    <span className={`badge ${status.class}`}>{status.label}</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Priority</label>
                <p>
                  {priority.class === "badge-outline" ? (
                    <span
                      className="badge text-xs whitespace-nowrap"
                      style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                    >
                      {priority.label}
                    </span>
                  ) : (
                    <span className={`badge ${priority.class}`}>{priority.label}</span>
                  )}
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
              <div className="badge badge-info">
                {pickedItems}/{totalItems} Items Picked ({pickedQuantity}/{totalQuantity} Qty)
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
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
                      const statusBadge = itemStatus === "picked" ? "badge-success" : "badge-outline";

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
                            <div className="text-sm">{item.locationCode || "N/A"}</div>
                          </td>
                          <td>
                            <div className="font-semibold">{item.quantity}</div>
                          </td>
                          <td>
                            <div className="font-semibold">{item.pickedQuantity || 0}</div>
                          </td>
                          <td>
                            <span className={`badge ${statusBadge}`}>
                              {itemStatus === "picked" ? "Picked" : "Pending"}
                            </span>
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
