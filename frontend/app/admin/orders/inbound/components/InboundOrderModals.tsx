"use client";

import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { ordersApi } from "@/lib/api/orders";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { materialsApi } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { statusConfig, type InboundOrderDisplay } from "../types";

function getInboundStatusTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "arrived" || status === "receiving" || status === "putaway") return "info";
  return "warning";
}

export function InboundOrderDetailModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: InboundOrderDisplay;
}) {
  const status =
    statusConfig[order.status as keyof typeof statusConfig] || statusConfig.ordered;

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inbound Order: ${order.orderNumber}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Order Number</label>
            <p className="font-semibold">{order.orderNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip label={status.label} tone={getInboundStatusTone(order.status)} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Supplier</label>
            <p className="font-semibold">{order.supplierName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{order.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Order Date</label>
            <p className="font-semibold">{order.orderDate}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Expected Delivery</label>
            <p className="font-semibold">{order.expectedDelivery}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Total Items</label>
            <p className="font-semibold">{order.totalItems}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Received Items</label>
            <p className="font-semibold">
              {order.receivedItems}/{order.totalItems}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <span className="material-symbols-outlined">print</span>
            Print Order
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

export function EditInboundOrderModal({
  isOpen,
  onClose,
  onSaved,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  order: InboundOrderDisplay;
}) {
  const orderDateValue = order.orderDate || "";
  const [formData, setFormData] = useState({
    expectedDelivery: order.expectedDelivery,
    supplierName: order.supplierName,
    warehouseName: order.warehouseName,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (
      formData.expectedDelivery &&
      orderDateValue &&
      new Date(formData.expectedDelivery) < new Date(orderDateValue)
    ) {
      showToast.error("Expected delivery date cannot be before order date.");
      return;
    }

    try {
      setIsSubmitting(true);
      await ordersApi.update(order.id, {
        expectedDate: formData.expectedDelivery,
        notes: undefined,
        priority: undefined,
      });
      showToast.success("Order updated successfully!");
      await onSaved();
      onClose();
    } catch (error) {
      logger.error("Failed to update order:", error);
      showToast.error("Failed to update order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Order: ${order.orderNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Expected Delivery *</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={formData.expectedDelivery}
            onChange={(e) =>
              setFormData({ ...formData, expectedDelivery: e.target.value })
            }
            min={orderDateValue || undefined}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Supplier</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.supplierName}
            disabled
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.warehouseName}
            disabled
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            Update Order
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

export function CreateInboundOrderModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; description: string }>>([]);
  const [supplierHasMaterialLinks, setSupplierHasMaterialLinks] = useState(true);
  const [formData, setFormData] = useState({
    supplierId: "",
    warehouseId: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDeliveryDate: "",
    notes: "",
    items: [] as Array<{
      productId: string;
      quantityOrdered: number;
      batchNumber: string;
      manufactureDate: string;
      expiryDate: string;
    }>,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [suppliersData, warehousesData] = await Promise.all([
          suppliersApi.getAll(),
          warehousesApi.getAll(),
        ]);
        setSuppliers(suppliersData);
        setWarehouses(warehousesData);
      } catch (err) {
        logger.error("Failed to load suppliers/warehouses:", err);
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    const loadSupplierMaterials = async () => {
      if (!formData.supplierId) {
        setMaterials([]);
        setSupplierHasMaterialLinks(true);
        return;
      }

      try {
        const supplierMaterials = await materialsApi.getAll(undefined, formData.supplierId);
        if (supplierMaterials.length > 0) {
          setSupplierHasMaterialLinks(true);
          setMaterials(supplierMaterials);

          // Keep only items still valid for the selected supplier.
          setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((item) =>
              supplierMaterials.some((m) => m.id === item.productId)
            ),
          }));
        } else {
          // Legacy bootstrap path: allow initial material selection and create links on submit.
          setSupplierHasMaterialLinks(false);
          const allMaterials = await materialsApi.getAll();
          setMaterials(allMaterials);
        }
      } catch (err) {
        logger.error("Failed to load supplier materials:", err);
        setSupplierHasMaterialLinks(true);
        setMaterials([]);
      }
    };

    void loadSupplierMaterials();
  }, [formData.supplierId]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.supplierId || !formData.warehouseId || !formData.expectedDeliveryDate) {
        setError("Please fill in all required fields.");
        return;
      }

      if (new Date(formData.expectedDeliveryDate) < new Date(formData.orderDate)) {
        setError("Expected delivery date cannot be before order date.");
        return;
      }

      if (formData.items.length === 0) {
        setError("Please add at least one item to the order.");
        return;
      }

      const invalidItems = formData.items.filter(
        (item) => !item.productId || item.quantityOrdered <= 0
      );
      if (invalidItems.length > 0) {
        setError(
          "Please ensure all items have a product selected and quantity greater than 0."
        );
        return;
      }

      const invalidDates = formData.items.filter(
        (item) =>
          item.manufactureDate &&
          item.expiryDate &&
          new Date(item.expiryDate) <= new Date(item.manufactureDate)
      );
      if (invalidDates.length > 0) {
        setError(
          "Expiry date must be after manufacture date for all items. Please correct the dates."
        );
        return;
      }

      const invalidManufactureDates = formData.items.filter(
        (item) =>
          item.manufactureDate &&
          new Date(item.manufactureDate) > new Date(formData.orderDate)
      );
      if (invalidManufactureDates.length > 0) {
        setError("Manufacture date cannot be later than order date.");
        return;
      }

      const orderNumber = `PO-${Date.now()}`;
      const createdOrder = await ordersApi.create({
        orderNumber,
        orderType: "inbound",
        supplierId: formData.supplierId,
        warehouseId: formData.warehouseId,
        orderDate: formData.orderDate,
        expectedDate: formData.expectedDeliveryDate,
        notes: formData.notes || undefined,
        status: "pending",
        priority: "normal",
      });

      // Bootstrap supplier-material links for suppliers that do not have mapping yet.
      if (!supplierHasMaterialLinks) {
        const uniqueMaterialIds = Array.from(
          new Set(formData.items.map((item) => item.productId).filter(Boolean))
        );
        if (uniqueMaterialIds.length > 0) {
          await suppliersApi.replaceMaterials(formData.supplierId, uniqueMaterialIds);
        }
      }

      const { orderItemsApi } = await import("@/lib/api/orderItems");
      try {
        await Promise.all(
          formData.items.map((item) =>
            orderItemsApi.create(createdOrder.id, {
              materialId: item.productId,
              quantity: item.quantityOrdered,
              locationCode: undefined,
            })
          )
        );
      } catch (itemError) {
        logger.error("Failed to create order items:", itemError);
        setError("Order created but failed to add items. Please edit the order to add items.");
      }

      showToast.success(
        `Inbound order created successfully with ${formData.items.length} item(s)!`
      );
      await onSaved();
      onClose();
    } catch (err) {
      logger.error("Failed to create inbound order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-xl border border-base-300 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <h2 className="text-2xl font-bold text-base-content">Create Inbound Order</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex items-center justify-center p-4 border-b border-base-300">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                    step >= s
                      ? "bg-primary text-primary-content"
                      : "bg-base-300 text-base-content/60"
                  )}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={clsx("w-16 h-1 mx-2", step > s ? "bg-primary" : "bg-base-300")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Order Details</h3>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Supplier *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={formData.supplierId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supplierId: e.target.value,
                    items: [],
                  })
                }
                required
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
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
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                required
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Order Date *</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Expected Delivery Date *</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.expectedDeliveryDate}
                onChange={(e) =>
                  setFormData({ ...formData, expectedDeliveryDate: e.target.value })
                }
                min={formData.orderDate || undefined}
                required
              />
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
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Add Items</h3>
            {!formData.supplierId && (
              <div className="alert alert-warning">
                <span>Select a supplier first to load available materials.</span>
              </div>
            )}
            {formData.supplierId && materials.length === 0 && (
              <div className="alert alert-info">
                <span>
                  No materials are linked to this supplier yet. Add supplier-material links before creating the inbound order.
                </span>
              </div>
            )}
            {formData.supplierId && materials.length > 0 && !supplierHasMaterialLinks && (
              <div className="alert alert-info">
                <span>
                  No supplier-material links exist yet. Selected items will initialize the supplier mapping.
                </span>
              </div>
            )}
            <div className="space-y-4">
              {formData.items.map((item, idx) => (
                <div key={idx} className="card bg-base-200 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-semibold">Item {idx + 1}</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        const newItems = formData.items.filter((_, i) => i !== idx);
                        setFormData({ ...formData, items: newItems });
                      }}
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Product *</span>
                      </label>
                      <select
                        className="select select-bordered select-sm"
                        value={item.productId}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].productId = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        required
                      >
                        <option value="">Select material</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Quantity *</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered input-sm"
                        value={item.quantityOrdered}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].quantityOrdered = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, items: newItems });
                        }}
                        required
                        min="1"
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Batch Number</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={item.batchNumber}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].batchNumber = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Manufacture Date</span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered input-sm ${
                          item.manufactureDate &&
                          item.expiryDate &&
                          new Date(item.expiryDate) <= new Date(item.manufactureDate)
                            ? "input-error"
                            : ""
                        }`}
                        value={item.manufactureDate}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].manufactureDate = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        max={formData.orderDate || item.expiryDate || undefined}
                      />
                      {item.manufactureDate &&
                        item.expiryDate &&
                        new Date(item.expiryDate) <= new Date(item.manufactureDate) && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              Expiry date must be after manufacture date
                            </span>
                          </label>
                        )}
                    </div>
                    <div className="form-control col-span-2">
                      <label className="label">
                        <span className="label-text text-xs">Expiry Date</span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered input-sm ${
                          item.manufactureDate &&
                          item.expiryDate &&
                          new Date(item.expiryDate) <= new Date(item.manufactureDate)
                            ? "input-error"
                            : ""
                        }`}
                        value={item.expiryDate}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].expiryDate = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        min={item.manufactureDate || undefined}
                      />
                      {item.manufactureDate &&
                        item.expiryDate &&
                        new Date(item.expiryDate) <= new Date(item.manufactureDate) && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              Expiry date must be after manufacture date
                            </span>
                          </label>
                        )}
                    </div>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-outline btn-sm w-full"
                disabled={!formData.supplierId || materials.length === 0}
                onClick={() => {
                  setFormData({
                    ...formData,
                    items: [
                      ...formData.items,
                      {
                        productId: "",
                        quantityOrdered: 0,
                        batchNumber: "",
                        manufactureDate: "",
                        expiryDate: "",
                      },
                    ],
                  });
                }}
              >
                <span className="material-symbols-outlined">add</span>
                Add Another Item
              </button>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Review & Confirm</h3>
            <div className="card bg-base-200 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-base-content/60">Supplier:</span>
                <span className="font-semibold">
                  {suppliers.find((s) => s.id === formData.supplierId)?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Warehouse:</span>
                <span className="font-semibold">
                  {warehouses.find((w) => w.id === formData.warehouseId)?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Order Date:</span>
                <span className="font-semibold">{formData.orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Expected Delivery:</span>
                <span className="font-semibold">{formData.expectedDeliveryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Total Items:</span>
                <span className="font-semibold">{formData.items.length}</span>
              </div>
            </div>
            <div className="divider"></div>
            <div className="space-y-2">
              <h4 className="font-semibold">Items:</h4>
              {formData.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>Item {idx + 1}</span>
                  <span>Qty: {item.quantityOrdered}</span>
                </div>
              ))}
            </div>
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Creating...
                  </>
                ) : (
                  "Create Order"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
