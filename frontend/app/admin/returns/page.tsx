"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import Link from "next/link";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { returnsApi, Return as ApiReturn } from "@/lib/api/returns";
import { warehousesApi } from "@/lib/api/warehouses";
import { customersApi } from "@/lib/api/customers";
import { ordersApi } from "@/lib/api/orders";
import { showToast } from "@/lib/utils/toast";

interface ReturnDisplay {
  id: string;
  returnNumber: string;
  originalOrderId: string | null;
  originalOrder: string;
  customerName: string;
  warehouseId: string | null;
  warehouse: string;
  returnDate: string;
  reason: string;
  totalItems: number;
  status: string;
  resolution: string | null;
  receivedBy: string | null;
  inspectedBy: string | null;
}

const mockReturns: ReturnDisplay[] = [
  {
    id: "RET-1001",
    returnNumber: "RET-1001",
    originalOrderId: null,
    originalOrder: "SO-1001",
    customerName: "John Doe",
    warehouseId: null,
    warehouse: "Warehouse 1",
    returnDate: "2025-12-15",
    reason: "Defective",
    totalItems: 2,
    status: "pending",
    resolution: null,
    receivedBy: null,
    inspectedBy: null,
  },
  {
    id: "RET-1002",
    returnNumber: "RET-1002",
    originalOrderId: null,
    originalOrder: "SO-1002",
    customerName: "Jane Smith",
    warehouseId: null,
    warehouse: "Warehouse 1",
    returnDate: "2025-12-14",
    reason: "Customer Request",
    totalItems: 1,
    status: "received",
    resolution: null,
    receivedBy: "Worker-001",
    inspectedBy: null,
  },
  {
    id: "RET-1003",
    returnNumber: "RET-1003",
    originalOrderId: null,
    originalOrder: "SO-1003",
    customerName: "Bob Johnson",
    warehouseId: null,
    warehouse: "Warehouse 2",
    returnDate: "2025-12-13",
    reason: "Wrong Item",
    totalItems: 1,
    status: "inspecting",
    resolution: null,
    receivedBy: "Worker-002",
    inspectedBy: "Manager-001",
  },
  {
    id: "RET-1004",
    returnNumber: "RET-1004",
    originalOrderId: null,
    originalOrder: "SO-1004",
    customerName: "Alice Brown",
    warehouseId: null,
    warehouse: "Warehouse 1",
    returnDate: "2025-12-12",
    reason: "Damaged",
    totalItems: 3,
    status: "approved",
    resolution: "refund",
    receivedBy: "Worker-001",
    inspectedBy: "Manager-001",
  },
];

const statusConfig = {
  pending: { label: "Pending", class: "badge-warning" },
  received: { label: "Received", class: "badge-info" },
  inspecting: { label: "Inspecting", class: "badge-warning" },
  approved: { label: "Approved", class: "badge-success" },
  rejected: { label: "Rejected", class: "badge-error" },
  restocked: { label: "Restocked", class: "badge-success" },
  disposed: { label: "Disposed", class: "badge-error" },
};

const resolutionConfig = {
  refund: { label: "Refund", class: "badge-info" },
  replace: { label: "Replace", class: "badge-warning" },
  repair: { label: "Repair", class: "badge-warning" },
  reject: { label: "Reject", class: "badge-error" },
};

export default function ReturnsPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const assignedWarehouseName = admin?.warehouseName;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showAssignWorkerModal, setShowAssignWorkerModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
        ordersApi.getAllOutbound(),
      ]);

      // Build maps
      const warehousesMap = new Map<string, string>();
      warehousesData.forEach(wh => warehousesMap.set(wh.id, wh.name));
      
      const customersMap = new Map<string, string>();
      customersData.forEach(c => customersMap.set(c.id, c.name));
      
      const ordersMap = new Map<string, string>();
      ordersData.forEach(o => ordersMap.set(o.id, o.orderNumber));

      // Transform API data to display format
      const displayReturns: ReturnDisplay[] = returnsData.map((r) => {
        const warehouseName = r.warehouseId ? warehousesMap.get(r.warehouseId) || "Unknown" : "Unknown";
        const customerName = r.customerId ? customersMap.get(r.customerId) || "Unknown" : "Unknown";
        const orderNumber = r.originalOrderId ? ordersMap.get(r.originalOrderId) || r.originalOrderId : "N/A";

        return {
          id: r.id,
          returnNumber: r.returnNumber,
          originalOrderId: r.originalOrderId || null,
          originalOrder: orderNumber,
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
      console.error("Failed to load returns:", err);
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

  // Listen for reload events
  useEffect(() => {
    const handleReload = () => {
      loadData();
    };
    window.addEventListener('reloadReturns', handleReload);
    return () => {
      window.removeEventListener('reloadReturns', handleReload);
    };
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
    return matchesSearch && matchesStatus;
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
      label: "Pending Inspection",
      value: returnsForWarehouse.filter(
        (r) => r.status === "pending" || r.status === "received"
      ).length,
      icon: "pending_actions",
      color: "warning" as const,
    },
    {
      label: "Approved for Restock",
      value: returnsForWarehouse.filter(
        (r) => r.status === "approved" && r.resolution === "refund"
      ).length,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Rejected",
      value: returnsForWarehouse.filter((r) => r.status === "rejected").length,
      icon: "cancel",
      color: "error" as const,
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
      key: "originalOrder",
      label: "Original Order",
      render: (returnItem: ReturnDisplay) => (
        returnItem.originalOrderId ? (
          <Link
            href={`/admin/orders/outbound/${returnItem.originalOrderId}`}
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
                    // Reload data
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('reloadReturns'));
                    }
                  } catch (err) {
                    console.error("Failed to approve return:", err);
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
              console.log("Printing return label:", returnItem.returnNumber);
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
        <CreateReturnModal onClose={() => setShowCreateModal(false)} />
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
          returnItem={selectedReturn}
        />
      )}
    </div>
  );
}

// Create Return Modal
function CreateReturnModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    originalOrder: "",
    warehouseId: "",
    customerName: "",
    reason: "",
    items: [{ productId: "", quantity: 1 }],
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [warehousesData, ordersData] = await Promise.all([
          warehousesApi.getAll(),
          ordersApi.getAllOutbound(),
        ]);
        setWarehouses(warehousesData);
        setOrders(ordersData);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.originalOrder || !formData.warehouseId || !formData.reason) {
      showToast.error("Please fill in all required fields");
      return;
    }
    
    try {
      setLoading(true);
      // Resolve order ID from loaded orders
      const order = orders.find((o) => o.orderNumber === formData.originalOrder);
      if (!order) {
        showToast.error("Order not found");
        return;
      }

      const createData: Omit<ApiReturn, 'id'> = {
        returnNumber: `RET-${Date.now()}`,
        originalOrderId: order.id,
        warehouseId: formData.warehouseId,
        customerId: order.customerId,
        reason: formData.reason,
        status: "pending",
        returnDate: new Date().toISOString().split("T")[0],
      };

      await returnsApi.create(createData);
      showToast.success("Return created successfully");
      onClose();
      // Reset form
      setFormData({
        originalOrder: "",
        warehouseId: "",
        customerName: "",
        reason: "",
        items: [{ productId: "", quantity: 1 }],
        notes: "",
      });
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadReturns'));
      }
    } catch (err) {
      console.error("Failed to create return:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create return");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Register Return" size="lg">
      <div className="p-6 space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">
              Original Order Number *
            </span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Enter order number"
            value={formData.originalOrder}
            onChange={(e) =>
              setFormData({ ...formData, originalOrder: e.target.value })
            }
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.warehouseId}
            onChange={(e) =>
              setFormData({ ...formData, warehouseId: e.target.value })
            }
            required
          >
            <option value="">Select Warehouse</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Customer Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.customerName}
            onChange={(e) =>
              setFormData({ ...formData, customerName: e.target.value })
            }
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Reason *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.reason}
            onChange={(e) =>
              setFormData({ ...formData, reason: e.target.value })
            }
            required
          >
            <option value="">Select Reason</option>
            <option value="Damaged">Damaged</option>
            <option value="Defective">Defective</option>
            <option value="Wrong Item">Wrong Item</option>
            <option value="Changed Mind">Changed Mind</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Notes</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            Register Return
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Return Detail Modal
function ReturnDetailModal({
  isOpen,
  onClose,
  returnItem,
}: {
  isOpen: boolean;
  onClose: () => void;
  returnItem: ReturnDisplay;
}) {
  const status = statusConfig[returnItem.status as keyof typeof statusConfig] || {
    label: returnItem.status,
    class: "badge-outline",
  };
  const resolution = returnItem.resolution
    ? (resolutionConfig[returnItem.resolution as keyof typeof resolutionConfig] || {
        label: returnItem.resolution,
        class: "badge-outline",
      })
    : null;

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Return: ${returnItem.returnNumber}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">
              Return Number
            </label>
            <p className="font-semibold">{returnItem.returnNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${status.class}`}>{status.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Original Order
            </label>
            <p>
              {returnItem.originalOrderId ? (
                <Link
                  href={`/admin/orders/outbound/${returnItem.originalOrderId}`}
                  className="text-primary hover:underline"
                >
                  {returnItem.originalOrder}
                </Link>
              ) : (
                <span>{returnItem.originalOrder}</span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Customer Name
            </label>
            <p className="font-semibold">{returnItem.customerName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{returnItem.warehouse}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Return Date</label>
            <p className="font-semibold">{returnItem.returnDate}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Reason</label>
            <p className="font-semibold">{returnItem.reason}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Total Items</label>
            <p className="font-semibold">{returnItem.totalItems}</p>
          </div>
          {returnItem.receivedBy && (
            <div>
              <label className="text-sm text-base-content/60">
                Received By
              </label>
              <p className="font-semibold">{returnItem.receivedBy}</p>
            </div>
          )}
          {returnItem.inspectedBy && (
            <div>
              <label className="text-sm text-base-content/60">
                Inspected By
              </label>
              <p className="font-semibold">{returnItem.inspectedBy}</p>
            </div>
          )}
          {resolution && (
            <div>
              <label className="text-sm text-base-content/60">Resolution</label>
              <p>
                <span className={`badge ${resolution.class}`}>
                  {resolution.label}
                </span>
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

// Inspect Return Modal
function InspectReturnModal({
  isOpen,
  onClose,
  returnItem,
}: {
  isOpen: boolean;
  onClose: () => void;
  returnItem: ReturnDisplay;
}) {
  const [inspectionData, setInspectionData] = useState({
    items: [
      {
        productId: "SKU-1001",
        productName: "Wireless Earbuds",
        quantity: returnItem.totalItems,
        condition: "",
        defectDescription: "",
        resolution: "",
        images: [] as string[],
      },
    ],
    overallResolution: "",
    notes: "",
  });

  const { admin } = useAdmin();

  const handleSubmit = async () => {
    if (!inspectionData.overallResolution) {
      showToast.error("Please select overall resolution");
      return;
    }
    
    try {
      await returnsApi.submitInspection(returnItem.id, {
        overallResolution: inspectionData.overallResolution,
        notes: inspectionData.notes,
        inspectedBy: admin?.id,
      });
      showToast.success("Inspection submitted successfully");
      onClose();
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadReturns'));
      }
    } catch (err) {
      console.error("Failed to submit inspection:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to submit inspection");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inspect Return: ${returnItem.returnNumber}`}
      size="lg"
    >
      <div className="p-6 space-y-4">
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="font-semibold text-base-content mb-2">
            Return Information
          </h4>
          <div className="text-sm space-y-1">
            <div>Order: {returnItem.originalOrder}</div>
            <div>Customer: {returnItem.customerName}</div>
            <div>Reason: {returnItem.reason}</div>
          </div>
        </div>

        <div className="divider">Item Inspection</div>

        {inspectionData.items.map((item, idx) => (
          <div key={idx} className="bg-base-200 rounded-lg p-4 space-y-3">
            <div>
              <div className="font-semibold">{item.productName}</div>
              <div className="text-sm text-base-content/60">
                SKU: {item.productId} • Qty: {item.quantity}
              </div>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Condition *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={item.condition}
                onChange={(e) => {
                  const newItems = [...inspectionData.items];
                  newItems[idx].condition = e.target.value;
                  setInspectionData({ ...inspectionData, items: newItems });
                }}
                required
              >
                <option value="">Select Condition</option>
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="damaged">Damaged</option>
                <option value="defective">Defective</option>
              </select>
            </div>
            {(item.condition === "damaged" ||
              item.condition === "defective") && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    Defect Description
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  value={item.defectDescription}
                  onChange={(e) => {
                    const newItems = [...inspectionData.items];
                    newItems[idx].defectDescription = e.target.value;
                    setInspectionData({ ...inspectionData, items: newItems });
                  }}
                />
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Resolution *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={item.resolution}
                onChange={(e) => {
                  const newItems = [...inspectionData.items];
                  newItems[idx].resolution = e.target.value;
                  setInspectionData({ ...inspectionData, items: newItems });
                }}
                required
              >
                <option value="">Select Resolution</option>
                <option value="restock">Restock</option>
                <option value="repair">Repair</option>
                <option value="dispose">Dispose</option>
                <option value="return_to_supplier">Return to Supplier</option>
              </select>
            </div>
          </div>
        ))}

        <div className="divider">Overall Resolution</div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Overall Resolution *</span>
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="overallResolution"
                value="refund"
                className="radio"
                checked={inspectionData.overallResolution === "refund"}
                onChange={(e) =>
                  setInspectionData({
                    ...inspectionData,
                    overallResolution: e.target.value,
                  })
                }
              />
              <span>Refund</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="overallResolution"
                value="replace"
                className="radio"
                checked={inspectionData.overallResolution === "replace"}
                onChange={(e) =>
                  setInspectionData({
                    ...inspectionData,
                    overallResolution: e.target.value,
                  })
                }
              />
              <span>Replace</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="overallResolution"
                value="repair"
                className="radio"
                checked={inspectionData.overallResolution === "repair"}
                onChange={(e) =>
                  setInspectionData({
                    ...inspectionData,
                    overallResolution: e.target.value,
                  })
                }
              />
              <span>Repair</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="overallResolution"
                value="reject"
                className="radio"
                checked={inspectionData.overallResolution === "reject"}
                onChange={(e) =>
                  setInspectionData({
                    ...inspectionData,
                    overallResolution: e.target.value,
                  })
                }
              />
              <span>Reject</span>
            </label>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Notes</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={inspectionData.notes}
            onChange={(e) =>
              setInspectionData({ ...inspectionData, notes: e.target.value })
            }
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            Submit Inspection
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Assign Worker Modal
function AssignWorkerModal({
  isOpen,
  onClose,
  returnItem,
}: {
  isOpen: boolean;
  onClose: () => void;
  returnItem: ReturnDisplay;
}) {
  // Mock workers list - in production, this would come from API
  const availableWorkers = [
    {
      id: "worker-1",
      name: "John Doe",
      warehouseName: "Warehouse 1",
      status: "available",
    },
    {
      id: "worker-2",
      name: "Jane Smith",
      warehouseName: "Warehouse 1",
      status: "available",
    },
    {
      id: "worker-3",
      name: "Mike Johnson",
      warehouseName: "Warehouse 2",
      status: "busy",
    },
    {
      id: "worker-4",
      name: "Sarah Lee",
      warehouseName: "Warehouse 1",
      status: "available",
    },
  ];

  // Filter workers by warehouse
  const workersForWarehouse = availableWorkers.filter(
    (w) => w.warehouseName === returnItem.warehouse
  );

  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  const handleSubmit = async () => {
    if (!selectedWorkerId) {
      showToast.error("Please select a worker");
      return;
    }

    const selectedWorker = workersForWarehouse.find(
      (w) => w.id === selectedWorkerId
    );
    if (!selectedWorker) {
      showToast.error("Selected worker not found");
      return;
    }

    try {
      await returnsApi.assignWorker(returnItem.id, selectedWorkerId);
      showToast.success(`${selectedWorker.name} assigned to return ${returnItem.returnNumber}`);
      onClose();
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadReturns'));
      }
    } catch (err) {
      console.error("Failed to assign worker:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to assign worker");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Worker: ${returnItem.returnNumber}`}
      size="md"
    >
      <div className="p-6 space-y-4">
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="font-semibold text-base-content mb-2">
            Return Information
          </h4>
          <div className="text-sm space-y-1">
            <div>Order: {returnItem.originalOrder}</div>
            <div>Customer: {returnItem.customerName}</div>
            <div>Warehouse: {returnItem.warehouse}</div>
            <div>Reason: {returnItem.reason}</div>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Select Worker *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            required
          >
            <option value="">Choose a worker...</option>
            {workersForWarehouse.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} {worker.status === "busy" ? "(Busy)" : ""}
              </option>
            ))}
          </select>
          {workersForWarehouse.length === 0 && (
            <label className="label">
              <span className="label-text-alt text-warning">
                No workers available for {returnItem.warehouse}
              </span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!selectedWorkerId}
          >
            Assign Worker
          </button>
        </div>
      </div>
    </Modal>
  );
}
