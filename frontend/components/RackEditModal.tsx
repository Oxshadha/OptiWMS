"use client";

import { useState, useEffect } from "react";
import { RackUnit, RackStatus } from "@/lib/types/warehouse-layout";
import { warehouseLayoutApi } from "@/lib/api/warehouse-layout";

interface RackEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  rack: RackUnit | null;
  warehouseId: string;
  onUpdate: (updatedRack: RackUnit) => void;
}

export function RackEditModal({
  isOpen,
  onClose,
  rack,
  warehouseId,
  onUpdate,
}: RackEditModalProps) {
  const [status, setStatus] = useState<RackStatus>("active");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (rack) {
      setStatus(rack.status);
      setDescription(rack.description || "");
      setNotes(rack.notes || "");
    }
  }, [rack]);

  if (!isOpen || !rack) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updatedRack = await warehouseLayoutApi.updateRack(warehouseId, rack.id, {
        status,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onUpdate(updatedRack);
      onClose();
    } catch (error) {
      console.error("Failed to update rack:", error);
      // In production, show error toast
      alert("Failed to update rack. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const statusOptions: { value: RackStatus; label: string; color: string; description: string }[] = [
    { 
      value: "active", 
      label: "Active", 
      color: "badge-success",
      description: "Rack is operational and available for use"
    },
    { 
      value: "maintenance", 
      label: "Maintenance", 
      color: "badge-warning",
      description: "Rack needs repair or attention - use with caution"
    },
    { 
      value: "reserved", 
      label: "Reserved", 
      color: "badge-info",
      description: "Rack is set aside for specific purpose"
    },
    { 
      value: "out_of_service", 
      label: "Out of Service", 
      color: "badge-error",
      description: "Rack is not available - do not use"
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="card-surface p-6 max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-base-content">
              Edit Rack: {rack.id}
            </h2>
            <p className="text-sm text-base-content/70 mt-1">
              Zone: {rack.zone} | Aisle: {rack.aisle.toString().padStart(2, "0")} | Bay: {rack.bay.toString().padStart(3, "0")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-circle btn-sm btn-ghost"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Status */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rack Status *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as RackStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="space-y-2 mt-3">
              {statusOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center gap-3 p-2 rounded-lg border-2 transition-all ${
                    status === option.value
                      ? "bg-base-200 border-primary"
                      : "bg-base-100 border-base-300"
                  }`}
                  onClick={() => setStatus(option.value)}
                  style={{ cursor: "pointer" }}
                >
                  <span className={`badge badge-sm ${option.color}`}>
                    {option.label}
                  </span>
                  <span className="text-xs text-base-content/70 flex-1">
                    {option.description}
                  </span>
                  {status === option.value && (
                    <span className="material-symbols-outlined text-primary text-sm">
                      check_circle
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Description</span>
              <span className="label-text-alt text-base-content/50">
                What's typically stored in this rack
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="e.g., Electronics storage - High value items"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Notes</span>
              <span className="label-text-alt text-base-content/50">
                Additional information or special instructions
              </span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-24"
              placeholder="e.g., Requires temperature control, Fragile items only"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="btn btn-ghost flex-1"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary flex-1"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

