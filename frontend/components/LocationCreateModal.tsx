"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { locationsApi, CreateLocationRequest } from "@/lib/api/locations";
import { showToast } from "@/lib/utils/toast";

interface LocationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseId: string;
  onSuccess?: () => void;
}

export function LocationCreateModal({
  isOpen,
  onClose,
  warehouseId,
  onSuccess,
}: LocationCreateModalProps) {
  const [formData, setFormData] = useState<CreateLocationRequest>({
    warehouseId,
    locationCode: "",
    area: "",
    rowNumber: "",
    bayNumber: "",
    levelNumber: 1,
    binPosition: "",
    locationType: "storage",
    capacity: undefined,
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        warehouseId,
        locationCode: "",
        area: "",
        rowNumber: "",
        bayNumber: "",
        levelNumber: 1,
        binPosition: "",
        locationType: "storage",
        capacity: undefined,
        isActive: true,
      });
    }
  }, [isOpen, warehouseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await locationsApi.create(formData);
      showToast.success("Location created successfully!");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to create location:", error);
      showToast.error("Failed to create location. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Location" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Location Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.locationCode}
            onChange={(e) => setFormData({ ...formData, locationCode: e.target.value.toUpperCase() })}
            required
            placeholder="e.g., ST-01-004-03-A"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Area</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value.toUpperCase() })}
              placeholder="e.g., ST"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Row Number</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.rowNumber}
              onChange={(e) => setFormData({ ...formData, rowNumber: e.target.value })}
              placeholder="e.g., 01"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Bay Number</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.bayNumber}
              onChange={(e) => setFormData({ ...formData, bayNumber: e.target.value })}
              placeholder="e.g., 004"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Level Number</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.levelNumber}
              onChange={(e) => setFormData({ ...formData, levelNumber: parseInt(e.target.value) || 1 })}
              min="1"
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Bin Position</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.binPosition}
            onChange={(e) => setFormData({ ...formData, binPosition: e.target.value.toUpperCase() })}
            placeholder="e.g., A"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Location Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.locationType}
              onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
            >
              <option value="storage">Storage</option>
              <option value="staging">Staging</option>
              <option value="picking">Picking</option>
              <option value="reserved">Reserved</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Capacity</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.capacity || ""}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text font-medium">Active</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Location"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

