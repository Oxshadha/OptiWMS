"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { inventoryApi } from "@/lib/api/inventory";
import { materialsApi, Material } from "@/lib/api/materials";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";

export function AddInventoryItemModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;

  const [formData, setFormData] = useState({
    materialId: "",
    qty: "",
    location: "",
    warehouseId:
      isWarehouseManager && assignedWarehouseId ? assignedWarehouseId : "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [materialsData, warehousesData] = await Promise.all([
          materialsApi.getAll(),
          warehousesApi.getAll(),
        ]);
        setMaterials(materialsData);
        setWarehouses(warehousesData);
      } catch {
        setError("Failed to load materials/warehouses");
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isWarehouseManager && assignedWarehouseId && isOpen) {
      setFormData((prev) => ({ ...prev, warehouseId: assignedWarehouseId }));
    }
  }, [isWarehouseManager, assignedWarehouseId, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.materialId) {
        setError("Material not found. Please select a valid material.");
        return;
      }
      if (!formData.warehouseId) {
        setError("Please select a warehouse.");
        return;
      }

      await inventoryApi.create({
        materialId: formData.materialId,
        warehouseId: formData.warehouseId,
        locationCode: formData.location || undefined,
        quantity: formData.qty || "0",
        availableQuantity: formData.qty || "0",
        status: "active",
      });

      showToast.success("Inventory item added successfully!");
      await onSaved();
      onClose();
      setFormData({
        materialId: "",
        qty: "",
        location: "",
        warehouseId:
          isWarehouseManager && assignedWarehouseId ? assignedWarehouseId : "",
      });
    } catch {
      setError("Failed to add inventory item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title="Add Inventory Item" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Material *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.materialId}
            onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
            required
          >
            <option value="">Select material</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.materialCode} - {m.description}
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
            disabled={isWarehouseManager && assignedWarehouseId ? true : false}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
              <span className="label-text font-medium">Location</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
        </div>
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Adding...
              </>
            ) : (
              "Add Item"
            )}
          </button>
        </div>
      </form>
    </DetailModal>
  );
}
