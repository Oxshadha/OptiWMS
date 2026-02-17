"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

interface BulkRackCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    area: string;
    rowsToAdd: number;
    baysPerRow: number;
    levelsPerRack: number;
    binsPerLevel: number;
  }) => Promise<void>;
}

export function BulkRackCreateModal({ isOpen, onClose, onSubmit }: BulkRackCreateModalProps) {
  const [area, setArea] = useState("A");
  const [rowsToAdd, setRowsToAdd] = useState(2);
  const [baysPerRow, setBaysPerRow] = useState(3);
  const [levelsPerRack, setLevelsPerRack] = useState(5);
  const [binsPerLevel, setBinsPerLevel] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit({ area, rowsToAdd, baysPerRow, levelsPerRack, binsPerLevel });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Zone Racks" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-base-content/70">
          Creates new empty storage racks in selected zone. Existing rack coordinates are safely skipped.
        </p>

        <label className="form-control">
          <span className="label-text font-medium">Zone</span>
          <select
            className="select select-bordered"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            {["A", "B", "C", "D"].map((zone) => (
              <option key={zone} value={zone}>
                Zone {zone}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="form-control">
            <span className="label-text font-medium">Rows to Add</span>
            <input
              type="number"
              min={1}
              max={50}
              value={rowsToAdd}
              onChange={(e) => setRowsToAdd(Number(e.target.value))}
              className="input input-bordered"
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text font-medium">Bays per Row</span>
            <input
              type="number"
              min={1}
              max={50}
              value={baysPerRow}
              onChange={(e) => setBaysPerRow(Number(e.target.value))}
              className="input input-bordered"
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="form-control">
            <span className="label-text font-medium">Levels per Rack</span>
            <input
              type="number"
              min={1}
              max={10}
              value={levelsPerRack}
              onChange={(e) => setLevelsPerRack(Number(e.target.value))}
              className="input input-bordered"
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text font-medium">Bins per Level</span>
            <input
              type="number"
              min={1}
              max={5}
              value={binsPerLevel}
              onChange={(e) => setBinsPerLevel(Number(e.target.value))}
              className="input input-bordered"
              required
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Racks"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
