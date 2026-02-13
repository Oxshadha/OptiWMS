"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
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

function derivePackReference(orderNumber?: string): string {
  const normalized = (orderNumber || "").trim().toUpperCase();
  if (!normalized) return `PACK-${Date.now()}`;
  if (normalized.startsWith("OUT-")) {
    return `PACK-${normalized.substring(4)}`;
  }
  return `PACK-${normalized.replace(/^OUT/, "").replace(/^-+/, "")}`;
}

function mapOrderToFallbackPackingRecord(
  order: {
    id: string;
    orderNumber: string;
    customerId?: string;
    warehouseId: string;
    priority: string;
    status: string;
    orderDate?: string;
  },
  customersMap: Map<string, string>,
  warehousesMap: Map<string, string>
): PackingRecord | null {
  const orderStatus = (order.status || "").toLowerCase();
  let status: PackingStatus | null = null;
  if (orderStatus === "packing") status = "in_progress";
  else if (orderStatus === "ready_to_ship") status = "packed";
  else if (orderStatus === "shipped") status = "shipped";
  if (!status) return null;

  const createdAt = order.orderDate || new Date().toISOString();
  return {
    id: `fallback-${order.id}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: order.customerId ? getLookupValue(customersMap, order.customerId, "Unknown") : "Unknown",
    priority: (order.priority?.toLowerCase() === "express" ? "express" : "normal") as "express" | "normal",
    packagingType: "",
    actualWeight: 0,
    dimensionalWeight: 0,
    chargeableWeight: 0,
    trackingNumber: derivePackReference(order.orderNumber),
    status,
    startedAt: status === "in_progress" ? createdAt : undefined,
    completedAt: status === "packed" || status === "shipped" ? createdAt : undefined,
    createdAt,
    warehouseName: getLookupValue(warehousesMap, order.warehouseId, "Unknown"),
  };
}

export default function PackingPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PackingRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PackingStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"queue" | "monitor" | "history">("queue");

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

      const [recordsData, ordersData, customersData, warehousesData, workers] = await Promise.all([
        packingApi.getAll(),
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

      const recordsFromPacking = recordsData.map((record) => mapApiPackingRecord(record, ordersMap, usersMap));
      const existingOrderKeys = new Set(
        recordsFromPacking.map((record) => `${record.orderId || ""}|${record.orderNumber || ""}`)
      );
      const fallbackRecords = ordersData
        .map((order) => mapOrderToFallbackPackingRecord(order, customersMap, warehousesMap))
        .filter((record): record is PackingRecord => !!record)
        .filter((record) => !existingOrderKeys.has(`${record.orderId}|${record.orderNumber}`));

      setPackingRecords([...recordsFromPacking, ...fallbackRecords]);
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
  }, []);

  const packingRecordsForWarehouse =
    isWarehouseManager && assignedWarehouseName
      ? packingRecords.filter((record) => record.warehouseName === assignedWarehouseName)
      : packingRecords;

  const filteredRecords = packingRecordsForWarehouse.filter((record) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      record.orderNumber.toLowerCase().includes(query) ||
      record.customer.toLowerCase().includes(query) ||
      record.trackingNumber?.toLowerCase().includes(query);

    const matchesStatus = statusFilter === "all" || record.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingOrders = filteredRecords.filter((record) => record.status === "pending");
  const inProgressOrders = filteredRecords.filter((record) => record.status === "in_progress");
  const packedOrders = filteredRecords.filter((record) => record.status === "packed");
  const historyOrders = filteredRecords.filter((record) => record.status === "packed" || record.status === "shipped");

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
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
      />

      <div className="tabs tabs-boxed">
        <button className={`tab ${viewMode === "queue" ? "tab-active" : ""}`} onClick={() => setViewMode("queue")}>
          Packing Queue
        </button>
        <button className={`tab ${viewMode === "monitor" ? "tab-active" : ""}`} onClick={() => setViewMode("monitor")}>
          Monitor
        </button>
        <button className={`tab ${viewMode === "history" ? "tab-active" : ""}`} onClick={() => setViewMode("history")}>
          History
        </button>
      </div>

      <PackingStats
        pendingCount={pendingOrders.length}
        inProgressCount={inProgressOrders.length}
        packedCount={packedOrders.length}
        totalCount={packingRecordsForWarehouse.length}
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
