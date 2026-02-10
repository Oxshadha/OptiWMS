"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { operationsApi } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { materialsApi } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { StockTransferHeader } from "./components/StockTransferHeader";
import { StockTransferStats } from "./components/StockTransferStats";
import { StockTransferTable } from "./components/StockTransferTable";
import { StockTransferDetailModal } from "./components/StockTransferDetailModal";
import type { StockTransfer, TransferStatus, TransferType } from "./types";

export default function StockTransfersPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TransferType | "all">("all");

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [transfersData, warehousesData, materialsData] = await Promise.all([
        operationsApi.getStockTransfers(),
        warehousesApi.getAll(),
        materialsApi.getAll(),
      ]);

      const warehouseMap = new Map<string, string>();
      warehousesData.forEach((warehouse) => warehouseMap.set(warehouse.id, warehouse.name));

      const materialMap = new Map<string, { name: string; sku: string }>();
      materialsData.forEach((material) => {
        materialMap.set(material.id, {
          name: material.description || "Unknown",
          sku: material.materialCode || material.id,
        });
      });

      const displayTransfers: StockTransfer[] = transfersData.map((transfer) => {
        const material = materialMap.get(transfer.materialId) || { name: "Unknown", sku: "N/A" };
        const sourceWarehouse = warehouseMap.get(transfer.sourceWarehouseId);
        const destWarehouse = warehouseMap.get(transfer.destWarehouseId);

        const isIntraWarehouse =
          transfer.transferType === "intra_warehouse" || transfer.sourceWarehouseId === transfer.destWarehouseId;

        return {
          id: transfer.id,
          transferNumber: transfer.transferNumber,
          transferType: isIntraWarehouse ? "intra_warehouse" : "inter_warehouse",
          sourceWarehouse: isIntraWarehouse ? undefined : sourceWarehouse,
          sourceLocationCode: transfer.sourceLocationCode,
          destWarehouse: isIntraWarehouse ? undefined : destWarehouse,
          destLocationCode: transfer.destLocationCode,
          itemSku: material.sku,
          itemName: material.name,
          quantity: parseInt(transfer.quantity) || 0,
          status: (transfer.status as TransferStatus) || "draft",
          notes: transfer.notes,
          createdAt: new Date().toISOString(),
        };
      });

      setTransfers(displayTransfers);
    } catch (err) {
      logger.error("Failed to load stock transfers:", err);
      setError(err instanceof Error ? err.message : "Failed to load stock transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const transfersForWarehouse =
    isWarehouseManager && assignedWarehouseName
      ? transfers.filter(
          (transfer) =>
            transfer.sourceWarehouse === assignedWarehouseName ||
            transfer.destWarehouse === assignedWarehouseName ||
            (!transfer.sourceWarehouse && !transfer.destWarehouse)
        )
      : transfers;

  const filteredTransfers = transfersForWarehouse.filter((transfer) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      transfer.transferNumber.toLowerCase().includes(query) ||
      transfer.itemSku.toLowerCase().includes(query) ||
      transfer.itemName.toLowerCase().includes(query) ||
      transfer.sourceLocationCode.toLowerCase().includes(query) ||
      transfer.destLocationCode.toLowerCase().includes(query);

    const matchesStatus = statusFilter === "all" || transfer.status === statusFilter;
    const matchesType = typeFilter === "all" || transfer.transferType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalTransfers = transfersForWarehouse.length;
  const inTransitCount = transfersForWarehouse.filter((transfer) => transfer.status === "in_transit").length;
  const receivedCount = transfersForWarehouse.filter((transfer) => transfer.status === "received").length;
  const pendingCount = transfersForWarehouse.filter((transfer) => transfer.status === "draft").length;

  const handleViewDetails = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setShowDetailModal(true);
  };

  const handleCancelTransfer = async (transfer: StockTransfer) => {
    if (!confirm(`Are you sure you want to cancel transfer ${transfer.transferNumber}?`)) {
      return;
    }

    try {
      await operationsApi.cancelStockTransfer(transfer.id);
      showToast.success("Transfer cancelled successfully");
      await loadData();
    } catch (err) {
      logger.error("Failed to cancel transfer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to cancel transfer");
    }
  };

  const handlePrintTransferSlip = (transfer: StockTransfer) => {
    showToast.warning(`Printing transfer slip: ${transfer.transferNumber}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading stock transfers: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StockTransferHeader
        totalTransfers={totalTransfers}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
      />

      <StockTransferStats
        totalTransfers={totalTransfers}
        inTransitCount={inTransitCount}
        receivedCount={receivedCount}
        pendingCount={pendingCount}
      />

      <StockTransferTable
        transfers={filteredTransfers}
        onViewDetails={handleViewDetails}
        onCancelTransfer={handleCancelTransfer}
        onPrintSlip={handlePrintTransferSlip}
      />

      <StockTransferDetailModal
        transfer={selectedTransfer}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onCancelTransfer={handleCancelTransfer}
        onPrintSlip={handlePrintTransferSlip}
      />
    </div>
  );
}
