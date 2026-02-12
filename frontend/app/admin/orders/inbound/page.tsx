"use client";

import { useState, useEffect } from "react";
import { ordersApi } from "@/lib/api/orders";
import { suppliersApi } from "@/lib/api/suppliers";
import { warehousesApi } from "@/lib/api/warehouses";
import { orderItemsApi } from "@/lib/api/orderItems";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { mapInboundOrderStatus } from "@/lib/utils/status-mappers";
import { logger } from "@/lib/utils/logger";
import { statusConfig, type InboundOrderDisplay } from "./types";
import {
  CreateInboundOrderModal,
  EditInboundOrderModal,
  InboundOrderDetailModal,
} from "./components/InboundOrderModals";

export default function InboundOrdersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InboundOrderDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // API state
  const [orders, setOrders] = useState<InboundOrderDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

        // Load orders, suppliers, and warehouses in parallel
        const [ordersData, suppliersData, warehousesData] = await Promise.all([
          ordersApi.getAllInbound(),
          suppliersApi.getAll(),
          warehousesApi.getAll(),
        ]);

        // Create lookup maps
        const suppliersMap = buildLookupMap(suppliersData, (s) => s.id, (s) => s.name);
        const warehousesMap = buildLookupMap(warehousesData, (w) => w.id, (w) => w.name);

      // Fetch order items for all orders in parallel
      const ordersWithItems = await Promise.all(
        ordersData.map(async (order) => {
          try {
            const orderItems = await orderItemsApi.getByOrderId(order.id);
            const totalItems = orderItems.length;
            // Calculate received items (items with pickedQuantity > 0 or status indicating received)
            const receivedItems = orderItems.filter(
              item => item.pickedQuantity > 0 || item.status === "received" || item.status === "picked"
            ).length;
            
            return {
              order,
              totalItems,
              receivedItems,
            };
          } catch (err) {
            logger.warn(`Failed to load items for order ${order.orderNumber}:`, err);
            return {
              order,
              totalItems: 0,
              receivedItems: 0,
            };
          }
        })
      );

      // Transform orders to display format
      const displayOrders: InboundOrderDisplay[] = ordersWithItems.map(({ order, totalItems, receivedItems }) => {
        const supplierName = order.supplierId
          ? getLookupValue(suppliersMap, order.supplierId, "Unknown Supplier")
          : "N/A";
        const warehouseName = getLookupValue(warehousesMap, order.warehouseId, "Unknown Warehouse");
        
        const status = mapInboundOrderStatus(order.status);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          supplierName,
          warehouseName,
          orderDate: order.orderDate || new Date().toISOString().split("T")[0],
          expectedDelivery: order.expectedDate || new Date().toISOString().split("T")[0],
          status,
          totalItems,
          receivedItems,
        };
      });

      setOrders(displayOrders);
    } catch (err) {
      logger.error("Failed to load inbound orders:", err);
      setError("Failed to load inbound orders. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate summary from orders
  const summary = {
    totalOrders: orders.length,
    inTransit: orders.filter((o) => o.status === "in_transit").length,
    receiving: orders.filter((o) => o.status === "receiving").length,
    completedThisMonth: orders.filter((o) => o.status === "completed").length,
  };

  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      order.orderNumber.toLowerCase().includes(query) ||
      order.supplierName.toLowerCase().includes(query) ||
      order.warehouseName.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query) ||
      order.orderDate.toLowerCase().includes(query) ||
      order.expectedDelivery.toLowerCase().includes(query) ||
      order.totalItems.toString().includes(query) ||
      order.receivedItems.toString().includes(query) ||
      order.id.toLowerCase().includes(query)
    );
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => loadData()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Inbound Orders</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage purchase orders from suppliers</p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => loadData()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="form-control">
            <input
              type="text"
              placeholder="Search orders..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("in_transit")}>In Transit</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("arrived")}>Arrived</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("receiving")}>Receiving</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("completed")}>Completed</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("cancelled")}>Cancelled</button>
              </li>
            </ul>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Create Inbound Order</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Orders</div>
              <div className="text-2xl font-bold text-base-content">{summary.totalOrders}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">inventory_2</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">In Transit</div>
              <div className="text-2xl font-bold text-warning">{summary.inTransit}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">local_shipping</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Receiving</div>
              <div className="text-2xl font-bold text-info">{summary.receiving}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">input</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Completed This Month</div>
              <div className="text-2xl font-bold text-success">{summary.completedThisMonth}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">Order Number</th>
                <th className="font-semibold text-base-content">Supplier</th>
                <th className="font-semibold text-base-content">Warehouse</th>
                <th className="font-semibold text-base-content">Order Date</th>
                <th className="font-semibold text-base-content">Expected Delivery</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">Total Items</th>
                <th className="font-semibold text-base-content">Received Items</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.ordered;
                return (
                  <tr key={order.id} className="hover:bg-base-200/50">
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                          setShowDetailModal(true);
                        }}
                        className="font-semibold text-primary hover:underline text-left"
                      >
                        {order.orderNumber}
                      </button>
                    </td>
                    <td>{order.supplierName}</td>
                    <td>{order.warehouseName}</td>
                    <td className="text-base-content/70">{order.orderDate}</td>
                    <td className="text-base-content/70">{order.expectedDelivery}</td>
                    <td>
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
                    </td>
                    <td>{order.totalItems}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>{order.receivedItems}</span>
                        <div className="w-16 bg-base-300 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(order.receivedItems / order.totalItems) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-ghost btn-xs">
                          <span className="material-symbols-outlined">more_vert</span>
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
                        >
                          <li>
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              View Details
                            </button>
                          </li>
                          {order.status === "ordered" || order.status === "in_transit" ? (
                            <li>
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowEditModal(true);
                                }}
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                                Edit Order
                              </button>
                            </li>
                          ) : null}
                          {order.status === "arrived" ? (
                            <li>
                              <button>
                                <span className="material-symbols-outlined text-sm">person_add</span>
                                Assign Worker
                              </button>
                            </li>
                          ) : null}
                          {order.status === "arrived" ? (
                            <li>
                              <button>
                                <span className="material-symbols-outlined text-sm">check</span>
                                Mark as Arrived
                              </button>
                            </li>
                          ) : null}
                          <li>
                            <button onClick={() => window.print()}>
                              <span className="material-symbols-outlined text-sm">print</span>
                              Print/Export
                            </button>
                          </li>
                          {order.status === "ordered" || order.status === "in_transit" ? (
                            <li>
                              <button 
                                className="text-error"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to cancel order ${order.orderNumber}?`)) {
                                    try {
                                      await ordersApi.cancel(order.id);
                                      showToast.success("Order cancelled successfully");
                                      await loadData();
                                    } catch (err) {
                                      logger.error("Failed to cancel order:", err);
                                      showToast.error("Failed to cancel order. Please try again.");
                                    }
                                  }
                                }}
                              >
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Cancel Order
                              </button>
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Inbound Order Modal */}
      {showCreateModal && (
        <CreateInboundOrderModal
          onClose={() => setShowCreateModal(false)}
          onSaved={loadData}
        />
      )}

      {/* Inbound Order Detail Modal */}
      {selectedOrder && (
        <InboundOrderDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}

      {/* Edit Inbound Order Modal */}
      {selectedOrder && (
        <EditInboundOrderModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          onSaved={loadData}
          order={selectedOrder}
        />
      )}
    </div>
  );
}

