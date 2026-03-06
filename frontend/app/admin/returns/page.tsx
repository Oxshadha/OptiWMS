"use client";

import { useMemo, useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip } from "@/components/StatusChip";
import Link from "next/link";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { returnsApi } from "@/lib/api/returns";
import { ordersApi } from "@/lib/api/orders";
import {
  useInvalidateAdminList,
  usePagedAdminQuery,
  useReferenceCustomers,
  useReferenceSuppliers,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { logger } from "@/lib/utils/logger";
import { downloadHtmlDocument, escapeHtml } from "@/lib/utils/documents";
import type { ReturnDisplay } from "./types";
import { resolutionConfig, statusConfig } from "./types";
import {
  AssignWorkerModal,
  CreateReturnModal,
  InspectReturnModal,
  ReturnDetailModal,
} from "./components/ReturnModals";

const RESOLUTION_VISIBLE_STATUSES = new Set([
  "approved",
  "rejected",
  "restocked",
  "disposed",
]);

export default function ReturnsPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showAssignWorkerModal, setShowAssignWorkerModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnDisplay | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flowFilter, setFlowFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canApprove = hasPermission(ADMIN_ROUTES.RETURNS, "approve");

  const returnsQuery = usePagedAdminQuery({
    queryKey: [
      "admin-returns",
      currentPage,
      itemsPerPage,
      searchQuery.trim() || "",
      statusFilter,
      flowFilter,
      isWarehouseManager ? assignedWarehouseId || "assigned" : "all",
    ],
    queryFn: async () => {
      const returnsPage = await returnsApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "createdAt",
        sortDir: "desc",
        warehouseId: isWarehouseManager ? assignedWarehouseId : undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        returnFlow: flowFilter === "all" ? undefined : flowFilter,
        q: searchQuery.trim() || undefined,
      });

      const orderIds = Array.from(
        new Set(
          returnsPage.data
            .map((ret) => ret.originalOrderId)
            .filter((value): value is string => !!value)
        )
      );

      const orderEntries = await Promise.all(
        orderIds.map(async (id) => {
          try {
            const order = await ordersApi.getById(id);
            return [id, order] as const;
          } catch {
            return null;
          }
        })
      );

      const ordersMap = new Map<string, Awaited<ReturnType<typeof ordersApi.getById>>>();
      for (const entry of orderEntries) {
        if (!entry) continue;
        ordersMap.set(entry[0], entry[1]);
      }

      return {
        page: returnsPage,
        ordersMap,
      };
    },
  });

  const warehousesQuery = useReferenceWarehouses();
  const customersQuery = useReferenceCustomers();
  const suppliersQuery = useReferenceSuppliers();
  const invalidateReturnsList = useInvalidateAdminList(["admin-returns"]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (returnsQuery.error instanceof Error && !returnsQuery.error.message.includes("Not authenticated")) {
      showToast.error("Failed to load returns. Please try again.");
    }
  }, [returnsQuery.error]);

  const returns = useMemo<ReturnDisplay[]>(() => {
    const warehousesMap = buildLookupMap(
      warehousesQuery.data || [],
      (warehouse) => warehouse.id,
      (warehouse) => warehouse.name
    );
    const customersMap = new Map(
      (customersQuery.data || []).map((customer) => [customer.id, customer.name] as const)
    );
    const suppliersMap = new Map(
      (suppliersQuery.data || []).map((supplier) => [supplier.id, supplier.name] as const)
    );

    return (returnsQuery.data?.page.data || []).map((ret) => {
      const warehouseName = ret.warehouseId
        ? getLookupValue(warehousesMap, ret.warehouseId, "Unknown")
        : "Unknown";
      const orderInfo = ret.originalOrderId
        ? returnsQuery.data?.ordersMap.get(ret.originalOrderId) || null
        : null;
      const orderNumber = orderInfo?.orderNumber || ret.originalOrderId || "N/A";
      const orderType = orderInfo?.orderType || null;
      const returnFlow =
        ret.returnFlow === "inbound" || ret.returnFlow === "outbound"
          ? ret.returnFlow
          : orderType === "inbound" || orderType === "outbound"
            ? orderType
            : "unknown";
      const customerId = ret.customerId || orderInfo?.customerId || null;
      const supplierId = orderInfo?.supplierId || null;
      const counterpartyType =
        returnFlow === "inbound"
          ? "supplier"
          : returnFlow === "outbound"
            ? "customer"
            : "unknown";
      const counterpartyName =
        counterpartyType === "supplier"
          ? supplierId
            ? suppliersMap.get(supplierId) || "Unknown Supplier"
            : "Unknown Supplier"
          : counterpartyType === "customer"
            ? customerId
              ? customersMap.get(customerId) || "Unknown Customer"
              : "Unknown Customer"
            : "Unknown";
      const customerName = customerId
        ? customersMap.get(customerId) || counterpartyName
        : counterpartyName;

      return {
        id: ret.id,
        returnNumber: ret.returnNumber,
        originalOrderId: ret.originalOrderId || null,
        originalOrder: orderNumber,
        originalOrderType: orderType,
        returnFlow,
        customerName,
        counterpartyName,
        counterpartyType,
        warehouseId: ret.warehouseId || null,
        warehouse: warehouseName,
        returnDate: ret.returnDate || new Date().toISOString().split("T")[0],
        reason: ret.reason || "N/A",
        totalItems: 0,
        status: ret.status || "pending",
        resolution: ret.resolution || null,
        receivedBy: ret.receivedBy || null,
        inspectedBy: ret.inspectedBy || null,
      };
    });
  }, [customersQuery.data, returnsQuery.data, suppliersQuery.data, warehousesQuery.data]);

  const loading =
    (returnsQuery.isPending && !returnsQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data) ||
    (customersQuery.isPending && !customersQuery.data) ||
    (suppliersQuery.isPending && !suppliersQuery.data);
  const isFetching =
    returnsQuery.isFetching ||
    warehousesQuery.isFetching ||
    customersQuery.isFetching ||
    suppliersQuery.isFetching;
  const error =
    returnsQuery.error || warehousesQuery.error || customersQuery.error || suppliersQuery.error
      ? "Failed to load returns"
      : null;
  const totalItems = returnsQuery.data?.page.totalElements ?? 0;
  const totalPages = Math.max(returnsQuery.data?.page.totalPages ?? 1, 1);
  const reload = async () => {
    try {
      await invalidateReturnsList();
    } catch (err) {
      logger.error("Failed to reload returns:", err);
    }
  };

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
      value: totalItems,
      icon: "keyboard_return",
      color: "primary" as const,
    },
    {
      label: "Inbound Returns",
      value: returns.filter((r) => r.returnFlow === "inbound").length,
      icon: "move_to_inbox",
      color: "info" as const,
    },
    {
      label: "Outbound Returns",
      value: returns.filter((r) => r.returnFlow === "outbound").length,
      icon: "outbox",
      color: "success" as const,
    },
    {
      label: "Pending Inspection",
      value: returns.filter(
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
        <StatusChip
          label={
            returnItem.returnFlow === "inbound"
              ? "Inbound"
              : returnItem.returnFlow === "outbound"
                ? "Outbound"
                : "Unknown"
          }
          tone={
            returnItem.returnFlow === "inbound"
              ? "info"
              : returnItem.returnFlow === "outbound"
                ? "success"
                : "neutral"
          }
        />
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
    {
      key: "counterpartyName",
      label: "Counterparty",
      render: (returnItem: ReturnDisplay) => (
        <span>
          {returnItem.counterpartyName}
          <span className="text-xs text-base-content/50 ml-2">
            ({returnItem.counterpartyType === "supplier" ? "Supplier" : returnItem.counterpartyType === "customer" ? "Customer" : "Unknown"})
          </span>
        </span>
      ),
      sortable: true,
    },
    { key: "warehouse", label: "Warehouse", sortable: true },
    {
      key: "returnDate",
      label: "Return Date",
      className: "text-base-content/70",
      sortable: true,
    },
    { key: "reason", label: "Reason", sortable: true },
    {
      key: "status",
      label: "Status",
      render: (returnItem: ReturnDisplay) => {
        const status =
          statusConfig[returnItem.status as keyof typeof statusConfig];
        if (!status) {
          return <StatusChip label={returnItem.status} tone="neutral" />;
        }
        return <StatusChip label={status.label} tone={status.tone} showDot />;
      },
      sortable: true,
    },
    {
      key: "resolution",
      label: "Resolution",
      render: (returnItem: ReturnDisplay) => {
        const shouldShowResolution =
          !!returnItem.resolution &&
          RESOLUTION_VISIBLE_STATUSES.has(returnItem.status);
        if (!shouldShowResolution)
          return <span className="text-base-content/50">-</span>;
        const resolution =
          resolutionConfig[
            returnItem.resolution as keyof typeof resolutionConfig
          ];
        if (!resolution) {
          return <StatusChip label={returnItem.resolution ?? "Unknown"} tone="neutral" />;
        }
        return <StatusChip label={resolution.label} tone={resolution.tone} />;
      },
      sortable: true,
    },
  ];

  const renderActions = (returnItem: ReturnDisplay) => {
    const normalizedStatus = (returnItem.status || "").trim().toLowerCase();
    return (
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
        {normalizedStatus === "received" && (
          <li>
            <button onClick={() => handleInspect(returnItem)}>
              <span className="material-symbols-outlined text-sm">
                verified
              </span>
              Inspect Return
            </button>
          </li>
        )}
        {canApprove && normalizedStatus === "inspecting" && (
          <li>
            <button
              onClick={async () => {
                if (confirm(`Approve return ${returnItem.returnNumber}?`)) {
                  try {
                    await returnsApi.approve(returnItem.id, admin?.id);
                    showToast.success(`Return ${returnItem.returnNumber} approved successfully`);
                    await reload();
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
        {canApprove && normalizedStatus === "inspecting" && (
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
                  await reload();
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
        {normalizedStatus === "pending" && (
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
              downloadHtmlDocument(
                `return-label-${returnItem.returnNumber}.html`,
                `Return Label ${returnItem.returnNumber}`,
                `
                  <h1>Return Label</h1>
                  <p class="muted">Generated from OptiWMS</p>
                  <div class="grid section">
                    <div class="card"><strong>Return Number:</strong><br />${escapeHtml(returnItem.returnNumber)}</div>
                    <div class="card"><strong>Status:</strong><br />${escapeHtml(returnItem.status)}</div>
                    <div class="card"><strong>Flow:</strong><br />${escapeHtml(returnItem.returnFlow || "N/A")}</div>
                    <div class="card"><strong>Reference:</strong><br />${escapeHtml(returnItem.originalOrder || "N/A")}</div>
                  </div>
                  <div class="section">
                    <h2>Reason</h2>
                    <p>${escapeHtml(returnItem.reason || "Not provided")}</p>
                  </div>
                `
              );
              logger.debug("Printing return label:", returnItem.returnNumber);
            }}
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Download Return Label
          </button>
        </li>
      </ul>
    </div>
    );
  };

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
          {isFetching && (
            <div className="flex items-center text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              Updating...
            </div>
          )}
          <div className="form-control">
            <input
              type="text"
              placeholder="Search returns..."
              className="input input-bordered w-full max-w-xs"
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
                }}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("pending");
                  setCurrentPage(1);
                }}>
                  Pending
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("received");
                  setCurrentPage(1);
                }}>
                  Received
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("inspecting");
                  setCurrentPage(1);
                }}>
                  Inspecting
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("approved");
                  setCurrentPage(1);
                }}>
                  Approved
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("rejected");
                  setCurrentPage(1);
                }}>
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
          onClick={() => {
            setFlowFilter("all");
            setCurrentPage(1);
          }}
        >
          All
        </button>
        <button
          className={`btn btn-sm ${flowFilter === "inbound" ? "btn-primary" : "btn-outline"}`}
          onClick={() => {
            setFlowFilter("inbound");
            setCurrentPage(1);
          }}
        >
          Inbound
        </button>
        <button
          className={`btn btn-sm ${flowFilter === "outbound" ? "btn-primary" : "btn-outline"}`}
          onClick={() => {
            setFlowFilter("outbound");
            setCurrentPage(1);
          }}
        >
          Outbound
        </button>
      </div>

      {/* Returns Table */}
      <DataTable
        data={returns}
        columns={columns}
        keyExtractor={(returnItem) => returnItem.id}
        onRowClick={handleRowClick}
        actions={renderActions}
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

      {/* Create Return Modal */}
      {showCreateModal && (
        <CreateReturnModal onClose={() => setShowCreateModal(false)} onSuccess={reload} />
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
          onSuccess={reload}
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
          onSuccess={reload}
          returnItem={selectedReturn}
        />
      )}
    </div>
  );
}
