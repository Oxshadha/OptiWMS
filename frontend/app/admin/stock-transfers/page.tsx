"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { Pagination } from "@/components/Pagination";
import { operationsApi } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { materialsApi } from "@/lib/api/materials";
import { usersApi, User } from "@/lib/api/users";
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
  const assignedWarehouseId = admin?.warehouseId;

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TransferType | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; materialCode?: string; description?: string }>>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    transferType: "intra_warehouse" as TransferType,
    notes: "",
    lines: [
      {
        materialId: "",
        sourceWarehouseId: "",
        sourceLocationCode: "",
        destWarehouseId: "",
        destLocationCode: "",
        quantity: "1",
        assignedWorkerId: "",
      },
    ],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [transfersPage, warehousesData, materialsData, workersData] = await Promise.all([
        operationsApi.getStockTransfersPaged({
          page: currentPage - 1,
          size: itemsPerPage,
          sortBy: "createdAt",
          sortDir: "desc",
          warehouseId: isWarehouseManager ? assignedWarehouseId : undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          transferType: typeFilter === "all" ? undefined : typeFilter,
          q: searchQuery.trim() || undefined,
        }),
        warehousesApi.getAll(),
        materialsApi.getAll(),
        usersApi.getAll(undefined, undefined, "active"),
      ]);

      const warehouseMap = new Map<string, string>();
      warehousesData.forEach((warehouse) => warehouseMap.set(warehouse.id, warehouse.name));
      setWarehouses(warehousesData.map((warehouse) => ({ id: warehouse.id, name: warehouse.name })));
      setMaterials(materialsData);
      setWorkers(workersData.filter((u) => u.role === "worker" || u.role === "forklift_operator" || u.role === "warehouse_worker"));

      const materialMap = new Map<string, { name: string; sku: string }>();
      materialsData.forEach((material) => {
        materialMap.set(material.id, {
          name: material.description || "Unknown",
          sku: material.materialCode || material.id,
        });
      });

      const displayTransfers: StockTransfer[] = transfersPage.data.map((transfer) => {
        const firstLine = transfer.lines?.[0];
        const materialId = firstLine?.materialId || transfer.materialId || "";
        const sourceWarehouseId = firstLine?.sourceWarehouseId || transfer.sourceWarehouseId || "";
        const destWarehouseId = firstLine?.destWarehouseId || transfer.destWarehouseId || "";
        const material = materialMap.get(materialId) || { name: "Unknown", sku: "N/A" };
        const sourceWarehouse = warehouseMap.get(sourceWarehouseId);
        const destWarehouse = warehouseMap.get(destWarehouseId);

        const isIntraWarehouse =
          transfer.transferType === "intra_warehouse" || transfer.sourceWarehouseId === transfer.destWarehouseId;

        return {
          id: transfer.id,
          transferNumber: transfer.transferNumber,
          transferType: (transfer.transferType as TransferType) || (isIntraWarehouse ? "intra_warehouse" : "inter_warehouse"),
          sourceWarehouse: isIntraWarehouse ? undefined : sourceWarehouse,
          sourceLocationCode: firstLine?.sourceLocationCode || transfer.sourceLocationCode || "-",
          destWarehouse: isIntraWarehouse ? undefined : destWarehouse,
          destLocationCode: firstLine?.destLocationCode || transfer.destLocationCode || "-",
          itemSku: material.sku,
          itemName: transfer.lines && transfer.lines.length > 1 ? `${transfer.lines.length} items` : material.name,
          quantity: transfer.lines?.reduce((sum, line) => sum + (line.requestedQuantity || 0), 0) || parseInt(transfer.quantity) || 0,
          status: (transfer.status as TransferStatus) || "draft",
          notes: transfer.notes,
          createdAt: new Date().toISOString(),
        };
      });

      setTransfers(displayTransfers);
      setTotalItems(transfersPage.totalElements);
      setTotalPages(Math.max(transfersPage.totalPages, 1));
    } catch (err) {
      logger.error("Failed to load stock transfers:", err);
      setError(err instanceof Error ? err.message : "Failed to load stock transfers");
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, statusFilter, typeFilter, searchQuery, isWarehouseManager, assignedWarehouseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalTransfers = totalItems;
  const inTransitCount = transfers.filter((transfer) => transfer.status === "in_transit").length;
  const receivedCount = transfers.filter((transfer) => transfer.status === "received").length;
  const pendingCount = transfers.filter((transfer) => transfer.status === "draft").length;
  const releasedCount = transfers.filter((transfer) => transfer.status === "released").length;

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

  const addLine = () => {
    setCreateForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          materialId: "",
          sourceWarehouseId: prev.lines[0]?.sourceWarehouseId || "",
          sourceLocationCode: "",
          destWarehouseId: prev.lines[0]?.destWarehouseId || "",
          destLocationCode: "",
          quantity: "1",
          assignedWorkerId: "",
        },
      ],
    }));
  };

  const removeLine = (index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const updateLine = (index: number, key: string, value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    }));
  };

  const handleCreateTransfer = async () => {
    try {
      if (!admin?.id) {
        showToast.error("Admin user context not loaded");
        return;
      }
      if (createForm.lines.length === 0) {
        showToast.error("Add at least one transfer line");
        return;
      }
      const invalidLine = createForm.lines.find(
        (line) =>
          !line.materialId ||
          !line.sourceWarehouseId ||
          !line.sourceLocationCode ||
          !line.destWarehouseId ||
          !line.destLocationCode ||
          !line.quantity
      );
      if (invalidLine) {
        showToast.error("Please complete all required fields for each line");
        return;
      }

      setCreating(true);
      const created = await operationsApi.createMultiStockTransfer({
        transferType: createForm.transferType,
        status: "draft",
        createdBy: admin.id,
        notes: createForm.notes,
        lines: createForm.lines.map((line, idx) => ({
          lineNumber: idx + 1,
          materialId: line.materialId,
          sourceWarehouseId: line.sourceWarehouseId,
          sourceLocationCode: line.sourceLocationCode,
          destWarehouseId: line.destWarehouseId,
          destLocationCode: line.destLocationCode,
          quantity: line.quantity,
          assignedWorkerId: line.assignedWorkerId || undefined,
        })),
      });

      await operationsApi.releaseStockTransfer(created.id, admin.id);
      showToast.success("Transfer order created and released");
      setShowCreateModal(false);
      setCreateForm({
        transferType: "intra_warehouse",
        notes: "",
        lines: [
          {
            materialId: "",
            sourceWarehouseId: "",
            sourceLocationCode: "",
            destWarehouseId: "",
            destLocationCode: "",
            quantity: "1",
            assignedWorkerId: "",
          },
        ],
      });
      await loadData();
    } catch (err) {
      logger.error("Failed to create transfer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setCreating(false);
    }
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
        searchQuery={searchInput}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onSearchChange={setSearchInput}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        }}
        onTypeFilterChange={(value) => {
          setTypeFilter(value);
          setCurrentPage(1);
        }}
        onCreateTransfer={() => setShowCreateModal(true)}
      />

      <StockTransferStats
        totalTransfers={totalTransfers}
        inTransitCount={inTransitCount + releasedCount}
        receivedCount={receivedCount}
        pendingCount={pendingCount}
      />

      <StockTransferTable
        transfers={transfers}
        onViewDetails={handleViewDetails}
        onCancelTransfer={handleCancelTransfer}
        onPrintSlip={handlePrintTransferSlip}
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

      <StockTransferDetailModal
        transfer={selectedTransfer}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onCancelTransfer={handleCancelTransfer}
        onPrintSlip={handlePrintTransferSlip}
      />

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Create Multi-Item Stock Transfer</h2>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowCreateModal(false)}>Close</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="form-control">
                <span className="label-text">Transfer Type</span>
                <select
                  className="select select-bordered"
                  value={createForm.transferType}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, transferType: e.target.value as TransferType }))}
                >
                  <option value="intra_warehouse">Intra Warehouse</option>
                  <option value="inter_warehouse">Inter Warehouse</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">Notes</span>
                <input
                  className="input input-bordered"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional transfer notes"
                />
              </label>
            </div>

            <div className="space-y-3">
              {createForm.lines.map((line, index) => (
                <div key={index} className="border border-base-300 rounded-lg p-3 grid grid-cols-1 md:grid-cols-7 gap-2">
                  <select className="select select-bordered" value={line.materialId} onChange={(e) => updateLine(index, "materialId", e.target.value)}>
                    <option value="">Material</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.materialCode || m.id} - {m.description || "Material"}</option>
                    ))}
                  </select>
                  <select className="select select-bordered" value={line.sourceWarehouseId} onChange={(e) => updateLine(index, "sourceWarehouseId", e.target.value)}>
                    <option value="">Source WH</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <input className="input input-bordered" placeholder="Source Loc" value={line.sourceLocationCode} onChange={(e) => updateLine(index, "sourceLocationCode", e.target.value)} />
                  <select className="select select-bordered" value={line.destWarehouseId} onChange={(e) => updateLine(index, "destWarehouseId", e.target.value)}>
                    <option value="">Dest WH</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <input className="input input-bordered" placeholder="Dest Loc" value={line.destLocationCode} onChange={(e) => updateLine(index, "destLocationCode", e.target.value)} />
                  <input className="input input-bordered" type="number" min="1" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
                  <div className="flex gap-2">
                    <select className="select select-bordered w-full" value={line.assignedWorkerId} onChange={(e) => updateLine(index, "assignedWorkerId", e.target.value)}>
                      <option value="">Any Worker</option>
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {(worker.firstName || worker.username) + " " + (worker.lastName || "")}
                        </option>
                      ))}
                    </select>
                    {createForm.lines.length > 1 && (
                      <button className="btn btn-error btn-outline" onClick={() => removeLine(index)}>X</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button className="btn btn-outline" onClick={addLine}>Add Line</button>
              <button className={`btn btn-primary ${creating ? "loading" : ""}`} onClick={handleCreateTransfer} disabled={creating}>
                Create & Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
