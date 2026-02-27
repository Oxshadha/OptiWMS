"use client";

import { useEffect, useState } from "react";
import { Pagination } from "@/components/Pagination";
import { packingApi, PackingRecord as ApiPackingRecord } from "@/lib/api/packing";
import { ordersApi } from "@/lib/api/orders";
import { customersApi } from "@/lib/api/customers";
import { warehousesApi } from "@/lib/api/warehouses";
import { usersApi, type User } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { mapPackingStatus } from "@/lib/utils/status-mappers";
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
  const [viewMode, setViewMode] = useState<"queue" | "monitor" | "history">("queue");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [packingRecords, setPackingRecords] = useState<PackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRecordForAssign, setSelectedRecordForAssign] = useState<PackingRecord | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<User[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [recordsPage, ordersData, customersData, warehousesData, workers] = await Promise.all([
        packingApi.getPaged({
          page: currentPage - 1,
          size: itemsPerPage,
          sortBy: "createdAt",
          sortDir: "desc",
          status: statusFilter === "all" ? undefined : statusFilter,
          q: searchQuery.trim() || undefined,
        }),
        ordersApi.getAllOutbound(),
        customersApi.getAll(),
        warehousesApi.getAll(),
        usersApi.getAll("worker"),
      ]);

      setAvailableWorkers(workers);

      const customersMap = buildLookupMap(customersData, (customer) => customer.id, (customer) => customer.name);
      const warehousesMap = buildLookupMap(warehousesData, (warehouse) => warehouse.id, (warehouse) => warehouse.name);
      const usersMap = buildLookupMap(
        workers,
        (worker) => worker.id,
        (worker) => `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || worker.username
      );

      const ordersMap = buildLookupMap(
        ordersData,
        (order) => order.id,
        (order) => ({
          customerName: order.customerId ? getLookupValue(customersMap, order.customerId, "Unknown") : "Unknown",
          warehouseName: getLookupValue(warehousesMap, order.warehouseId, "Unknown"),
          priority: (order.priority?.toLowerCase() === "express" ? "express" : "normal") as "express" | "normal",
        })
      );

      const recordsFromPacking = recordsPage.data.map((record) =>
        mapApiPackingRecord(record, ordersMap, usersMap)
      );

      setPackingRecords(recordsFromPacking);
      setTotalItems(recordsPage.totalElements);
      setTotalPages(Math.max(recordsPage.totalPages, 1));
    } catch (err) {
      logger.error("Failed to load packing records:", err);
      setError(err instanceof Error ? err.message : "Failed to load packing records");
      setPackingRecords([]);
      showToast.error("Failed to load packing records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentPage, itemsPerPage, statusFilter, searchQuery]);

  const pendingOrders = packingRecords.filter((record) => record.status === "pending");
  const inProgressOrders = packingRecords.filter((record) => record.status === "in_progress");
  const packedOrders = packingRecords.filter((record) => record.status === "packed");
  const historyOrders = packingRecords.filter((record) => record.status === "packed" || record.status === "shipped");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
      await loadData();
    } catch (err) {
      logger.error("Failed to assign packer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to assign packer");
    }
  };

  const handlePrintLabel = (record: PackingRecord) => {
    showToast.warning(`Printing label for ${record.orderNumber}...`);
  };

  const handlePrintSlip = (record: PackingRecord) => {
    showToast.warning(`Printing slip for ${record.orderNumber}...`);
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
        pendingCount={pendingOrders.length}
        inProgressCount={inProgressOrders.length}
        packedCount={packedOrders.length}
        totalCount={totalItems}
      />

      <PackingViews
        viewMode={viewMode}
        pendingOrders={pendingOrders}
        inProgressOrders={inProgressOrders}
        historyOrders={historyOrders}
        onViewDetails={handleViewDetails}
        onAssignPacker={handleAssignPacker}
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
