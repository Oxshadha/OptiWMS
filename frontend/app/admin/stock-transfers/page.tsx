"use client";

import { useState, useEffect, useCallback } from "react";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { operationsApi } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { materialsApi } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";

type TransferType = "intra_warehouse" | "inter_warehouse";
type TransferStatus = "draft" | "in_transit" | "received" | "cancelled";

interface StockTransfer {
  id: string;
  transferNumber: string;
  transferType: TransferType;
  sourceWarehouse?: string;
  sourceLocationCode: string;
  destWarehouse?: string;
  destLocationCode: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  status: TransferStatus;
  notes?: string;
  dispatchedBy?: string;
  dispatchedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  createdAt: string;
}

const statusClass = (status: TransferStatus) => {
  if (status === "received") return "badge-success";
  if (status === "in_transit") return "badge-info";
  if (status === "draft") return "badge-warning";
  if (status === "cancelled") return "badge-error";
  return "badge-outline";
};

export default function StockTransfersPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] =
    useState<StockTransfer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "all">(
    "all"
  );
  const [typeFilter, setTypeFilter] = useState<TransferType | "all">("all");

  // API state
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [transfersData, warehousesData, materialsData] = await Promise.all([
        operationsApi.getStockTransfers(),
        warehousesApi.getAll(),
        materialsApi.getAll(),
      ]);

      // Build warehouses map
      const whMap = new Map<string, string>();
      warehousesData.forEach(wh => whMap.set(wh.id, wh.name));

      // Build materials map
      const matMap = new Map<string, { name: string; sku: string }>();
      materialsData.forEach((mat) =>
        matMap.set(mat.id, {
          name: mat.description || "Unknown",
          sku: mat.materialCode || mat.id,
        })
      );

      // Transform API data to display format
      const displayTransfers: StockTransfer[] = transfersData.map((t) => {
        const material = matMap.get(t.materialId) || { name: "Unknown", sku: "N/A" };
        const sourceWarehouse = whMap.get(t.sourceWarehouseId);
        const destWarehouse = whMap.get(t.destWarehouseId);
        const isIntraWarehouse = t.transferType === "intra_warehouse" || t.sourceWarehouseId === t.destWarehouseId;

        return {
          id: t.id,
          transferNumber: t.transferNumber,
          transferType: (isIntraWarehouse ? "intra_warehouse" : "inter_warehouse") as TransferType,
          sourceWarehouse: isIntraWarehouse ? undefined : sourceWarehouse,
          sourceLocationCode: t.sourceLocationCode,
          destWarehouse: isIntraWarehouse ? undefined : destWarehouse,
          destLocationCode: t.destLocationCode,
          itemSku: material.sku,
          itemName: material.name,
          quantity: parseInt(t.quantity) || 0,
          status: (t.status as TransferStatus) || "draft",
          notes: t.notes,
          createdAt: new Date().toISOString(),
        };
      });

      setTransfers(displayTransfers);
    } catch (err) {
      console.error("Failed to load stock transfers:", err);
      setError(err instanceof Error ? err.message : "Failed to load stock transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data from API
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter stock transfers by warehouse for warehouse managers
  const transfersForWarehouse =
    isWarehouseManager && assignedWarehouseName
      ? transfers.filter(
          (t) =>
            t.sourceWarehouse === assignedWarehouseName ||
            t.destWarehouse === assignedWarehouseName ||
            (!t.sourceWarehouse && !t.destWarehouse) // Intra-warehouse transfers
        )
      : transfers;

  const filteredTransfers = transfersForWarehouse.filter((transfer) => {
    const matchesSearch =
      !searchQuery.trim() ||
      transfer.transferNumber
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      transfer.itemSku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.sourceLocationCode
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      transfer.destLocationCode
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || transfer.status === statusFilter;
    const matchesType =
      typeFilter === "all" || transfer.transferType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalTransfers = transfers.length;
  const inTransit = transfers.filter(
    (t) => t.status === "in_transit"
  ).length;
  const received = transfers.filter((t) => t.status === "received").length;
  const pending = transfers.filter((t) => t.status === "draft").length;

  const handleViewDetails = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setShowDetailModal(true);
  };

  const handleCancelTransfer = async (transfer: StockTransfer) => {
    if (
      confirm(
        `Are you sure you want to cancel transfer ${transfer.transferNumber}?`
      )
    ) {
      try {
        await operationsApi.cancelStockTransfer(transfer.id);
        showToast.success("Transfer cancelled successfully");
        await loadData();
      } catch (err) {
        console.error("Failed to cancel transfer:", err);
        showToast.error(err instanceof Error ? err.message : "Failed to cancel transfer");
      }
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">
          Stock Transfers ({totalTransfers})
        </h1>
        <div className="flex gap-3">
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search transfers..."
                className="input input-bordered input-sm w-64 pl-10 pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none">
                search
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                  type="button"
                >
                  <span className="material-symbols-outlined text-xs">
                    close
                  </span>
                </button>
              )}
            </div>
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
                <button onClick={() => setStatusFilter("draft")}>Draft</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("in_transit")}>
                  In Transit
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("received")}>
                  Received
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("cancelled")}>
                  Cancelled
                </button>
              </li>
            </ul>
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">swap_horiz</span>
              <span>Type</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setTypeFilter("all")}>All Types</button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("intra_warehouse")}>
                  Intra-Warehouse
                </button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("inter_warehouse")}>
                  Inter-Warehouse
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">
                Total Transfers
              </div>
              <div className="text-2xl font-bold text-base-content">
                {totalTransfers}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">
              swap_horiz
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">In Transit</div>
              <div className="text-2xl font-bold text-info">{inTransit}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              sync
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Received</div>
              <div className="text-2xl font-bold text-success">{received}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">
              check_circle
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Pending</div>
              <div className="text-2xl font-bold text-warning">{pending}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">
              schedule
            </span>
          </div>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="card bg-base-100 border border-base-300">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Transfer #</th>
                <th>Type</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>From → To</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td>
                    <span className="font-semibold text-base-content">
                      {transfer.transferNumber}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-outline badge-sm">
                      {transfer.transferType === "intra_warehouse"
                        ? "Intra"
                        : "Inter"}
                    </span>
                  </td>
                  <td>
                    <div>
                      <div className="font-medium text-base-content">
                        {transfer.itemName}
                      </div>
                      <div className="text-sm text-base-content/60">
                        {transfer.itemSku}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-semibold text-base-content">
                      {transfer.quantity}
                    </span>
                  </td>
                  <td>
                    <div className="text-sm">
                      <div className="font-mono text-primary">
                        {transfer.sourceLocationCode}
                      </div>
                      <div className="text-base-content/60">→</div>
                      <div className="font-mono text-primary">
                        {transfer.destLocationCode}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${statusClass(
                        transfer.status
                      )} whitespace-nowrap`}
                    >
                      {transfer.status.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td className="text-base-content/70">
                    {new Date(transfer.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="dropdown dropdown-end">
                      <label tabIndex={0} className="btn btn-ghost btn-xs">
                        <span className="material-symbols-outlined">
                          more_vert
                        </span>
                      </label>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
                      >
                        <li>
                          <button onClick={() => handleViewDetails(transfer)}>
                            <span className="material-symbols-outlined text-sm">
                              visibility
                            </span>
                            View Details
                          </button>
                        </li>
                        {transfer.status === "draft" && (
                          <li>
                            <button
                              onClick={() => handleCancelTransfer(transfer)}
                              className="text-error"
                            >
                              <span className="material-symbols-outlined text-sm">
                                cancel
                              </span>
                              Cancel Transfer
                            </button>
                          </li>
                        )}
                        <li>
                          <button
                            onClick={() => {
                              showToast.warning(
                                `Printing transfer slip: ${transfer.transferNumber}`
                              );
                            }}
                          >
                            <span className="material-symbols-outlined text-sm">
                              print
                            </span>
                            Print Transfer Slip
                          </button>
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTransfers.length === 0 && (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">
              swap_horiz
            </span>
            <h3 className="text-lg font-semibold text-base-content mb-2">
              No transfers found
            </h3>
            <p className="text-sm text-base-content/60">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {/* Transfer Detail Modal */}
      {showDetailModal && selectedTransfer && (
        <DetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Transfer Details: ${selectedTransfer.transferNumber}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">
                  Transfer Number
                </label>
                <p className="font-semibold text-base-content">
                  {selectedTransfer.transferNumber}
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Status</label>
                <p>
                  <span
                    className={`badge ${statusClass(selectedTransfer.status)}`}
                  >
                    {selectedTransfer.status.replace("_", " ").toUpperCase()}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">
                  Transfer Type
                </label>
                <p className="font-semibold text-base-content">
                  {selectedTransfer.transferType === "intra_warehouse"
                    ? "Intra-Warehouse"
                    : "Inter-Warehouse"}
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Quantity</label>
                <p className="font-semibold text-base-content">
                  {selectedTransfer.quantity} units
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Item</label>
              <p className="font-semibold text-base-content">
                {selectedTransfer.itemName}
              </p>
              <p className="text-sm text-base-content/60">
                SKU: {selectedTransfer.itemSku}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">
                  Source Location
                </label>
                <p className="font-mono font-bold text-primary text-lg">
                  {selectedTransfer.sourceLocationCode}
                </p>
                {selectedTransfer.sourceWarehouse && (
                  <p className="text-sm text-base-content/60">
                    Warehouse: {selectedTransfer.sourceWarehouse}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-base-content/60">
                  Destination Location
                </label>
                <p className="font-mono font-bold text-primary text-lg">
                  {selectedTransfer.destLocationCode}
                </p>
                {selectedTransfer.destWarehouse && (
                  <p className="text-sm text-base-content/60">
                    Warehouse: {selectedTransfer.destWarehouse}
                  </p>
                )}
              </div>
            </div>
            {selectedTransfer.notes && (
              <div>
                <label className="text-sm text-base-content/60">Notes</label>
                <p className="text-base-content">{selectedTransfer.notes}</p>
              </div>
            )}
            <div className="divider"></div>
            <div>
              <h4 className="font-semibold text-base-content mb-2">Timeline</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Created:</span>
                  <span className="text-base-content">
                    {new Date(selectedTransfer.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedTransfer.dispatchedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Dispatched:</span>
                    <span className="text-base-content">
                      {new Date(selectedTransfer.dispatchedAt).toLocaleString()}
                      {selectedTransfer.dispatchedBy &&
                        ` by ${selectedTransfer.dispatchedBy}`}
                    </span>
                  </div>
                )}
                {selectedTransfer.receivedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Received:</span>
                    <span className="text-base-content">
                      {new Date(selectedTransfer.receivedAt).toLocaleString()}
                      {selectedTransfer.receivedBy &&
                        ` by ${selectedTransfer.receivedBy}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                className="btn btn-primary flex-1"
                onClick={() => {
                  showToast.warning(
                    `Printing transfer slip: ${selectedTransfer.transferNumber}`
                  );
                }}
              >
                <span className="material-symbols-outlined">print</span>
                Print Transfer Slip
              </button>
              {selectedTransfer.status === "draft" && (
                <button
                  onClick={() => {
                    handleCancelTransfer(selectedTransfer);
                    setShowDetailModal(false);
                  }}
                  className="btn btn-error flex-1"
                >
                  <span className="material-symbols-outlined">cancel</span>
                  Cancel Transfer
                </button>
              )}
            </div>
          </div>
        </DetailModal>
      )}
    </div>
  );
}
