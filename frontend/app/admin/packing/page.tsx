"use client";

import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/Pagination";
import { packingApi, PackingRecord as ApiPackingRecord } from "@/lib/api/packing";
import { ordersApi } from "@/lib/api/orders";
import { type User } from "@/lib/api/users";
import {
  useInvalidateAdminList,
  usePagedAdminQuery,
  useReferenceCustomers,
  useReferenceUsers,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { mapPackingStatus } from "@/lib/utils/status-mappers";
import { downloadHtmlDocument, escapeHtml } from "@/lib/utils/documents";
import { logger } from "@/lib/utils/logger";
import { PackingHeader } from "./components/PackingHeader";
import { PackingStats } from "./components/PackingStats";
import { PackingViews } from "./components/PackingViews";
import { PackingModals } from "./components/PackingModals";
import type { PackingRecord, PackingStatus } from "./types";

function parseBoxDimensions(boxDimensions?: string): PackingRecord["boxDimensions"] {
  if (!boxDimensions) {
    return undefined;
  }

  try {
    const dimensions = JSON.parse(boxDimensions) as {
      length?: number;
      width?: number;
      height?: number;
    };

    if (dimensions.length && dimensions.width && dimensions.height) {
      return {
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
      };
    }
  } catch {
    // Ignore malformed dimensions from API payloads.
  }

  return undefined;
}

function mapApiPackingRecord(
  record: ApiPackingRecord,
  ordersMap: Map<string, { customerName: string; warehouseName: string; priority: "normal" | "express" }>,
  usersMap: Map<string, string>
): PackingRecord {
  const orderInfo = record.orderId ? ordersMap.get(record.orderId) : null;
  const status = mapPackingStatus(record.status) as PackingStatus;

  return {
    id: record.id,
    orderId: record.orderId || "",
    orderNumber: record.orderNumber || "N/A",
    customer: orderInfo?.customerName || "Unknown",
    priority: orderInfo?.priority || "normal",
    packagingType: record.boxType || "",
    boxDimensions: parseBoxDimensions(record.boxDimensions),
    actualWeight: record.actualWeightKg ? parseFloat(record.actualWeightKg) : 0,
    dimensionalWeight: record.dimensionalWeightKg ? parseFloat(record.dimensionalWeightKg) : 0,
    chargeableWeight: record.chargeableWeightKg ? parseFloat(record.chargeableWeightKg) : 0,
    trackingNumber: record.trackingNumber,
    packerId: record.packerId,
    packerName: record.packerId ? usersMap.get(record.packerId) : undefined,
    status,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    createdAt: record.startedAt || new Date().toISOString(),
    warehouseName: orderInfo?.warehouseName,
  };
}

export default function PackingPage() {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PackingRecord | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PackingStatus | "all">("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"queue" | "monitor" | "history">("queue");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRecordForAssign, setSelectedRecordForAssign] = useState<PackingRecord | null>(null);
  const packingQuery = usePagedAdminQuery({
    queryKey: ["admin-packing", currentPage, itemsPerPage, statusFilter, searchQuery],
    queryFn: async () => {
      const recordsPage = await packingApi.getPaged({
          page: currentPage - 1,
          size: itemsPerPage,
          sortBy: "createdAt",
          sortDir: "desc",
          status: statusFilter === "all" ? undefined : statusFilter,
          q: searchQuery.trim() || undefined,
        });
      const ordersData = await ordersApi.getAllOutbound();
      return {
        recordsPage,
        ordersData,
      };
    },
  });
  const customersQuery = useReferenceCustomers();
  const warehousesQuery = useReferenceWarehouses();
  const usersQuery = useReferenceUsers();
  const reload = useInvalidateAdminList(["admin-packing"]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const availableWorkers = useMemo(
    () => ((usersQuery.data || []).filter((user) => user.role?.toLowerCase() === "worker") as User[]),
    [usersQuery.data]
  );

  const packingRecords = useMemo<PackingRecord[]>(() => {
    if (!packingQuery.data) return [];

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
    const usersMap = buildLookupMap(
      availableWorkers,
      (worker) => worker.id,
      (worker) => `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || worker.username
    );
    const ordersMap = buildLookupMap(
      packingQuery.data.ordersData,
      (order) => order.id,
      (order) => ({
        customerName: order.customerId ? getLookupValue(customersMap, order.customerId, "Unknown") : "Unknown",
        warehouseName: getLookupValue(warehousesMap, order.warehouseId, "Unknown"),
        priority: (order.priority?.toLowerCase() === "express" ? "express" : "normal") as "express" | "normal",
      })
    );

    return packingQuery.data.recordsPage.data.map((record) =>
      mapApiPackingRecord(record, ordersMap, usersMap)
    );
  }, [availableWorkers, customersQuery.data, packingQuery.data, warehousesQuery.data]);

  const loading =
    (packingQuery.isPending && !packingQuery.data) ||
    (customersQuery.isPending && !customersQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data) ||
    (usersQuery.isPending && !usersQuery.data);
  const error =
    packingQuery.error || customersQuery.error || warehousesQuery.error || usersQuery.error
      ? packingQuery.error instanceof Error
        ? packingQuery.error.message
        : "Failed to load packing records"
      : null;
  const totalItems = packingQuery.data?.recordsPage.totalElements ?? 0;
  const totalPages = Math.max(packingQuery.data?.recordsPage.totalPages ?? 1, 1);

  const awaitingApprovalOrders = packingRecords.filter(
    (record) => record.status === "pending_approval"
  );
  const pendingOrders = packingRecords.filter((record) => record.status === "pending");
  const inProgressOrders = packingRecords.filter((record) => record.status === "in_progress");
  const packedOrders = packingRecords.filter((record) => record.status === "packed");
  const historyOrders = packingRecords.filter((record) => record.status === "packed" || record.status === "shipped");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && packingRecords.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading packing records: {error}</span>
      </div>
    );
  }

  /**
   * Release a packing job to the floor.
   *
   * Approval is what raises the packer's task, so the order only becomes visible to the packing
   * app at this point -- not when picking finished.
   */
  const handleApprove = async (record: PackingRecord) => {
    setApprovingId(record.id);
    try {
      await packingApi.approve(record.id);
      showToast.success(`${record.orderNumber} released for packing`);
      await packingQuery.refetch();
    } catch (err) {
      logger.error("Failed to approve packing job:", err);
      showToast.error("Could not approve this packing job");
    } finally {
      setApprovingId(null);
    }
  };

  const handleViewDetails = (record: PackingRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const handleAssignPacker = (record: PackingRecord) => {
    setSelectedRecordForAssign(record);
    setShowAssignModal(true);
  };

  const handleConfirmAssign = async (packerId: string) => {
    if (!selectedRecordForAssign) {
      return;
    }

    try {
      await packingApi.update(selectedRecordForAssign.id, { packerId });
      showToast.success("Packer assigned successfully");
      setShowAssignModal(false);
      setSelectedRecordForAssign(null);
      await reload();
    } catch (err) {
      logger.error("Failed to assign packer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to assign packer");
    }
  };

  const handlePrintLabel = (record: PackingRecord) => {
    downloadHtmlDocument(
      `${record.orderNumber}-shipping-label.html`,
      `Shipping Label - ${record.orderNumber}`,
      `
        <h1>Shipping Label</h1>
        <p class="muted">Packing reference for outbound shipment handoff</p>
        <div class="section grid">
          <div class="card"><strong>Order</strong><br />${escapeHtml(record.orderNumber)}</div>
          <div class="card"><strong>Customer</strong><br />${escapeHtml(record.customer)}</div>
          <div class="card"><strong>Priority</strong><br />${escapeHtml(record.priority.toUpperCase())}</div>
          <div class="card"><strong>Warehouse</strong><br />${escapeHtml(record.warehouseName || "N/A")}</div>
          <div class="card"><strong>Tracking</strong><br />${escapeHtml(record.trackingNumber || "Pending")}</div>
          <div class="card"><strong>Chargeable Weight</strong><br />${record.chargeableWeight || 0} kg</div>
        </div>
      `
    );
    showToast.success(`Shipping label downloaded for ${record.orderNumber}`);
  };

  const handlePrintSlip = (record: PackingRecord) => {
    downloadHtmlDocument(
      `${record.orderNumber}-packing-slip.html`,
      `Packing Slip - ${record.orderNumber}`,
      `
        <h1>Packing Slip</h1>
        <p class="muted">Operational packing summary</p>
        <div class="section grid">
          <div class="card"><strong>Order</strong><br />${escapeHtml(record.orderNumber)}</div>
          <div class="card"><strong>Status</strong><br />${escapeHtml(record.status.replace("_", " ").toUpperCase())}</div>
          <div class="card"><strong>Packaging</strong><br />${escapeHtml(record.packagingType || "Not selected")}</div>
          <div class="card"><strong>Packer</strong><br />${escapeHtml(record.packerName || "Unassigned")}</div>
          <div class="card"><strong>Actual Weight</strong><br />${record.actualWeight || 0} kg</div>
          <div class="card"><strong>Dimensional Weight</strong><br />${record.dimensionalWeight || 0} kg</div>
        </div>
      `
    );
    showToast.success(`Packing slip downloaded for ${record.orderNumber}`);
  };

  return (
    <div className="space-y-6">
      <PackingHeader
        searchQuery={searchInput}
        statusFilter={statusFilter}
        onSearchChange={setSearchInput}
        onStatusFilterChange={(status) => {
          setStatusFilter(status);
          setCurrentPage(1);
        }}
      />

      <div className="tabs tabs-boxed">
        <button className={`tab ${viewMode === "queue" ? "tab-active" : ""}`} onClick={() => { setViewMode("queue"); setCurrentPage(1); }}>
          Packing Queue
        </button>
        <button className={`tab ${viewMode === "monitor" ? "tab-active" : ""}`} onClick={() => { setViewMode("monitor"); setCurrentPage(1); }}>
          Monitor
        </button>
        <button className={`tab ${viewMode === "history" ? "tab-active" : ""}`} onClick={() => { setViewMode("history"); setCurrentPage(1); }}>
          History
        </button>
      </div>

      <PackingStats
        awaitingApprovalCount={awaitingApprovalOrders.length}
        pendingCount={pendingOrders.length}
        inProgressCount={inProgressOrders.length}
        packedCount={packedOrders.length}
        totalCount={totalItems}
      />

      <PackingViews
        viewMode={viewMode}
        awaitingApprovalOrders={awaitingApprovalOrders}
        pendingOrders={pendingOrders}
        inProgressOrders={inProgressOrders}
        historyOrders={historyOrders}
        onViewDetails={handleViewDetails}
        onAssignPacker={handleAssignPacker}
        onApprove={handleApprove}
        approvingId={approvingId}
        onPrintLabel={handlePrintLabel}
        onPrintSlip={handlePrintSlip}
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

      <PackingModals
        selectedRecord={selectedRecord}
        showDetailModal={showDetailModal}
        onCloseDetails={() => setShowDetailModal(false)}
        onPrintLabel={handlePrintLabel}
        onPrintSlip={handlePrintSlip}
        showAssignModal={showAssignModal}
        selectedRecordForAssign={selectedRecordForAssign}
        availableWorkers={availableWorkers}
        onCloseAssign={() => {
          setShowAssignModal(false);
          setSelectedRecordForAssign(null);
        }}
        onConfirmAssign={handleConfirmAssign}
      />
    </div>
  );
}
