"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { locationsApi, Location, UpdateLocationRequest } from "@/lib/api/locations";
import { showToast } from "@/lib/utils/toast";

interface LocationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  onSuccess?: () => void;
}

export function LocationEditModal({
  isOpen,
  onClose,
  location,
  onSuccess,
}: LocationEditModalProps) {
  const [formData, setFormData] = useState<UpdateLocationRequest>({
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
    if (location && isOpen) {
      setFormData({
        area: location.area || "",
        rowNumber: location.rowNumber || "",
        bayNumber: location.bayNumber || "",
        levelNumber: location.levelNumber || 1,
        binPosition: location.binPosition || "",
        locationType: location.locationType || "storage",
        capacity: location.capacity ? parseInt(location.capacity.toString()) : undefined,
        isActive: location.isActive,
      });
    }
  }, [location, isOpen]);

  if (!location) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await locationsApi.update(location.id, formData);
      showToast.success("Location updated successfully!");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to update location:", error);
      showToast.error("Failed to update location. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Location: ${location.locationCode}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Location Code</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={location.locationCode}
            disabled
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
                Updating...
              </>
            ) : (
              "Update Location"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

