"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import Link from "next/link";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { returnsApi } from "@/lib/api/returns";
import { warehousesApi } from "@/lib/api/warehouses";
import { customersApi } from "@/lib/api/customers";
import { ordersApi } from "@/lib/api/orders";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { logger } from "@/lib/utils/logger";
import type { ReturnDisplay } from "./types";
import { resolutionConfig, statusConfig } from "./types";
import {
  AssignWorkerModal,
  CreateReturnModal,
  InspectReturnModal,
  ReturnDetailModal,
} from "./components/ReturnModals";

export default function ReturnsPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showAssignWorkerModal, setShowAssignWorkerModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flowFilter, setFlowFilter] = useState<"all" | "inbound" | "outbound">("all");

  const canApprove = hasPermission(ADMIN_ROUTES.RETURNS, "approve");

  // API state
  const [returns, setReturns] = useState<ReturnDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [returnsData, warehousesData, customersData, ordersData] = await Promise.all([
        returnsApi.getAll(),
        warehousesApi.getAll(),
        customersApi.getAll(),
        ordersApi.getAll(),
      ]);

      // Build maps
      const warehousesMap = buildLookupMap(warehousesData, (wh) => wh.id, (wh) => wh.name);
      const customersMap = buildLookupMap(customersData, (c) => c.id, (c) => c.name);
      const ordersMap = buildLookupMap(ordersData, (o) => o.id, (o) => ({
        orderNumber: o.orderNumber,
        orderType: o.orderType,
      }));

      // Transform API data to display format
      const displayReturns: ReturnDisplay[] = returnsData.map((r) => {
        const warehouseName = r.warehouseId
          ? getLookupValue(warehousesMap, r.warehouseId, "Unknown")
          : "Unknown";
        const customerName = r.customerId
          ? getLookupValue(customersMap, r.customerId, "Unknown")
          : "Unknown";
        const orderInfo = r.originalOrderId
          ? getLookupValue(ordersMap, r.originalOrderId, null)
          : null;
        const orderNumber = orderInfo?.orderNumber || r.originalOrderId || "N/A";
        const orderType = orderInfo?.orderType || null;
        const returnFlow =
          orderType === "inbound" || orderType === "outbound" ? orderType : "unknown";

        return {
          id: r.id,
          returnNumber: r.returnNumber,
          originalOrderId: r.originalOrderId || null,
          originalOrder: orderNumber,
          originalOrderType: orderType,
          returnFlow,
          customerName,
          warehouseId: r.warehouseId || null,
          warehouse: warehouseName,
          returnDate: r.returnDate || new Date().toISOString().split("T")[0],
          reason: r.reason || "N/A",
          totalItems: 0, // TODO: Get from return items when available
          status: r.status || "pending",
          resolution: r.resolution || null,
          receivedBy: r.receivedBy || null,
          inspectedBy: r.inspectedBy || null,
        };
      });

      setReturns(displayReturns);
    } catch (err) {
      logger.error("Failed to load returns:", err);
      setError(err instanceof Error ? err.message : "Failed to load returns");
      setReturns([]);
      if (err instanceof Error && !err.message.includes("Not authenticated")) {
        showToast.error("Failed to load returns. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter returns by warehouse for warehouse managers
  const returnsForWarehouse = isWarehouseManager && assignedWarehouseId
    ? returns.filter((r) => r.warehouseId === assignedWarehouseId)
    : returns;

  const filteredReturns = returnsForWarehouse.filter((returnItem) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      returnItem.returnNumber.toLowerCase().includes(query) ||
      returnItem.originalOrder.toLowerCase().includes(query) ||
      returnItem.customerName.toLowerCase().includes(query) ||
      returnItem.warehouse.toLowerCase().includes(query) ||
      returnItem.status.toLowerCase().includes(query) ||
      returnItem.reason.toLowerCase().includes(query) ||
      returnItem.returnDate.toLowerCase().includes(query) ||
      returnItem.totalItems.toString().includes(query) ||
      (returnItem.resolution &&
        returnItem.resolution.toLowerCase().includes(query)) ||
      (returnItem.receivedBy &&
        returnItem.receivedBy.toLowerCase().includes(query)) ||
      (returnItem.inspectedBy &&
        returnItem.inspectedBy.toLowerCase().includes(query)) ||
      returnItem.id.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" || returnItem.status === statusFilter;
    const matchesFlow =
      flowFilter === "all" ||
      returnItem.returnFlow === flowFilter;
    return matchesSearch && matchesStatus && matchesFlow;
  });

  const handleRowClick = (returnItem: ReturnDisplay) => {
    setSelectedReturn(returnItem);
    setShowDetailModal(true);
  };

  const handleInspect = (returnItem: ReturnDisplay) => {
    setSelectedReturn(returnItem);
    setShowInspectModal(true);
  };

  const handleAssignWorker = (returnItem: ReturnDisplay) => {
    setSelectedReturn(returnItem);
    setShowAssignWorkerModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && returns.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading returns: {error}</span>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Total Returns This Month",
      value: returnsForWarehouse.length,
      icon: "keyboard_return",
      color: "primary" as const,
    },
    {
      label: "Inbound Returns",
      value: returnsForWarehouse.filter((r) => r.returnFlow === "inbound").length,
      icon: "move_to_inbox",
      color: "info" as const,
    },
    {
      label: "Outbound Returns",
      value: returnsForWarehouse.filter((r) => r.returnFlow === "outbound").length,
      icon: "outbox",
      color: "success" as const,
    },
    {
      label: "Pending Inspection",
      value: returnsForWarehouse.filter(
        (r) => r.status === "pending" || r.status === "received"
      ).length,
      icon: "pending_actions",
      color: "warning" as const,
    },
  ];

  const columns = [
    {
      key: "returnNumber",
      label: "Return #",
      render: (returnItem: ReturnDisplay) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick(returnItem);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {returnItem.returnNumber}
        </button>
      ),
      sortable: true,
    },
    {
      key: "returnFlow",
      label: "Flow",
      render: (returnItem: ReturnDisplay) => (
        <span
          className={`badge ${
            returnItem.returnFlow === "inbound"
              ? "badge-info"
              : returnItem.returnFlow === "outbound"
                ? "badge-secondary"
                : "badge-outline"
          }`}
        >
          {returnItem.returnFlow === "inbound"
            ? "Inbound"
            : returnItem.returnFlow === "outbound"
              ? "Outbound"
              : "Unknown"}
        </span>
      ),
      sortable: true,
    },
    {
      key: "originalOrder",
      label: "Original Order",
      render: (returnItem: ReturnDisplay) => (
        returnItem.originalOrderId ? (
          <Link
            href={
              returnItem.originalOrderType === "outbound"
                ? `/admin/orders/outbound/${returnItem.originalOrderId}`
                : `/admin/orders/inbound`
            }
            className="text-primary hover:underline"
          >
            {returnItem.originalOrder}
          </Link>
        ) : (
          <span>{returnItem.originalOrder}</span>
        )
      ),
      sortable: true,
    },
    { key: "customerName", label: "Customer", sortable: true },
    { key: "warehouse", label: "Warehouse", sortable: true },
    {
      key: "returnDate",
      label: "Return Date",
      className: "text-base-content/70",
      sortable: true,
    },
    { key: "reason", label: "Reason", sortable: true },
    {
      key: "totalItems",
      label: "Total Items",
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (returnItem: ReturnDisplay) => {
        const status =
          statusConfig[returnItem.status as keyof typeof statusConfig];
        if (!status) {
          return <span className="badge badge-outline">{returnItem.status}</span>;
        }
        return <span className={`badge ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "resolution",
      label: "Resolution",
      render: (returnItem: ReturnDisplay) => {
        if (!returnItem.resolution)
          return <span className="text-base-content/50">-</span>;
        const resolution =
          resolutionConfig[
            returnItem.resolution as keyof typeof resolutionConfig
          ];
        if (!resolution) {
          return <span className="badge badge-outline">{returnItem.resolution}</span>;
        }
        return (
          <span className={`badge ${resolution.class}`}>
            {resolution.label}
          </span>
        );
      },
      sortable: true,
    },
  ];

  const renderActions = (returnItem: ReturnDisplay) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <button onClick={() => handleRowClick(returnItem)}>
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            View Details
          </button>
        </li>
        {returnItem.status === "received" && (
          <li>
            <button onClick={() => handleInspect(returnItem)}>
              <span className="material-symbols-outlined text-sm">
                verified
              </span>
              Inspect Return
            </button>
          </li>
        )}
        {canApprove && returnItem.status === "inspecting" && (
          <li>
            <button
              onClick={async () => {
                if (confirm(`Approve return ${returnItem.returnNumber}?`)) {
                  try {
                    await returnsApi.approve(returnItem.id, admin?.id);
                    showToast.success(`Return ${returnItem.returnNumber} approved successfully`);
                    await loadData();
                  } catch (err) {
                    logger.error("Failed to approve return:", err);
                    showToast.error(err instanceof Error ? err.message : "Failed to approve return");
                  }
                }
              }}
            >
              <span className="material-symbols-outlined text-sm">
                check_circle
              </span>
              Approve Return
            </button>
          </li>
        )}
        {canApprove && returnItem.status === "inspecting" && (
          <li>
            <button
              onClick={async () => {
                const rejectionReason = prompt(
                  `Reject return ${returnItem.returnNumber}.\nEnter rejection reason:`
                );
                if (!rejectionReason || !rejectionReason.trim()) {
                  return;
                }
                const markFalseClaim = confirm(
                  "Mark this as false customer return request?"
                );
                try {
                  await returnsApi.reject(returnItem.id, {
                    rejectionReason: rejectionReason.trim(),
                    resolution: markFalseClaim ? "false_return_request" : "reject",
                    reviewedBy: admin?.id,
                  });
                  showToast.success(`Return ${returnItem.returnNumber} rejected`);
                  await loadData();
                } catch (err) {
                  logger.error("Failed to reject return:", err);
                  showToast.error(err instanceof Error ? err.message : "Failed to reject return");
                }
              }}
            >
              <span className="material-symbols-outlined text-sm">
                cancel
              </span>
              Reject Return
            </button>
          </li>
        )}
        {returnItem.status === "pending" && (
          <li>
            <button onClick={() => handleAssignWorker(returnItem)}>
              <span className="material-symbols-outlined text-sm">
                person_add
              </span>
              Assign Worker
            </button>
          </li>
        )}
        <li>
          <button
            onClick={() => {
              // TODO: Implement print functionality
              window.print();
              logger.debug("Printing return label:", returnItem.returnNumber);
            }}
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Print Return Label
          </button>
        </li>
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Returns</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage returned items and inspections
          </p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search returns..."
              className="input input-bordered w-full max-w-xs"
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
                <button onClick={() => setStatusFilter("all")}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("pending")}>
                  Pending
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("received")}>
                  Received
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("inspecting")}>
                  Inspecting
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("approved")}>
                  Approved
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("rejected")}>
                  Rejected
                </button>
              </li>
            </ul>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Register Return</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} columns={4} />

      <div className="flex gap-2">
        <button
          className={`btn btn-sm ${flowFilter === "all" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFlowFilter("all")}
        >
          All
        </button>
        <button
          className={`btn btn-sm ${flowFilter === "inbound" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFlowFilter("inbound")}
        >
          Inbound
        </button>
        <button
          className={`btn btn-sm ${flowFilter === "outbound" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFlowFilter("outbound")}
        >
          Outbound
        </button>
      </div>

      {/* Returns Table */}
      <DataTable
        data={filteredReturns}
        columns={columns}
        keyExtractor={(returnItem) => returnItem.id}
        onRowClick={handleRowClick}
        actions={renderActions}
      />

      {/* Create Return Modal */}
      {showCreateModal && (
        <CreateReturnModal onClose={() => setShowCreateModal(false)} onSuccess={loadData} />
      )}

      {/* Return Detail Modal */}
      {selectedReturn && (
        <ReturnDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReturn(null);
          }}
          returnItem={selectedReturn}
        />
      )}

      {/* Inspect Return Modal */}
      {selectedReturn && (
        <InspectReturnModal
          isOpen={showInspectModal}
          onClose={() => {
            setShowInspectModal(false);
            setSelectedReturn(null);
          }}
          onSuccess={loadData}
          returnItem={selectedReturn}
        />
      )}

      {/* Assign Worker Modal */}
      {selectedReturn && (
        <AssignWorkerModal
          isOpen={showAssignWorkerModal}
          onClose={() => {
            setShowAssignWorkerModal(false);
            setSelectedReturn(null);
          }}
          onSuccess={loadData}
          returnItem={selectedReturn}
        />
      )}
    </div>
  );
}
