"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { materialsApi, type Material } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

const HANDLING_UNITS = [
  { value: "bag", label: "Bag" },
  { value: "drum", label: "Drum" },
  { value: "reel", label: "Reel" },
  { value: "bucket", label: "Bucket" },
  { value: "pallet", label: "Pallet" },
  { value: "pcs", label: "Pieces" },
];

const inferStorageType = (unitType?: string) => {
  const unit = (unitType || "").toLowerCase();
  if (unit === "drum" || unit === "bucket") return "bulk";
  if (unit === "reel") return "rack";
  return "pallet";
};

const parsePositive = (value: string) => {
  if (!value || !value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const isInvalidPositiveInput = (value: string) => {
  if (!value || !value.trim()) return false;
  const parsed = Number(value);
  return !Number.isFinite(parsed) || parsed <= 0;
};

const validateMaterialForm = (formData: {
  materialCode: string;
  description: string;
  unitType: string;
  storageType: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
  volumeCm3: string;
  palletSpaces: string;
  unitsPerPallet: string;
  maxPalletWeightKg: string;
  minOrderQuantity: string;
  unitsPerHandlingUnit: string;
  orderMultiple: string;
}) => {
  if (!formData.materialCode.trim() || !formData.description.trim()) {
    return "Product code and description are required";
  }

  const weightKg = parsePositive(formData.weightKg);
  if (isInvalidPositiveInput(formData.weightKg)) return "Carton weight (kg) must be greater than 0";
  if (weightKg === undefined) return "Carton weight (kg) is required";

  const lengthCm = parsePositive(formData.lengthCm);
  if (isInvalidPositiveInput(formData.lengthCm)) return "Length (cm) must be greater than 0";
  const widthCm = parsePositive(formData.widthCm);
  if (isInvalidPositiveInput(formData.widthCm)) return "Width (cm) must be greater than 0";
  const heightCm = parsePositive(formData.heightCm);
  if (isInvalidPositiveInput(formData.heightCm)) return "Height (cm) must be greater than 0";

  const volumeCm3 = parsePositive(formData.volumeCm3);
  if (isInvalidPositiveInput(formData.volumeCm3)) return "Carton volume (cm3) must be greater than 0";
  if (isInvalidPositiveInput(formData.minOrderQuantity)) return "Minimum order quantity must be greater than 0";
  if (isInvalidPositiveInput(formData.unitsPerHandlingUnit)) return "Units per handling unit must be greater than 0";
  if (isInvalidPositiveInput(formData.unitsPerPallet)) return "Units per pallet must be greater than 0";
  if (isInvalidPositiveInput(formData.orderMultiple)) return "Order multiple must be greater than 0";
  const hasCompleteDims = lengthCm !== undefined && widthCm !== undefined && heightCm !== undefined;
  if (volumeCm3 === undefined && !hasCompleteDims) {
    return "Provide carton volume (cm3) or complete dimensions (L/W/H)";
  }

  if (formData.storageType === "pallet") {
    const unitsPerPallet = parsePositive(formData.unitsPerPallet);
    if (unitsPerPallet === undefined) return "Units per pallet is required for pallet storage";
    if (parsePositive(formData.unitsPerHandlingUnit) === undefined) return "Units per handling unit is required";
    if (isInvalidPositiveInput(formData.palletSpaces)) return "Pallet footprint spaces must be greater than 0";
    const maxPalletWeightKg = parsePositive(formData.maxPalletWeightKg);
    if (isInvalidPositiveInput(formData.maxPalletWeightKg)) return "Max carton weight must be greater than 0";
    if (maxPalletWeightKg === undefined) return "Max carton weight is required for pallet storage";
  } else {
    if (isInvalidPositiveInput(formData.palletSpaces)) return "Pallet footprint spaces must be greater than 0";
    if (isInvalidPositiveInput(formData.maxPalletWeightKg)) return "Max carton weight must be greater than 0";
  }

  return null;
};

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
    unitType: "bag",
    storageType: "pallet",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    weightKg: "",
    volumeCm3: "",
    palletSpaces: "",
    unitsPerPallet: "",
    maxPalletWeightKg: "",
    minOrderQuantity: "",
    unitsPerHandlingUnit: "",
    orderMultiple: "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateMaterialForm(formData);
    if (validationError) {
      showToast.error(validationError);
      return;
    }

    const lengthCm = parsePositive(formData.lengthCm);
    const widthCm = parsePositive(formData.widthCm);
    const heightCm = parsePositive(formData.heightCm);
    const computedVolume =
      lengthCm !== undefined && widthCm !== undefined && heightCm !== undefined
        ? Number((lengthCm * widthCm * heightCm).toFixed(2))
        : undefined;
    const volumeCm3 = parsePositive(formData.volumeCm3) ?? computedVolume;

    await onSubmit({
      materialCode: formData.materialCode.trim(),
      description: formData.description.trim(),
      materialType: formData.materialType || undefined,
      unitType: formData.unitType || undefined,
      storageType: formData.storageType || undefined,
      lengthCm,
      widthCm,
      heightCm,
      weightKg: parsePositive(formData.weightKg),
      volumeCm3,
      palletSpaces: parsePositive(formData.palletSpaces) ?? 1,
      unitsPerPallet: parsePositive(formData.unitsPerPallet),
      maxPalletWeightKg: parsePositive(formData.maxPalletWeightKg),
      minOrderQuantity: parsePositive(formData.minOrderQuantity),
      handlingUnitType: formData.unitType || undefined,
      unitsPerHandlingUnit: parsePositive(formData.unitsPerHandlingUnit),
      orderMultiple: parsePositive(formData.orderMultiple) ?? parsePositive(formData.unitsPerHandlingUnit),
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
            <span className="label-text font-medium">Category</span>
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
              <span className="label-text font-medium">Typical Unit Size</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.unitType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unitType: e.target.value,
                  storageType: inferStorageType(e.target.value),
                })
              }
              disabled={isLoading}
            >
              {HANDLING_UNITS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              <option value="rack">Rack</option>
              <option value="cold">Cold Storage</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Units Per Handling Unit</span>
              {formData.storageType === "pallet" && <span className="label-text-alt text-error">Required</span>}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              placeholder="e.g., 50"
              value={formData.unitsPerHandlingUnit}
              onChange={(e) => setFormData({ ...formData, unitsPerHandlingUnit: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Units Per Pallet</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              className="input input-bordered"
              placeholder="e.g., 1200"
              value={formData.unitsPerPallet}
              onChange={(e) => setFormData({ ...formData, unitsPerPallet: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Minimum Order Quantity</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              className="input input-bordered"
              placeholder="e.g., 150"
              value={formData.minOrderQuantity}
              onChange={(e) => setFormData({ ...formData, minOrderQuantity: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Order Multiple</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              className="input input-bordered"
              placeholder="e.g., 150"
              value={formData.orderMultiple}
              onChange={(e) => setFormData({ ...formData, orderMultiple: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Max Carton Weight (kg)</span>
              {formData.storageType === "pallet" && <span className="label-text-alt text-error">Required</span>}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              placeholder="e.g., 1500"
              value={formData.maxPalletWeightKg}
              onChange={(e) => setFormData({ ...formData, maxPalletWeightKg: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Carton Weight (kg)</span>
              <span className="label-text-alt text-error">Required</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="input input-bordered"
              placeholder="e.g., 0.250"
              value={formData.weightKg}
              onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Carton Volume (cm3)</span>
              <span className="label-text-alt">or provide L/W/H</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              placeholder="e.g., 1200"
              value={formData.volumeCm3}
              onChange={(e) => setFormData({ ...formData, volumeCm3: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Length (cm)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.lengthCm}
              onChange={(e) => setFormData({ ...formData, lengthCm: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Width (cm)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.widthCm}
              onChange={(e) => setFormData({ ...formData, widthCm: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Height (cm)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.heightCm}
              onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <label className="label">
          <span className="label-text-alt">Used for putaway split and bin capacity checks.</span>
        </label>

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
    unitType: material.unitType || "bag",
    storageType: material.storageType || "pallet",
    lengthCm: material.lengthCm != null ? String(material.lengthCm) : "",
    widthCm: material.widthCm != null ? String(material.widthCm) : "",
    heightCm: material.heightCm != null ? String(material.heightCm) : "",
    weightKg: material.weightKg != null ? String(material.weightKg) : "",
    volumeCm3: material.volumeCm3 != null ? String(material.volumeCm3) : "",
    palletSpaces: material.palletSpaces != null ? String(material.palletSpaces) : "",
    unitsPerPallet: material.unitsPerPallet != null ? String(material.unitsPerPallet) : "",
    maxPalletWeightKg:
      material.maxPalletWeightKg != null ? String(material.maxPalletWeightKg) : "",
    minOrderQuantity: material.minOrderQuantity != null ? String(material.minOrderQuantity) : "",
    unitsPerHandlingUnit: material.unitsPerHandlingUnit != null ? String(material.unitsPerHandlingUnit) : "",
    orderMultiple: material.orderMultiple != null ? String(material.orderMultiple) : "",
  });

  useEffect(() => {
    setFormData({
      materialCode: material.materialCode,
      description: material.description || "",
      materialType: material.materialType || "raw_material",
      unitType: material.unitType || "bag",
      storageType: material.storageType || "pallet",
      lengthCm: material.lengthCm != null ? String(material.lengthCm) : "",
      widthCm: material.widthCm != null ? String(material.widthCm) : "",
      heightCm: material.heightCm != null ? String(material.heightCm) : "",
      weightKg: material.weightKg != null ? String(material.weightKg) : "",
      volumeCm3: material.volumeCm3 != null ? String(material.volumeCm3) : "",
      palletSpaces: material.palletSpaces != null ? String(material.palletSpaces) : "",
      unitsPerPallet: material.unitsPerPallet != null ? String(material.unitsPerPallet) : "",
      maxPalletWeightKg:
        material.maxPalletWeightKg != null ? String(material.maxPalletWeightKg) : "",
      minOrderQuantity: material.minOrderQuantity != null ? String(material.minOrderQuantity) : "",
      unitsPerHandlingUnit: material.unitsPerHandlingUnit != null ? String(material.unitsPerHandlingUnit) : "",
      orderMultiple: material.orderMultiple != null ? String(material.orderMultiple) : "",
    });
  }, [material]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateMaterialForm(formData);
    if (validationError) {
      showToast.error(validationError);
      return;
    }

    const lengthCm = parsePositive(formData.lengthCm);
    const widthCm = parsePositive(formData.widthCm);
    const heightCm = parsePositive(formData.heightCm);
    const computedVolume =
      lengthCm !== undefined && widthCm !== undefined && heightCm !== undefined
        ? Number((lengthCm * widthCm * heightCm).toFixed(2))
        : undefined;
    const volumeCm3 = parsePositive(formData.volumeCm3) ?? computedVolume;

    await onSubmit(material.id, {
      materialCode: formData.materialCode.trim(),
      description: formData.description.trim(),
      materialType: formData.materialType || undefined,
      unitType: formData.unitType || undefined,
      storageType: formData.storageType || undefined,
      lengthCm,
      widthCm,
      heightCm,
      weightKg: parsePositive(formData.weightKg),
      volumeCm3,
      palletSpaces: parsePositive(formData.palletSpaces) ?? 1,
      unitsPerPallet: parsePositive(formData.unitsPerPallet),
      maxPalletWeightKg: parsePositive(formData.maxPalletWeightKg),
      minOrderQuantity: parsePositive(formData.minOrderQuantity),
      handlingUnitType: formData.unitType || undefined,
      unitsPerHandlingUnit: parsePositive(formData.unitsPerHandlingUnit),
      orderMultiple: parsePositive(formData.orderMultiple) ?? parsePositive(formData.unitsPerHandlingUnit),
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
            <span className="label-text font-medium">Category</span>
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
              <span className="label-text font-medium">Typical Unit Size</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.unitType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unitType: e.target.value,
                  storageType: inferStorageType(e.target.value),
                })
              }
              disabled={isLoading}
            >
              {HANDLING_UNITS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              <option value="rack">Rack</option>
              <option value="cold">Cold Storage</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Units Per Handling Unit</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.unitsPerHandlingUnit}
              onChange={(e) => setFormData({ ...formData, unitsPerHandlingUnit: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Units Per Pallet</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              className="input input-bordered"
              value={formData.unitsPerPallet}
              onChange={(e) => setFormData({ ...formData, unitsPerPallet: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Minimum Order Quantity</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              className="input input-bordered"
              value={formData.minOrderQuantity}
              onChange={(e) => setFormData({ ...formData, minOrderQuantity: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Order Multiple</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              className="input input-bordered"
              value={formData.orderMultiple}
              onChange={(e) => setFormData({ ...formData, orderMultiple: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Max Carton Weight (kg)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.maxPalletWeightKg}
              onChange={(e) => setFormData({ ...formData, maxPalletWeightKg: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Carton Weight (kg)</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="input input-bordered"
              value={formData.weightKg}
              onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Carton Volume (cm3)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.volumeCm3}
              onChange={(e) => setFormData({ ...formData, volumeCm3: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Length (cm)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.lengthCm}
              onChange={(e) => setFormData({ ...formData, lengthCm: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Width (cm)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.widthCm}
              onChange={(e) => setFormData({ ...formData, widthCm: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Height (cm)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input input-bordered"
              value={formData.heightCm}
              onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <label className="label">
          <span className="label-text-alt">Used for putaway split and bin capacity checks.</span>
        </label>

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
