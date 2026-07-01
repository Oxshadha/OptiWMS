"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { ordersApi } from "@/lib/api/orders";
import { orderItemsApi } from "@/lib/api/orderItems";
import {
  useInvalidateAdminList,
  usePagedAdminQuery,
  useReferenceSuppliers,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { mapInboundOrderStatus } from "@/lib/utils/status-mappers";
import { logger } from "@/lib/utils/logger";
import { downloadHtmlDocument, escapeHtml } from "@/lib/utils/documents";
import { statusConfig, type InboundOrderDisplay } from "./types";
import {
  CreateInboundOrderModal,
  EditInboundOrderModal,
  InboundOrderDetailModal,
} from "./components/InboundOrderModals";

function getInboundStatusTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "arrived" || status === "receiving" || status === "putaway") return "info";
  return "warning";
}

function toApiInboundStatus(status: string): string | undefined {
  if (status === "all") return undefined;
  if (status === "in_transit") return "shipped";
  if (status === "arrived") return "delivered";
  if (status === "receiving") return "processing";
  if (status === "completed") return "fulfilled";
  if (status === "ordered") return "pending";
  return status;
}

export default function InboundOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierFilterId = searchParams.get("supplier")?.trim() || "";
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InboundOrderDisplay | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilterName, setSupplierFilterName] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const ordersQuery = usePagedAdminQuery({
    queryKey: [
      "admin-orders",
      "inbound",
      currentPage,
      itemsPerPage,
      statusFilter,
      supplierFilterId || "all",
      searchQuery.trim() || "",
    ],
    queryFn: async () => {
      const ordersPage = await ordersApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "createdAt",
        sortDir: "desc",
        orderType: "inbound",
        status: toApiInboundStatus(statusFilter),
        supplierId: supplierFilterId || undefined,
        q: searchQuery.trim() || undefined,
      });

      const ordersWithItems = await Promise.all(
        ordersPage.data.map(async (order) => {
          try {
            const orderItems = await orderItemsApi.getByOrderId(order.id);
            const totalItemsForOrder = orderItems.length;
            const receivedItems = orderItems.filter(
              (item) =>
                item.pickedQuantity > 0 ||
                item.status === "received" ||
                item.status === "picked"
            ).length;

            return {
              order,
              totalItems: totalItemsForOrder,
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

      return {
        page: ordersPage,
        ordersWithItems,
      };
    },
  });

  const suppliersQuery = useReferenceSuppliers();
  const warehousesQuery = useReferenceWarehouses();
  const invalidateInboundOrders = useInvalidateAdminList(["admin-orders", "inbound"]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const orders = useMemo<InboundOrderDisplay[]>(() => {
    const suppliersMap = buildLookupMap(
      suppliersQuery.data || [],
      (supplier) => supplier.id,
      (supplier) => supplier.name
    );
    const warehousesMap = buildLookupMap(
      warehousesQuery.data || [],
      (warehouse) => warehouse.id,
      (warehouse) => warehouse.name
    );

    return (ordersQuery.data?.ordersWithItems || []).map(
      ({ order, totalItems: totalItemsForOrder, receivedItems }) => {
        const supplierName = order.supplierId
          ? getLookupValue(suppliersMap, order.supplierId, "Unknown Supplier")
          : "Missing supplier - repair required";
        const warehouseName = getLookupValue(
          warehousesMap,
          order.warehouseId,
          "Unknown Warehouse"
        );

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          supplierId: order.supplierId || null,
          supplierName,
          warehouseName,
          orderDate: order.orderDate || new Date().toISOString().split("T")[0],
          expectedDelivery: order.expectedDate || new Date().toISOString().split("T")[0],
          status: mapInboundOrderStatus(order.status),
          totalItems: totalItemsForOrder,
          receivedItems,
        };
      }
    );
  }, [ordersQuery.data, suppliersQuery.data, warehousesQuery.data]);

  useEffect(() => {
    if (!supplierFilterId) {
      setSupplierFilterName(null);
      return;
    }

    const suppliersMap = buildLookupMap(
      suppliersQuery.data || [],
      (supplier) => supplier.id,
      (supplier) => supplier.name
    );
    setSupplierFilterName(
      getLookupValue(suppliersMap, supplierFilterId, "Selected Supplier")
    );
  }, [supplierFilterId, suppliersQuery.data]);

  const isLoading =
    (ordersQuery.isPending && !ordersQuery.data) ||
    (suppliersQuery.isPending && !suppliersQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const isFetching =
    ordersQuery.isFetching || suppliersQuery.isFetching || warehousesQuery.isFetching;
  const error =
    ordersQuery.error || suppliersQuery.error || warehousesQuery.error
      ? "Failed to load inbound orders. Please try again."
      : null;
  const totalItems = ordersQuery.data?.page.totalElements ?? 0;
  const totalPages = Math.max(ordersQuery.data?.page.totalPages ?? 1, 1);
  const reload = async () => {
    try {
      await invalidateInboundOrders();
    } catch (err) {
      logger.error("Failed to reload inbound orders:", err);
    }
  };

  const operationalOrders = orders.filter((order) => order.totalItems > 0);

  // Calculate summary from operational orders only. Incomplete shells belong in Data Quality.
  const summary = {
    totalOrders: operationalOrders.length,
    inTransit: operationalOrders.filter((o) => o.status === "in_transit").length,
    receiving: operationalOrders.filter((o) => o.status === "receiving").length,
    completedThisMonth: operationalOrders.filter((o) => o.status === "completed").length,
  };

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Inbound Orders</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage purchase orders from suppliers</p>
          {supplierFilterId && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-base-content/60">Filtered by supplier:</span>
              <StatusChip label={supplierFilterName || "Selected Supplier"} tone="info" />
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => router.push("/admin/orders/inbound")}
              >
                Clear
              </button>
            </div>
          )}
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
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}>All Status</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("in_transit");
                  setCurrentPage(1);
                }}>In Transit</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("arrived");
                  setCurrentPage(1);
                }}>Arrived</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("receiving");
                  setCurrentPage(1);
                }}>Receiving</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("completed");
                  setCurrentPage(1);
                }}>Completed</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("cancelled");
                  setCurrentPage(1);
                }}>Cancelled</button>
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
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="table w-full">
            <thead className="bg-base-200 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
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
              {operationalOrders.map((order) => {
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
                      <StatusChip label={status.label} tone={getInboundStatusTone(order.status)} showDot />
                    </td>
                    <td>{order.totalItems}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>{order.receivedItems}</span>
                        <div className="w-16 bg-base-300 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${order.totalItems > 0 ? (order.receivedItems / order.totalItems) * 100 : 0}%`,
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
                            <button
                              onClick={() =>
                                downloadHtmlDocument(
                                  `inbound-order-${order.orderNumber}.html`,
                                  `Inbound Order ${order.orderNumber}`,
                                  `
                                    <h1>Inbound Order ${escapeHtml(order.orderNumber)}</h1>
                                    <p class="muted">Generated from OptiWMS</p>
                                    <div class="grid section">
                                      <div class="card"><strong>Status:</strong><br />${escapeHtml(order.status)}</div>
                                      <div class="card"><strong>Supplier:</strong><br />${escapeHtml(order.supplierName || "N/A")}</div>
                                      <div class="card"><strong>Warehouse:</strong><br />${escapeHtml(order.warehouseName || "N/A")}</div>
                                      <div class="card"><strong>Expected Delivery:</strong><br />${escapeHtml(order.expectedDelivery || "N/A")}</div>
                                    </div>
                                  `
                                )
                              }
                            >
                              <span className="material-symbols-outlined text-sm">print</span>
                              Download Order Sheet
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
                                      await reload();
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

      {/* Create Inbound Order Modal */}
      {showCreateModal && (
        <CreateInboundOrderModal
          onClose={() => setShowCreateModal(false)}
          onSaved={reload}
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
          onSaved={reload}
          order={selectedOrder}
        />
      )}
    </div>
  );
}
