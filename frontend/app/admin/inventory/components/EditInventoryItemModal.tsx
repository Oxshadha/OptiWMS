"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DetailModal } from "@/components/DetailModal";
import { inventoryApi } from "@/lib/api/inventory";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";
import { InventoryDisplayItem } from "../types";

export function EditInventoryItemModal({
  isOpen,
  onClose,
  onSaved,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  item: InventoryDisplayItem;
}) {
  const [formData, setFormData] = useState({
    qty: item.qty.toString(),
    location: item.location,
    warehouseId: item.warehouseId,
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData({
      qty: item.qty.toString(),
      location: item.location,
      warehouseId: item.warehouseId,
    });
  }, [item]);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
      } catch {
        showToast.error("Failed to load warehouses");
      }
    };
    loadWarehouses();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const currentQty = item.qty;
      const newQty = parseFloat(formData.qty) || 0;
      const quantityChange = newQty - currentQty;

      if (quantityChange !== 0) {
        await inventoryApi.updateQuantity(item.id, quantityChange);
      }
      if (formData.warehouseId !== item.warehouseId) {
        await inventoryApi.update(item.id, {
          warehouseId: formData.warehouseId,
        });
      }
      if (formData.location !== item.location) {
        await inventoryApi.update(item.id, {
          locationCode: formData.location || undefined,
        });
      }

      showToast.success("Inventory updated successfully!");
      await onSaved();
      onClose();
    } catch {
      showToast.error("Failed to update inventory. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Inventory: ${item.sku}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">SKU</span>
          </label>
          <input type="text" className="input input-bordered w-full" value={item.sku} disabled />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Item Name</span>
          </label>
          <input type="text" className="input input-bordered w-full" value={item.name} disabled />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Quantity *</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            value={formData.qty}
            onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
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
            <span className="label-text font-medium">Location</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Updating...
              </>
            ) : (
              "Update Inventory"
            )}
          </button>
        </div>
      </form>
    </DetailModal>
  );
}
