"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { packingApi, PackingRecord as ApiPackingRecord } from "@/lib/api/packing";
import { ordersApi } from "@/lib/api/orders";
import { customersApi } from "@/lib/api/customers";
import { warehousesApi } from "@/lib/api/warehouses";
import { usersApi } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";

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

  // API state
  const [packingRecords, setPackingRecords] = useState<PackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Assign packer modal state - MUST be before early returns
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRecordForAssign, setSelectedRecordForAssign] = useState<PackingRecord | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<any[]>([]);

  // Load data from API
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [recordsData, ordersData, customersData, warehousesData] = await Promise.all([
        packingApi.getAll(),
        ordersApi.getAllOutbound(),
        customersApi.getAll(),
        warehousesApi.getAll(),
      ]);
      
      const customersMap = new Map<string, string>();
      customersData.forEach((c) => {
        customersMap.set(c.id, c.name);
      });

      const warehousesMap = new Map<string, string>();
      warehousesData.forEach((w) => {
        warehousesMap.set(w.id, w.name);
      });

      const ordersMap = new Map<string, { customerName: string; warehouseName: string }>();
      ordersData.forEach(o => {
        const customerName = o.customerId ? customersMap.get(o.customerId) || "Unknown" : "Unknown";
        const warehouseName = warehousesMap.get(o.warehouseId) || "Unknown";
        ordersMap.set(o.id, {
          customerName,
          warehouseName,
        });
      });

      // Transform API data to display format
      const displayRecords: PackingRecord[] = recordsData.map((r) => {
        const orderInfo = r.orderId ? ordersMap.get(r.orderId) : null;
        
        // Parse box dimensions if available
        let boxDimensions: { length: number; width: number; height: number } | undefined;
        if (r.boxDimensions) {
          try {
            const dims = JSON.parse(r.boxDimensions);
            if (dims.length && dims.width && dims.height) {
              boxDimensions = { length: dims.length, width: dims.width, height: dims.height };
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        // Map status from API to display format
        let displayStatus: PackingStatus = "pending";
        if (r.status === "in_progress") displayStatus = "in_progress";
        else if (r.status === "packed") displayStatus = "packed";
        else if (r.status === "shipped") displayStatus = "shipped";
        else displayStatus = "pending";

        return {
          id: r.id,
          orderId: r.orderId || "",
          orderNumber: r.orderNumber || "N/A",
          customer: orderInfo?.customerName || "Unknown",
          priority: "normal" as const, // TODO: Get from order when available
          packagingType: r.boxType || "",
          boxDimensions,
          actualWeight: r.actualWeightKg ? parseFloat(r.actualWeightKg) : 0,
          dimensionalWeight: r.dimensionalWeightKg ? parseFloat(r.dimensionalWeightKg) : 0,
          chargeableWeight: r.chargeableWeightKg ? parseFloat(r.chargeableWeightKg) : 0,
          trackingNumber: r.trackingNumber,
          packerId: r.packerId,
          packerName: undefined, // TODO: Get from user API
          status: displayStatus,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          createdAt: r.startedAt || new Date().toISOString(),
          warehouseName: orderInfo?.warehouseName,
        };
      });

      setPackingRecords(displayRecords);
    } catch (err) {
      console.error("Failed to load packing records:", err);
      setError(err instanceof Error ? err.message : "Failed to load packing records");
      setPackingRecords([]);
      showToast.error("Failed to load packing records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Listen for reload events
  useEffect(() => {
    const handleReload = () => {
      loadData();
    };
    window.addEventListener('reloadPacking', handleReload);
    return () => {
      window.removeEventListener('reloadPacking', handleReload);
    };
  }, []);
  
  // Load workers - MUST be before early returns
  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const workers = await usersApi.getAll("worker");
        setAvailableWorkers(workers);
      } catch (err) {
        console.error("Failed to load workers:", err);
      }
    };
    loadWorkers();
  }, []);

  // Filter packing records by warehouse for warehouse managers
  const packingRecordsForWarehouse = isWarehouseManager && assignedWarehouseName
    ? packingRecords.filter((p) => p.warehouseName === assignedWarehouseName)
    : packingRecords;

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
  const total = packingRecords.length;

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
    if (!selectedRecordForAssign) return;
    try {
      await packingApi.update(selectedRecordForAssign.id, { packerId });
      showToast.success("Packer assigned successfully");
      setShowAssignModal(false);
      setSelectedRecordForAssign(null);
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadPacking'));
      }
    } catch (err) {
      console.error("Failed to assign packer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to assign packer");
    }
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

      {/* Assign Packer Modal */}
      {showAssignModal && selectedRecordForAssign && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedRecordForAssign(null);
          }}
          title="Assign Packer"
        >
          <div className="p-6 space-y-4">
            <p className="text-base-content/70">
              Select a worker to assign to order <strong>{selectedRecordForAssign.orderNumber}</strong>
            </p>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Select Packer</span>
              </label>
              <select
                className="select select-bordered w-full"
                onChange={(e) => {
                  if (e.target.value) {
                    handleConfirmAssign(e.target.value);
                  }
                }}
              >
                <option value="">Select a worker...</option>
                {availableWorkers.map(worker => (
                  <option key={worker.id} value={worker.id}>
                    {worker.firstName} {worker.lastName} ({worker.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedRecordForAssign(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
