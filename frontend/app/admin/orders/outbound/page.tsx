"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
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

function toApiOutboundStatus(status: string): string | undefined {
  if (status === "all") return undefined;
  if (status === "picking") return "processing";
  if (status === "ready_to_ship") return "ready";
  return status;
}

export default function OutboundOrdersPage() {
  const router = useRouter();
  const { hasPermission } = useAdmin();
  const canCreate = hasPermission(ADMIN_ROUTES.ORDERS, "create");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OutboundOrderDisplay | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const ordersQuery = useQuery({
    queryKey: [
      "admin-orders",
      "outbound",
      currentPage,
      itemsPerPage,
      statusFilter,
      priorityFilter,
      searchQuery.trim() || "",
    ],
    queryFn: async () => {
      const ordersPage = await ordersApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "createdAt",
        sortDir: "desc",
        orderType: "outbound",
        status: toApiOutboundStatus(statusFilter),
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        q: searchQuery.trim() || undefined,
      });

      const { orderItemsApi } = await import("@/lib/api/orderItems");
      const ordersWithItems = await Promise.all(
        ordersPage.data.map(async (order) => {
          try {
            const orderItems = await orderItemsApi.getByOrderId(order.id);
            const totalItemsForOrder = orderItems.length;
            const pickedItems = orderItems.filter((item) => item.pickedQuantity > 0).length;

            return {
              order,
              totalItems: totalItemsForOrder,
              pickedItems,
            };
          } catch (err) {
            const isDev = process.env.NODE_ENV === "development";
            if (isDev) {
              logger.warn(
                "Failed to load items for order:",
                err instanceof Error ? err.message : "Unknown error"
              );
            }
            return {
              order,
              totalItems: 0,
              pickedItems: 0,
            };
          }
        })
      );

      return {
        page: ordersPage,
        ordersWithItems,
      };
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const customersQuery = useQuery({
    queryKey: ["reference-data", "customers"],
    queryFn: () => customersApi.getAll(),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const warehousesQuery = useQuery({
    queryKey: ["reference-data", "warehouses"],
    queryFn: () => warehousesApi.getAll(),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const orders = useMemo<OutboundOrderDisplay[]>(() => {
    const customersMap = buildLookupMap(
      customersQuery.data || [],
      (customer) => customer.id,
      (customer) => customer.name
    );
    const warehousesMap = buildLookupMap(
      warehousesQuery.data || [],
      (warehouse) => warehouse.id,
      (warehouse) => warehouse.name
    );

    return (ordersQuery.data?.ordersWithItems || []).map(
      ({ order, totalItems: totalItemsForOrder, pickedItems }) => {
        const customerName = order.customerId
          ? getLookupValue(customersMap, order.customerId, "Unknown Customer")
          : "N/A";
        const warehouseName = getLookupValue(
          warehousesMap,
          order.warehouseId,
          "Unknown Warehouse"
        );

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName,
          warehouseName,
          orderDate: order.orderDate || new Date().toISOString().split("T")[0],
          requiredDelivery: order.expectedDate || new Date().toISOString().split("T")[0],
          priority: order.priority || "normal",
          status: mapOutboundOrderStatus(order.status),
          totalItems: totalItemsForOrder,
          pickedItems,
        };
      }
    );
  }, [customersQuery.data, ordersQuery.data, warehousesQuery.data]);

  const isLoading =
    (ordersQuery.isPending && !ordersQuery.data) ||
    (customersQuery.isPending && !customersQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const isFetching =
    ordersQuery.isFetching || customersQuery.isFetching || warehousesQuery.isFetching;
  const error =
    ordersQuery.error || customersQuery.error || warehousesQuery.error
      ? "Failed to load outbound orders. Please try again."
      : null;
  const totalItems = ordersQuery.data?.page.totalElements ?? 0;
  const totalPages = Math.max(ordersQuery.data?.page.totalPages ?? 1, 1);
  const reload = async () => {
    try {
      await Promise.all([
        ordersQuery.refetch(),
        customersQuery.refetch(),
        warehousesQuery.refetch(),
      ]);
    } catch (err) {
      const isDev = process.env.NODE_ENV === "development";
      if (isDev) {
        logger.error(
          "Failed to reload outbound orders:",
          err instanceof Error ? err.message : "Unknown error"
        );
      }
    }
  };

  // Calculate summary from orders
  const summary = {
    totalOrders: orders.length,
    pendingPicking: orders.filter((o) => o.status === "pending" || o.status === "picking").length,
    readyToShip: orders.filter((o) => o.status === "ready_to_ship").length,
    shippedToday: orders.filter((o) => o.status === "shipped" || o.status === "delivered").length,
  };

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
          <button className="btn btn-sm" onClick={() => void reload()}>
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
        return (
          <StatusChip
            label={priority?.label || order.priority || "Normal"}
            tone={getOutboundPriorityTone(order.priority || "normal")}
          />
        );
      },
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (order: OutboundOrderDisplay) => {
        const status = statusConfig[order.status as keyof typeof statusConfig];
        return (
          <StatusChip
            label={status?.label || order.status}
            tone={getOutboundStatusTone(order.status)}
            showDot
          />
        );
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
                      await reload();
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
                      await reload();
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
          {isFetching && (
            <div className="flex items-center text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              Updating...
            </div>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void reload()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="form-control">
            <input
              type="text"
              placeholder="Search orders..."
              className="input input-bordered input-sm w-64"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
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
                <button onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}>All Status</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("pending");
                  setCurrentPage(1);
                }}>Pending</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("picking");
                  setCurrentPage(1);
                }}>Picking</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("ready_to_ship");
                  setCurrentPage(1);
                }}>Ready to Ship</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("shipped");
                  setCurrentPage(1);
                }}>Shipped</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("cancelled");
                  setCurrentPage(1);
                }}>Cancelled</button>
              </li>
              <li className="menu-title mt-2">Priority</li>
              <li>
                <button onClick={() => {
                  setPriorityFilter("all");
                  setCurrentPage(1);
                }}>All Priority</button>
              </li>
              <li>
                <button onClick={() => {
                  setPriorityFilter("urgent");
                  setCurrentPage(1);
                }}>Urgent</button>
              </li>
              <li>
                <button onClick={() => {
                  setPriorityFilter("high");
                  setCurrentPage(1);
                }}>High</button>
              </li>
              <li>
                <button onClick={() => {
                  setPriorityFilter("normal");
                  setCurrentPage(1);
                }}>Normal</button>
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
        data={orders}
        columns={columns}
        keyExtractor={(order) => order.id}
        onRowClick={(order) => {
          router.push(`/admin/orders/outbound/${order.id}`);
        }}
        actions={renderActions}
        emptyMessage="No orders found"
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
        showItemsPerPage
        onItemsPerPageChange={(next) => {
          setItemsPerPage(next);
          setCurrentPage(1);
        }}
      />

      {/* Create Outbound Order Modal */}
      <CreateOutboundOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={reload}
      />
      
      {/* Edit Outbound Order Modal */}
      {editingOrder && (
        <CreateOutboundOrderModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingOrder(null);
          }}
          onSaved={reload}
          editingOrder={editingOrder}
        />
      )}
    </div>
  );
}
