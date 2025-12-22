"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";

type PackingStatus = "pending" | "in_progress" | "packed" | "shipped";

interface PackingRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  priority: "normal" | "express";
  packagingType: string;
  boxDimensions?: { length: number; width: number; height: number };
  actualWeight: number;
  dimensionalWeight: number;
  chargeableWeight: number;
  trackingNumber?: string;
  packerId?: string;
  packerName?: string;
  status: PackingStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  warehouseName?: string;
}

const mockPackingRecords: PackingRecord[] = [
  {
    id: "pk-1",
    orderId: "ord-1",
    orderNumber: "ORD-2025-001",
    customer: "John Smith",
    priority: "express",
    packagingType: "medium",
    boxDimensions: { length: 30, width: 25, height: 20 },
    actualWeight: 2.5,
    dimensionalWeight: 3.75,
    chargeableWeight: 3.75,
    trackingNumber: "TRK-123456789",
    packerName: "Alice Johnson",
    status: "packed",
    startedAt: "2025-12-15T10:00:00",
    completedAt: "2025-12-15T10:25:00",
    createdAt: "2025-12-15T09:45:00",
    warehouseName: "Warehouse 1",
  },
  {
    id: "pk-2",
    orderId: "ord-2",
    orderNumber: "ORD-2025-002",
    customer: "Jane Doe",
    priority: "normal",
    packagingType: "small",
    boxDimensions: { length: 20, width: 15, height: 10 },
    actualWeight: 1.2,
    dimensionalWeight: 0.6,
    chargeableWeight: 1.2,
    packerName: "Bob Williams",
    status: "in_progress",
    startedAt: "2025-12-16T08:30:00",
    createdAt: "2025-12-16T08:00:00",
    warehouseName: "Warehouse 1",
  },
  {
    id: "pk-3",
    orderId: "ord-3",
    orderNumber: "ORD-2025-003",
    customer: "Mike Brown",
    priority: "normal",
    status: "pending",
    packagingType: "",
    actualWeight: 0,
    dimensionalWeight: 0,
    chargeableWeight: 0,
    createdAt: "2025-12-16T09:00:00",
    warehouseName: "Warehouse 2",
  },
];

const statusClass = (status: PackingStatus) => {
  if (status === "shipped") return "badge-success";
  if (status === "packed") return "badge-info";
  if (status === "in_progress") return "badge-warning";
  if (status === "pending") return "badge-outline";
  return "badge-outline";
};

export default function PackingPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PackingRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PackingStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"queue" | "monitor" | "history">("queue");

  // Filter packing records by warehouse for warehouse managers
  const packingRecordsForWarehouse = isWarehouseManager && assignedWarehouseName
    ? mockPackingRecords.filter((p) => p.warehouseName === assignedWarehouseName)
    : mockPackingRecords;

  const filteredRecords = packingRecordsForWarehouse.filter((record) => {
    const matchesSearch = !searchQuery.trim() || (
      record.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingOrders = filteredRecords.filter(r => r.status === "pending");
  const inProgress = filteredRecords.filter(r => r.status === "in_progress");
  const packed = filteredRecords.filter(r => r.status === "packed");
  const total = mockPackingRecords.length;

  const handleViewDetails = (record: PackingRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const handleAssignPacker = (record: PackingRecord) => {
    // TODO: Open assign packer modal
    alert(`Assign packer to order ${record.orderNumber}`);
  };

  const handlePrintLabel = (record: PackingRecord) => {
    // TODO: Print shipping label
    alert(`Printing label for ${record.orderNumber}...`);
  };

  const handlePrintSlip = (record: PackingRecord) => {
    // TODO: Print packing slip
    alert(`Printing slip for ${record.orderNumber}...`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">Packing Management</h1>
        <div className="flex gap-3">
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders..."
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
                  <span className="material-symbols-outlined text-xs">close</span>
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
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("pending")}>Pending</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("in_progress")}>In Progress</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("packed")}>Packed</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("shipped")}>Shipped</button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="tabs tabs-boxed">
        <button
          className={`tab ${viewMode === "queue" ? "tab-active" : ""}`}
          onClick={() => setViewMode("queue")}
        >
          Packing Queue
        </button>
        <button
          className={`tab ${viewMode === "monitor" ? "tab-active" : ""}`}
          onClick={() => setViewMode("monitor")}
        >
          Monitor
        </button>
        <button
          className={`tab ${viewMode === "history" ? "tab-active" : ""}`}
          onClick={() => setViewMode("history")}
        >
          History
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Awaiting Packing</div>
              <div className="text-2xl font-bold text-base-content">{pendingOrders.length}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">schedule</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">In Progress</div>
              <div className="text-2xl font-bold text-info">{inProgress.length}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">sync</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Packed</div>
              <div className="text-2xl font-bold text-success">{packed.length}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Orders</div>
              <div className="text-2xl font-bold text-base-content">{total}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">inventory</span>
          </div>
        </div>
      </div>

      {/* Packing Queue View */}
      {viewMode === "queue" && (
        <div className="card bg-base-100 border border-base-300">
          <div className="p-4 border-b border-base-200">
            <h2 className="text-lg font-semibold text-base-content">Orders Ready to Pack</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="font-semibold text-base-content">{record.orderNumber}</span>
                    </td>
                    <td className="text-base-content/70">{record.customer}</td>
                    <td>
                      {record.priority === "express" ? (
                        <span className="badge badge-error badge-sm">Express</span>
                      ) : (
                        <span className="badge badge-outline badge-sm">Normal</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusClass(record.status)} whitespace-nowrap`}>
                        {record.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="text-base-content/70">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAssignPacker(record)}
                          className="btn btn-primary btn-xs"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => handleViewDetails(record)}
                          className="btn btn-ghost btn-xs"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pendingOrders.length === 0 && (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">inventory</span>
              <h3 className="text-lg font-semibold text-base-content mb-2">No orders pending</h3>
              <p className="text-sm text-base-content/60">All orders have been assigned or packed</p>
            </div>
          )}
        </div>
      )}

      {/* Monitor View */}
      {viewMode === "monitor" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inProgress.map((record) => {
            const startTime = record.startedAt ? new Date(record.startedAt).getTime() : Date.now();
            const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
            return (
              <div key={record.id} className="card bg-base-100 border border-base-300 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-base-content">{record.orderNumber}</span>
                  <span className="badge badge-warning">In Progress</span>
                </div>
                <div className="text-sm text-base-content/60 mb-2">Packer: {record.packerName || "Unassigned"}</div>
                <div className="text-sm text-base-content/60 mb-2">Customer: {record.customer}</div>
                <div className="text-sm text-base-content/60">Time Elapsed: {elapsedMinutes} min</div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleViewDetails(record)}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
          {inProgress.length === 0 && (
            <div className="col-span-full card bg-base-100 border border-base-300 p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">sync</span>
              <h3 className="text-lg font-semibold text-base-content mb-2">No active packing</h3>
              <p className="text-sm text-base-content/60">No orders are currently being packed</p>
            </div>
          )}
        </div>
      )}

      {/* History View */}
      {viewMode === "history" && (
        <div className="card bg-base-100 border border-base-300">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Packaging</th>
                  <th>Weight (kg)</th>
                  <th>Tracking</th>
                  <th>Packer</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.filter(r => r.status === "packed" || r.status === "shipped").map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="font-semibold text-base-content">{record.orderNumber}</span>
                    </td>
                    <td className="text-base-content/70">{record.customer}</td>
                    <td>
                      <span className="badge badge-outline badge-sm capitalize">
                        {record.packagingType || "N/A"}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-base-content">{record.chargeableWeight.toFixed(2)}</span>
                    </td>
                    <td>
                      {record.trackingNumber ? (
                        <span className="font-mono text-sm text-primary">{record.trackingNumber}</span>
                      ) : (
                        <span className="text-base-content/50">N/A</span>
                      )}
                    </td>
                    <td className="text-base-content/70">{record.packerName || "N/A"}</td>
                    <td className="text-base-content/70">
                      {record.completedAt ? new Date(record.completedAt).toLocaleDateString() : "N/A"}
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
                            <button onClick={() => handleViewDetails(record)}>
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              View Details
                            </button>
                          </li>
                          <li>
                            <button onClick={() => handlePrintLabel(record)}>
                              <span className="material-symbols-outlined text-sm">print</span>
                              Print Label
                            </button>
                          </li>
                          <li>
                            <button onClick={() => handlePrintSlip(record)}>
                              <span className="material-symbols-outlined text-sm">print</span>
                              Print Slip
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
        </div>
      )}

      {/* Packing Detail Modal */}
      {showDetailModal && selectedRecord && (
        <DetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Packing Details: ${selectedRecord.orderNumber}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Order Number</label>
                <p className="font-semibold text-base-content">{selectedRecord.orderNumber}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Status</label>
                <p>
                  <span className={`badge ${statusClass(selectedRecord.status)}`}>
                    {selectedRecord.status.replace("_", " ").toUpperCase()}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Customer</label>
                <p className="font-semibold text-base-content">{selectedRecord.customer}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Priority</label>
                <p>
                  {selectedRecord.priority === "express" ? (
                    <span className="badge badge-error">Express</span>
                  ) : (
                    <span className="badge badge-outline">Normal</span>
                  )}
                </p>
              </div>
            </div>
            {selectedRecord.packagingType && (
              <div>
                <label className="text-sm text-base-content/60">Packaging Type</label>
                <p className="font-semibold text-base-content capitalize">{selectedRecord.packagingType}</p>
                {selectedRecord.boxDimensions && (
                  <p className="text-sm text-base-content/60">
                    Dimensions: {selectedRecord.boxDimensions.length} × {selectedRecord.boxDimensions.width} × {selectedRecord.boxDimensions.height} cm
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Actual Weight</label>
                <p className="font-semibold text-base-content">{selectedRecord.actualWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Dimensional Weight</label>
                <p className="font-semibold text-base-content">{selectedRecord.dimensionalWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Chargeable Weight</label>
                <p className="font-semibold text-base-content">{selectedRecord.chargeableWeight.toFixed(2)} kg</p>
              </div>
            </div>
            {selectedRecord.trackingNumber && (
              <div>
                <label className="text-sm text-base-content/60">Tracking Number</label>
                <p className="font-mono font-semibold text-primary">{selectedRecord.trackingNumber}</p>
              </div>
            )}
            {selectedRecord.packerName && (
              <div>
                <label className="text-sm text-base-content/60">Packer</label>
                <p className="font-semibold text-base-content">{selectedRecord.packerName}</p>
              </div>
            )}
            <div className="divider"></div>
            <div>
              <h4 className="font-semibold text-base-content mb-2">Timeline</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Created:</span>
                  <span className="text-base-content">
                    {new Date(selectedRecord.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedRecord.startedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Started:</span>
                    <span className="text-base-content">
                      {new Date(selectedRecord.startedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedRecord.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Completed:</span>
                    <span className="text-base-content">
                      {new Date(selectedRecord.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              {selectedRecord.trackingNumber && (
                <>
                  <button
                    onClick={() => handlePrintLabel(selectedRecord)}
                    className="btn btn-primary flex-1"
                  >
                    <span className="material-symbols-outlined">print</span>
                    Print Label
                  </button>
                  <button
                    onClick={() => handlePrintSlip(selectedRecord)}
                    className="btn btn-outline btn-primary flex-1"
                  >
                    <span className="material-symbols-outlined">print</span>
                    Print Slip
                  </button>
                </>
              )}
            </div>
          </div>
        </DetailModal>
      )}
    </div>
  );
}

