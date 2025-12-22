"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import Link from "next/link";
import { returnsApi, Return } from "@/lib/api/returns";

// Extended return interface for display
interface ReturnDisplay extends Return {
  returnNumber?: string;
  originalOrder?: string;
  customerName?: string;
  warehouse?: string;
  returnDate?: string;
  totalItems?: number;
}
  {
    id: "RET-1001",
    returnNumber: "RET-1001",
    originalOrder: "SO-1001",
    customerName: "John Doe",
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
    originalOrder: "SO-1002",
    customerName: "Jane Smith",
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
    originalOrder: "SO-1003",
    customerName: "Bob Johnson",
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
    originalOrder: "SO-1004",
    customerName: "Alice Brown",
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
  const [returns, setReturns] = useState<ReturnDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load returns from API
  useEffect(() => {
    loadReturns();
  }, []);

  const loadReturns = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await returnsApi.getAll();
      // Map API data to display format
      const displayData: ReturnDisplay[] = data.map(r => ({
        ...r,
        returnNumber: r.returnNumber || r.id,
        originalOrder: r.originalOrderId || "N/A",
        customerName: "Customer", // TODO: Fetch customer name from customers API
        warehouse: "Warehouse", // TODO: Fetch warehouse name from warehouses API
        returnDate: r.returnDate || new Date().toISOString().split('T')[0],
        totalItems: 0, // TODO: Calculate from return items
      }));
      setReturns(displayData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load returns");
      console.error("Error loading returns:", err);
    } finally {
      setLoading(false);
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
        <span>Error loading returns: {error}</span>
        <button className="btn btn-sm" onClick={loadReturns}>Retry</button>
      </div>
    );
  }

  const filteredReturns = returns.filter(returnItem => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      returnItem.returnNumber.toLowerCase().includes(query) ||
      returnItem.originalOrder.toLowerCase().includes(query) ||
      returnItem.customerName.toLowerCase().includes(query) ||
      returnItem.warehouse.toLowerCase().includes(query) ||
      returnItem.status.toLowerCase().includes(query) ||
      returnItem.reason.toLowerCase().includes(query) ||
      returnItem.returnDate.toLowerCase().includes(query) ||
      returnItem.totalItems.toString().includes(query) ||
      (returnItem.resolution && returnItem.resolution.toLowerCase().includes(query)) ||
      (returnItem.receivedBy && returnItem.receivedBy.toLowerCase().includes(query)) ||
      (returnItem.inspectedBy && returnItem.inspectedBy.toLowerCase().includes(query)) ||
      returnItem.id.toLowerCase().includes(query)
    );
    const matchesStatus = statusFilter === "all" || returnItem.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRowClick = (returnItem: typeof returns[0]) => {
    setSelectedReturn(returnItem);
    setShowDetailModal(true);
  };

  const handleInspect = (returnItem: typeof returns[0]) => {
    setSelectedReturn(returnItem);
    setShowInspectModal(true);
  };

  const summaryCards = [
    {
      label: "Total Returns This Month",
      value: returns.length,
      icon: "keyboard_return",
      color: "primary",
    },
    {
      label: "Pending Inspection",
      value: returns.filter(r => r.status === "pending" || r.status === "received").length,
      icon: "pending_actions",
      color: "warning",
    },
    {
      label: "Approved for Restock",
      value: returns.filter(r => r.status === "approved" && r.resolution === "refund").length,
      icon: "check_circle",
      color: "success",
    },
    {
      label: "Rejected",
      value: returns.filter(r => r.status === "rejected").length,
      icon: "cancel",
      color: "error",
    },
  ];

  const columns = [
    {
      key: "returnNumber",
      label: "Return #",
      render: (returnItem: typeof returns[0]) => (
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
      render: (returnItem: typeof returns[0]) => (
        <Link href={`/admin/orders/outbound/${returnItem.originalOrder}`} className="text-primary hover:underline">
          {returnItem.originalOrder}
        </Link>
      ),
      sortable: true,
    },
    { key: "customerName", label: "Customer", sortable: true },
    { key: "warehouse", label: "Warehouse", sortable: true },
    { key: "returnDate", label: "Return Date", className: "text-base-content/70", sortable: true },
    { key: "reason", label: "Reason", sortable: true },
    { key: "totalItems", label: "Total Items", className: "text-base-content/70", sortable: true },
    {
      key: "status",
      label: "Status",
      render: (returnItem: typeof returns[0]) => {
        const status = statusConfig[returnItem.status as keyof typeof statusConfig];
        return <span className={`badge ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "resolution",
      label: "Resolution",
      render: (returnItem: typeof returns[0]) => {
        if (!returnItem.resolution) return <span className="text-base-content/50">-</span>;
        const resolution = resolutionConfig[returnItem.resolution as keyof typeof resolutionConfig];
        return <span className={`badge ${resolution.class}`}>{resolution.label}</span>;
      },
      sortable: true,
    },
  ];

  const renderActions = (returnItem: typeof returns[0]) => (
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
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </button>
        </li>
        {returnItem.status === "received" && (
          <li>
            <button onClick={() => handleInspect(returnItem)}>
              <span className="material-symbols-outlined text-sm">verified</span>
              Inspect Return
            </button>
          </li>
        )}
        {returnItem.status === "pending" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">person_add</span>
              Assign Worker
            </button>
          </li>
        )}
        <li>
          <button>
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
          <p className="text-sm text-base-content/60 mt-1">Manage returned items and inspections</p>
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
              <li><button onClick={() => setStatusFilter("all")}>All Status</button></li>
              <li><button onClick={() => setStatusFilter("pending")}>Pending</button></li>
              <li><button onClick={() => setStatusFilter("received")}>Received</button></li>
              <li><button onClick={() => setStatusFilter("inspecting")}>Inspecting</button></li>
              <li><button onClick={() => setStatusFilter("approved")}>Approved</button></li>
              <li><button onClick={() => setStatusFilter("rejected")}>Rejected</button></li>
            </ul>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
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
    </div>
  );
}

// Create Return Modal
function CreateReturnModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    originalOrder: "",
    warehouse: "",
    customerName: "",
    reason: "",
    items: [{ productId: "", quantity: 1 }],
    notes: "",
  });

  const handleSubmit = async () => {
    if (!formData.originalOrder || !formData.warehouse || !formData.reason) {
      alert("Please fill in all required fields");
      return;
    }
    try {
      await returnsApi.register({
        returnNumber: `RET-${Date.now()}`,
        originalOrderId: formData.originalOrder,
        customerId: formData.customer || undefined,
        warehouseId: formData.warehouse,
        returnDate: new Date().toISOString().split('T')[0],
        reason: formData.reason,
        status: "pending",
        receivedBy: formData.receivedBy || undefined,
      });
      alert("Return registered successfully!");
      onClose();
      loadReturns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to register return");
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Register Return" size="lg">
      <div className="p-6 space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Original Order Number *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Enter order number"
            value={formData.originalOrder}
            onChange={(e) => setFormData({ ...formData, originalOrder: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.warehouse}
            onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
            required
          >
            <option value="">Select Warehouse</option>
            <option value="warehouse-1">Warehouse 1</option>
            <option value="warehouse-2">Warehouse 2</option>
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
            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Reason *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
  returnItem: typeof returns[0];
}) {
  const status = statusConfig[returnItem.status as keyof typeof statusConfig];
  const resolution = returnItem.resolution
    ? resolutionConfig[returnItem.resolution as keyof typeof resolutionConfig]
    : null;

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Return: ${returnItem.returnNumber}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Return Number</label>
            <p className="font-semibold">{returnItem.returnNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${status.class}`}>{status.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Original Order</label>
            <p>
              <Link href={`/admin/orders/outbound/${returnItem.originalOrder}`} className="text-primary hover:underline">
                {returnItem.originalOrder}
              </Link>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Customer Name</label>
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
              <label className="text-sm text-base-content/60">Received By</label>
              <p className="font-semibold">{returnItem.receivedBy}</p>
            </div>
          )}
          {returnItem.inspectedBy && (
            <div>
              <label className="text-sm text-base-content/60">Inspected By</label>
              <p className="font-semibold">{returnItem.inspectedBy}</p>
            </div>
          )}
          {resolution && (
            <div>
              <label className="text-sm text-base-content/60">Resolution</label>
              <p>
                <span className={`badge ${resolution.class}`}>{resolution.label}</span>
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
  returnItem: typeof returns[0];
}) {
  const [inspectionData, setInspectionData] = useState({
    items: [
      { productId: "SKU-1001", productName: "Wireless Earbuds", quantity: returnItem.totalItems, condition: "", defectDescription: "", resolution: "", images: [] as string[] },
    ],
    overallResolution: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!inspectionData.overallResolution) {
      alert("Please select overall resolution");
      return;
    }
    try {
      await returnsApi.inspect(
        returnItem.id,
        inspectionData.inspectedBy || "admin",
        inspectionData.overallResolution
      );
      alert("Inspection submitted successfully!");
      onClose();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit inspection");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inspect Return: ${returnItem.returnNumber}`} size="lg">
      <div className="p-6 space-y-4">
        <div className="bg-base-200 rounded-lg p-4">
          <h4 className="font-semibold text-base-content mb-2">Return Information</h4>
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
              <div className="text-sm text-base-content/60">SKU: {item.productId} • Qty: {item.quantity}</div>
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
            {(item.condition === "damaged" || item.condition === "defective") && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Defect Description</span>
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
                onChange={(e) => setInspectionData({ ...inspectionData, overallResolution: e.target.value })}
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
                onChange={(e) => setInspectionData({ ...inspectionData, overallResolution: e.target.value })}
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
                onChange={(e) => setInspectionData({ ...inspectionData, overallResolution: e.target.value })}
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
                onChange={(e) => setInspectionData({ ...inspectionData, overallResolution: e.target.value })}
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
            onChange={(e) => setInspectionData({ ...inspectionData, notes: e.target.value })}
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

