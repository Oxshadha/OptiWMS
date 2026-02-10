"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { materialsApi, type Material } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

export function CreateMaterialModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (material: Omit<Material, "id">) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    materialCode: "",
    description: "",
    materialType: "raw_material" as string,
    unitType: "",
    storageType: "pallet",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.materialCode.trim() || !formData.description.trim()) {
      showToast.error("Product code and description are required");
      return;
    }

    await onSubmit({
      materialCode: formData.materialCode.trim(),
      description: formData.description.trim(),
      materialType: formData.materialType || undefined,
      unitType: formData.unitType || undefined,
      storageType: formData.storageType || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Product to Catalog">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={formData.materialCode}
            onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description *</span>
          </label>
          <textarea
            className="textarea textarea-bordered"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={isLoading}
            rows={3}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Material Type</span>
          </label>
          <select
            className="select select-bordered"
            value={formData.materialType}
            onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
            disabled={isLoading}
          >
            <option value="raw_material">Raw Material</option>
            <option value="product">Product</option>
            <option value="packaging_material">Packaging</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Unit Type</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="e.g., kg, pcs, pallet"
              value={formData.unitType}
              onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
              disabled={isLoading}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Storage Type</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.storageType}
              onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
              disabled={isLoading}
            >
              <option value="pallet">Pallet</option>
              <option value="bulk">Bulk</option>
              <option value="loose">Loose</option>
              <option value="cold">Cold Storage</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? <span className="loading loading-spinner loading-sm"></span> : "Create Material"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function EditMaterialModal({
  isOpen,
  onClose,
  material,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  onSubmit: (id: string, material: Partial<Material>) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    materialCode: material.materialCode,
    description: material.description || "",
    materialType: material.materialType || "raw_material",
    unitType: material.unitType || "",
    storageType: material.storageType || "pallet",
  });

  useEffect(() => {
    setFormData({
      materialCode: material.materialCode,
      description: material.description || "",
      materialType: material.materialType || "raw_material",
      unitType: material.unitType || "",
      storageType: material.storageType || "pallet",
    });
  }, [material]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(material.id, {
      materialCode: formData.materialCode.trim(),
      description: formData.description.trim(),
      materialType: formData.materialType || undefined,
      unitType: formData.unitType || undefined,
      storageType: formData.storageType || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Product">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={formData.materialCode}
            onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description *</span>
          </label>
          <textarea
            className="textarea textarea-bordered"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={isLoading}
            rows={3}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Material Type</span>
          </label>
          <select
            className="select select-bordered"
            value={formData.materialType}
            onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
            disabled={isLoading}
          >
            <option value="raw_material">Raw Material</option>
            <option value="product">Product</option>
            <option value="packaging_material">Packaging</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Unit Type</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.unitType}
              onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
              disabled={isLoading}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Storage Type</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.storageType}
              onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
              disabled={isLoading}
            >
              <option value="pallet">Pallet</option>
              <option value="bulk">Bulk</option>
              <option value="loose">Loose</option>
              <option value="cold">Cold Storage</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? <span className="loading loading-spinner loading-sm"></span> : "Update Material"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ImportMaterialModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!file) {
      showToast.error("Please select a file");
      return;
    }

    try {
      setImporting(true);
      const result = await materialsApi.importCsv(file);
      if (result.successCount > 0) {
        showToast.success(`Successfully imported ${result.successCount} materials`);
        onSuccess();
      }
      if (result.errorCount > 0) {
        showToast.error(`${result.errorCount} materials failed to import`);
      }
    } catch (error: any) {
      logger.error("[Materials] Import failed:", error);
      showToast.error(error.message || "Failed to import materials");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Products from CSV">
      <div className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">CSV File</span>
          </label>
          <input
            type="file"
            accept=".csv"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={importing}
          />
          <label className="label">
            <span className="label-text-alt">
              CSV should contain: material_code, description, material_type, unit_type, storage_type
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!file || importing}>
            {importing ? <span className="loading loading-spinner loading-sm"></span> : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
