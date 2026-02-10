"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { ordersApi } from "@/lib/api/orders";
import { customersApi } from "@/lib/api/customers";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { mapOutboundOrderStatus } from "@/lib/utils/status-mappers";
import clsx from "clsx";
import { OutboundOrderDisplay } from "./types";
import { CreateOutboundOrderModal } from "./components/CreateOutboundOrderModal";
import { logger } from "@/lib/utils/logger";

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

export default function OutboundOrdersPage() {
  const router = useRouter();
  const { hasPermission } = useAdmin();
  const canCreate = hasPermission(ADMIN_ROUTES.ORDERS, "create");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OutboundOrderDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  
  // API state
  const [orders, setOrders] = useState<OutboundOrderDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

        // Load orders, customers, and warehouses in parallel
        const [ordersData, customersData, warehousesData] = await Promise.all([
          ordersApi.getAllOutbound(),
          customersApi.getAll(),
          warehousesApi.getAll(),
        ]);

        // Create lookup maps
        const customersMap = buildLookupMap(customersData, (c) => c.id, (c) => c.name);
        const warehousesMap = buildLookupMap(warehousesData, (w) => w.id, (w) => w.name);

      // Fetch order items for all orders in parallel
      const ordersWithItems = await Promise.all(
        ordersData.map(async (order) => {
          try {
            const { orderItemsApi } = await import("@/lib/api/orderItems");
            const orderItems = await orderItemsApi.getByOrderId(order.id);
            const totalItems = orderItems.length;
            // Calculate picked items (items with pickedQuantity > 0)
            const pickedItems = orderItems.filter(
              item => item.pickedQuantity > 0
            ).length;
            
            return {
              order,
              totalItems,
              pickedItems,
            };
          } catch (err) {
            const isDev = process.env.NODE_ENV === 'development';
            if (isDev) {
              logger.warn(`Failed to load items for order:`, err instanceof Error ? err.message : 'Unknown error');
            }
            return {
              order,
              totalItems: 0,
              pickedItems: 0,
            };
          }
        })
      );

      // Transform orders to display format
      const displayOrders: OutboundOrderDisplay[] = ordersWithItems.map(({ order, totalItems, pickedItems }) => {
        const customerName = order.customerId
          ? getLookupValue(customersMap, order.customerId, "Unknown Customer")
          : "N/A";
        const warehouseName = getLookupValue(warehousesMap, order.warehouseId, "Unknown Warehouse");
        
        const status = mapOutboundOrderStatus(order.status);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName,
          warehouseName,
          orderDate: order.orderDate || new Date().toISOString().split("T")[0],
          requiredDelivery: order.expectedDate || new Date().toISOString().split("T")[0],
          priority: order.priority || "normal",
          status,
          totalItems,
          pickedItems,
        };
      });

      setOrders(displayOrders);
    } catch (err) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        logger.error("Failed to load outbound orders:", err instanceof Error ? err.message : 'Unknown error');
      }
      setError("Failed to load outbound orders. Please try again.");
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
    pendingPicking: orders.filter((o) => o.status === "pending" || o.status === "picking").length,
    readyToShip: orders.filter((o) => o.status === "ready_to_ship").length,
    shippedToday: orders.filter((o) => o.status === "shipped" || o.status === "delivered").length,
  };

  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.warehouseName.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query) ||
      order.priority.toLowerCase().includes(query) ||
      order.orderDate.toLowerCase().includes(query) ||
      order.requiredDelivery.toLowerCase().includes(query) ||
      order.totalItems.toString().includes(query) ||
      order.pickedItems.toString().includes(query) ||
      order.id.toLowerCase().includes(query)
    );
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const summaryCards = [
    {
      label: "Total Orders",
      value: summary.totalOrders,
      icon: "inventory_2",
      color: "primary" as const,
    },
    {
      label: "Pending Picking",
      value: summary.pendingPicking,
      icon: "schedule",
      color: "warning" as const,
    },
    {
      label: "Ready to Ship",
      value: summary.readyToShip,
      icon: "local_shipping",
      color: "success" as const,
    },
    {
      label: "Shipped Today",
      value: summary.shippedToday,
      icon: "check_circle",
      color: "info" as const,
    },
  ];

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

  const columns = [
    {
      key: "orderNumber",
      label: "Order Number",
      render: (order: OutboundOrderDisplay) => (
        <Link
          href={`/admin/orders/outbound/${order.id}`}
          className="font-semibold text-primary hover:underline"
        >
          {order.orderNumber}
        </Link>
      ),
      sortable: true,
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
    },
    {
      key: "warehouseName",
      label: "Warehouse",
      sortable: true,
    },
    {
      key: "orderDate",
      label: "Order Date",
      sortable: true,
      className: "text-base-content/70",
    },
    {
      key: "requiredDelivery",
      label: "Required Delivery",
      sortable: true,
      className: "text-base-content/70",
    },
    {
      key: "priority",
      label: "Priority",
      render: (order: OutboundOrderDisplay) => {
        const priority = priorityConfig[order.priority as keyof typeof priorityConfig];
        if (!priority) {
          // Fallback for unknown priority
          return <span className="badge badge-outline">{order.priority || "normal"}</span>;
        }
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (priority.class === "badge-outline") {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {priority.label}
            </span>
          );
        }
        return <span className={`badge ${priority.class}`}>{priority.label}</span>;
      },
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (order: OutboundOrderDisplay) => {
        const status = statusConfig[order.status as keyof typeof statusConfig];
        if (!status) {
          // Fallback for unknown status
          return <span className="badge badge-outline">{order.status}</span>;
        }
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (status.class === "badge-outline") {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {status.label}
            </span>
          );
        }
        return <span className={`badge ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "items",
      label: "Items",
      render: (order: OutboundOrderDisplay) => (
        <div className="flex items-center gap-2">
          <span>{order.pickedItems}/{order.totalItems}</span>
          <div className="w-16 bg-base-300 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full"
              style={{
                width: `${(order.pickedItems / order.totalItems) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      ),
    },
  ];

  const handleEditOrder = (order: OutboundOrderDisplay) => {
    setEditingOrder(order);
    setShowEditModal(true);
  };

  const renderActions = (order: OutboundOrderDisplay) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <Link href={`/admin/orders/outbound/${order.id}`}>
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </Link>
        </li>
        {order.status === "pending" && (
          <>
            <li>
              <button onClick={() => handleEditOrder(order)}>
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit Order
              </button>
            </li>
            <li>
              <button>
                <span className="material-symbols-outlined text-sm">person_add</span>
                Assign Picker
              </button>
            </li>
          </>
        )}
        {order.status === "picked" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">check</span>
              Mark as Ready to Ship
            </button>
          </li>
        )}
        {order.status === "ready_to_ship" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">local_shipping</span>
              Assign to Shipment
            </button>
          </li>
        )}
        <li>
          <button onClick={() => showToast.warning(`Printing order ${order.orderNumber}...`)}>
            <span className="material-symbols-outlined text-sm">print</span>
            Print/Export
          </button>
        </li>
        {order.status === "pending" && (
          <>
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
                      const isDev = process.env.NODE_ENV === 'development';
                      if (isDev) {
                        logger.error("Failed to cancel order:", err instanceof Error ? err.message : 'Unknown error');
                      }
                      showToast.error("Failed to cancel order. Please try again.");
                    }
                  }
                }}
              >
                <span className="material-symbols-outlined text-sm">cancel</span>
                Cancel Order
              </button>
            </li>
            <li>
              <button 
                className="text-error"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to delete order ${order.orderNumber}? This action cannot be undone.`)) {
                    try {
                      await ordersApi.delete(order.id);
                      showToast.success("Order deleted successfully");
                      await loadData();
                    } catch (err) {
                      const isDev = process.env.NODE_ENV === 'development';
                      if (isDev) {
                        logger.error("Failed to delete order:", err instanceof Error ? err.message : 'Unknown error');
                      }
                      showToast.error("Failed to delete order. Please try again.");
                    }
                  }
                }}
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Delete Order
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Outbound Orders</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage customer orders and fulfillment</p>
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
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-64 border border-base-300 z-10"
            >
              <li className="menu-title">Status</li>
              <li>
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("pending")}>Pending</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("picking")}>Picking</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("ready_to_ship")}>Ready to Ship</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("shipped")}>Shipped</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("cancelled")}>Cancelled</button>
              </li>
              <li className="menu-title mt-2">Priority</li>
              <li>
                <button onClick={() => setPriorityFilter("all")}>All Priority</button>
              </li>
              <li>
                <button onClick={() => setPriorityFilter("urgent")}>Urgent</button>
              </li>
              <li>
                <button onClick={() => setPriorityFilter("high")}>High</button>
              </li>
              <li>
                <button onClick={() => setPriorityFilter("normal")}>Normal</button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreateModal(true)}
              title="Create manual orders (for internal transfers)"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Create Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Orders Table */}
      <DataTable
        data={filteredOrders}
        columns={columns}
        keyExtractor={(order) => order.id}
        onRowClick={(order) => {
          router.push(`/admin/orders/outbound/${order.id}`);
        }}
        actions={renderActions}
        emptyMessage="No orders found"
      />

      {/* Create Outbound Order Modal */}
      <CreateOutboundOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadData}
      />
      
      {/* Edit Outbound Order Modal */}
      {editingOrder && (
        <CreateOutboundOrderModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingOrder(null);
          }}
          onSaved={loadData}
          editingOrder={editingOrder}
        />
      )}
    </div>
  );
}
