"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip } from "@/components/StatusChip";
import { materialsApi, type Material } from "@/lib/api/materials";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { getMaterialTypeChip } from "@/lib/ui/material-type-chip";
import type { SupplierDisplay } from "../types";

export function SupplierDetailModal({
  isOpen,
  onClose,
  onEdit,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (supplier: SupplierDisplay) => void;
  supplier: SupplierDisplay;
}) {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Supplier: ${supplier.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Supplier Code</label>
            <p className="font-semibold">{supplier.supplierCode}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Country</label>
            <p className="font-semibold">{supplier.country}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p>
              <StatusChip label={supplier.type === "local" ? "Local" : "Foreign"} tone="neutral" />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Contact Person</label>
            <p className="font-semibold">{supplier.contactPerson}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Email</label>
            <p className="font-semibold">{supplier.email}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Phone</label>
            <p className="font-semibold">{supplier.phone}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Lead Time</label>
            <p className="font-semibold">{supplier.leadTimeDays != null ? `${supplier.leadTimeDays} days` : "—"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Rating</label>
            <p className="font-semibold">
              {supplier.rating != null ? (
                <>
                  <span className="text-warning">★</span> {supplier.rating.toFixed(1)}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip
                label={supplier.status === "active" ? "Active" : "Inactive"}
                tone={supplier.status === "active" ? "success" : "danger"}
                showDot
              />
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onEdit(supplier);
            }}
          >
            Edit Supplier
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

export function EditSupplierModal({
  isOpen,
  onClose,
  onUpdated,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  supplier: SupplierDisplay;
}) {
  const [formData, setFormData] = useState({
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    country: supplier.country,
    type: supplier.type,
    leadTimeDays: supplier.leadTimeDays != null ? supplier.leadTimeDays.toString() : "",
    rating: supplier.rating != null ? supplier.rating.toString() : "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const updateData: Partial<Supplier> = {
        code: formData.supplierCode,
        name: formData.name,
        contactPerson: formData.contactPerson || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        country: formData.country,
        leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
        rating: formData.rating || undefined,
      };

      await suppliersApi.update(supplier.id, updateData);
      showToast.success("Supplier updated successfully");
      await onUpdated();
      onClose();
    } catch (err) {
      logger.error("Failed to update supplier:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update supplier");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Supplier" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.supplierCode}
              onChange={(e) =>
                setFormData({ ...formData, supplierCode: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Contact Person</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.contactPerson}
              onChange={(e) =>
                setFormData({ ...formData, contactPerson: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Phone</span>
          </label>
          <input
            type="tel"
            className="input input-bordered w-full"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Country *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            required
          >
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="China">China</option>
            <option value="Canada">Canada</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Supplier Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as "local" | "foreign",
              })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Average Lead Time (days)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.leadTimeDays}
              onChange={(e) =>
                setFormData({ ...formData, leadTimeDays: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rating (0-5)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input input-bordered w-full"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Supplier
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateSupplierModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    supplierCode: "",
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    type: "" as "local" | "foreign" | "",
    leadTimeDays: "",
    rating: "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const createData: Omit<Supplier, "id"> = {
        code: formData.supplierCode,
        name: formData.name,
        contactPerson: formData.contactPerson || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        country: formData.country,
        leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
        rating: formData.rating || undefined,
        status: "active",
      };

      await suppliersApi.create(createData);
      showToast.success("Supplier created successfully");
      await onSuccess();
      onClose();
      setFormData({
        supplierCode: "",
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        country: "",
        type: "" as "local" | "foreign" | "",
        leadTimeDays: "",
        rating: "",
      });
    } catch (err) {
      logger.error("Failed to create supplier:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create supplier");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Supplier" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.supplierCode}
              onChange={(e) =>
                setFormData({ ...formData, supplierCode: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Contact Person</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.contactPerson}
              onChange={(e) =>
                setFormData({ ...formData, contactPerson: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Phone</span>
          </label>
          <input
            type="tel"
            className="input input-bordered w-full"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Address</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Country *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            required
          >
            <option value="">Select country</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="China">China</option>
            <option value="Canada">Canada</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Supplier Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as "local" | "foreign",
              })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Average Lead Time (days)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.leadTimeDays}
              onChange={(e) =>
                setFormData({ ...formData, leadTimeDays: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rating (0-5)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input input-bordered w-full"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Supplier
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteSupplierModal({
  isOpen,
  onClose,
  onConfirm,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  supplier: SupplierDisplay;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Supplier" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">Warning: This action cannot be undone!</h3>
            <div className="text-sm">
              You are about to delete <strong>{supplier.name}</strong> (Supplier Code:{" "}
              {supplier.supplierCode}). This will permanently remove the supplier from
              the system and all associated data.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Supplier Name:</strong> {supplier.name}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Supplier Code:</strong> {supplier.supplierCode}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Country:</strong> {supplier.country}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Supplier
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ManageSupplierMaterialsModal({
  isOpen,
  onClose,
  onSaved,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  supplier: SupplierDisplay;
}) {
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "raw_material" | "packaging_material" | "product">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!isOpen) return;
      try {
        setIsLoading(true);
        const [materialsData, linkedMaterials] = await Promise.all([
          materialsApi.getAll(),
          suppliersApi.getMaterials(supplier.id),
        ]);
        setAllMaterials(materialsData);
        setSelectedMaterialIds(new Set(linkedMaterials.map((m) => m.id)));
      } catch (err) {
        logger.error("Failed to load supplier materials:", err);
        showToast.error("Failed to load supplier products");
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [isOpen, supplier.id]);

  const filteredMaterials = allMaterials.filter((material) => {
    const actualType = material.materialType || "raw_material";
    if (typeFilter !== "all" && actualType !== typeFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      material.materialCode?.toLowerCase().includes(q) ||
      material.description?.toLowerCase().includes(q)
    );
  });

  const toggleMaterial = (materialId: string) => {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await suppliersApi.replaceMaterials(supplier.id, Array.from(selectedMaterialIds));
      showToast.success("Supplier products updated successfully");
      await onSaved();
      onClose();
    } catch (err) {
      logger.error("Failed to update supplier products:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update supplier products");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Products: ${supplier.name}`} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text font-medium">Search Products</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Search by material code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            >
              <option value="all">All</option>
              <option value="raw_material">Raw Material</option>
              <option value="packaging_material">Packaging</option>
              <option value="product">Product</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-base-content/70">
          Selected: <span className="font-semibold">{selectedMaterialIds.size}</span>
        </div>

        <div className="border border-base-300 rounded-lg max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="p-6 text-center text-base-content/60">
              No products found
            </div>
          ) : (
            <div className="divide-y divide-base-300">
              {filteredMaterials.map((material) => {
                const typeChip = getMaterialTypeChip(material.materialType);
                const checked = selectedMaterialIds.has(material.id);
                return (
                  <label
                    key={material.id}
                    className="flex items-start gap-3 p-3 cursor-pointer hover:bg-base-200/50"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm mt-1"
                      checked={checked}
                      onChange={() => toggleMaterial(material.id)}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{material.description}</div>
                      <div className="text-xs text-base-content/60 font-mono">{material.materialCode}</div>
                    </div>
                    <div className="ml-auto">
                      <StatusChip
                        label={typeChip.label}
                        tone={typeChip.tone}
                        className={typeChip.className}
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              "Save Products"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
