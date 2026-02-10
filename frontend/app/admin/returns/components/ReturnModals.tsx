"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { returnsApi, Return as ApiReturn } from "@/lib/api/returns";
import { warehousesApi } from "@/lib/api/warehouses";
import { ordersApi } from "@/lib/api/orders";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import type { ReturnDisplay } from "../types";
import { resolutionConfig, statusConfig } from "../types";

export function CreateReturnModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    orderType: "inbound",
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
        const [warehousesData, inboundOrders, outboundOrders] = await Promise.all([
          warehousesApi.getAll(),
          ordersApi.getAllInbound(),
          ordersApi.getAllOutbound(),
        ]);
        setWarehouses(warehousesData);
        setOrders([...inboundOrders, ...outboundOrders]);
      } catch (err) {
        logger.error("Failed to load data:", err);
      }
    };
    void loadData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.originalOrder || !formData.warehouseId || !formData.reason) {
      showToast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const order = orders.find((o) => o.orderNumber === formData.originalOrder);
      if (!order) {
        showToast.error("Order not found");
        return;
      }

      const createData: Omit<ApiReturn, "id"> = {
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
      await onSuccess();
      onClose();
      setFormData({
        orderType: "inbound",
        originalOrder: "",
        warehouseId: "",
        customerName: "",
        reason: "",
        items: [{ productId: "", quantity: 1 }],
        notes: "",
      });
    } catch (err) {
      logger.error("Failed to create return:", err);
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
            <span className="label-text font-medium">Return Flow *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.orderType}
            onChange={(e) =>
              setFormData({
                ...formData,
                orderType: e.target.value,
                originalOrder: "",
              })
            }
            required
          >
            <option value="inbound">Inbound Return</option>
            <option value="outbound">Outbound Return</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Original Order Number *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.originalOrder}
            onChange={(e) =>
              setFormData({ ...formData, originalOrder: e.target.value })
            }
            required
          >
            <option value="">Select Order</option>
            {orders
              .filter((order) => order.orderType === formData.orderType)
              .map((order) => (
                <option key={order.id} value={order.orderNumber}>
                  {order.orderNumber}
                </option>
              ))}
          </select>
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
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
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
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            Register Return
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ReturnDetailModal({
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
    ? resolutionConfig[returnItem.resolution as keyof typeof resolutionConfig] || {
        label: returnItem.resolution,
        class: "badge-outline",
      }
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
              {returnItem.originalOrderId ? (
                <Link
                  href={
                    returnItem.originalOrderType === "outbound"
                      ? `/admin/orders/outbound/${returnItem.originalOrderId}`
                      : `/admin/orders/inbound`
                  }
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

export function InspectReturnModal({
  isOpen,
  onClose,
  onSuccess,
  returnItem,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
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
      await onSuccess();
      onClose();
    } catch (err) {
      logger.error("Failed to submit inspection:", err);
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

export function AssignWorkerModal({
  isOpen,
  onClose,
  onSuccess,
  returnItem,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  returnItem: ReturnDisplay;
}) {
  const availableWorkers = [
    { id: "worker-1", name: "John Doe", warehouseName: "Warehouse 1", status: "available" },
    { id: "worker-2", name: "Jane Smith", warehouseName: "Warehouse 1", status: "available" },
    { id: "worker-3", name: "Mike Johnson", warehouseName: "Warehouse 2", status: "busy" },
    { id: "worker-4", name: "Sarah Lee", warehouseName: "Warehouse 1", status: "available" },
  ];

  const workersForWarehouse = availableWorkers.filter(
    (w) => w.warehouseName === returnItem.warehouse
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  const handleSubmit = async () => {
    if (!selectedWorkerId) {
      showToast.error("Please select a worker");
      return;
    }

    const selectedWorker = workersForWarehouse.find((w) => w.id === selectedWorkerId);
    if (!selectedWorker) {
      showToast.error("Selected worker not found");
      return;
    }

    try {
      await returnsApi.assignWorker(returnItem.id, selectedWorkerId);
      showToast.success(
        `${selectedWorker.name} assigned to return ${returnItem.returnNumber}`
      );
      await onSuccess();
      onClose();
    } catch (err) {
      logger.error("Failed to assign worker:", err);
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
          <h4 className="font-semibold text-base-content mb-2">Return Information</h4>
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
