"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { operationsApi } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";
import { CycleCountDisplay, countTypeConfig, statusConfig } from "../types";

// Cycle Count Detail Modal
export function CycleCountDetailModal({
  isOpen,
  onClose,
  count,
}: {
  isOpen: boolean;
  onClose: () => void;
  count: CycleCountDisplay;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Cycle Count: ${count.countNumber}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Count Number</label>
            <p className="font-semibold">{count.countNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{count.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Section</label>
            <p className="font-semibold">{count.sectionName || "Full Warehouse"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Count Type</label>
            <p>
              <span className={`badge ${countTypeConfig[count.countType as keyof typeof countTypeConfig].class}`}>
                {countTypeConfig[count.countType as keyof typeof countTypeConfig].label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Scheduled Date</label>
            <p className="font-semibold">{count.scheduledDate}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Actual Date</label>
            <p className="font-semibold">{count.actualDate || "Not started"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              {statusConfig[count.status as keyof typeof statusConfig].class === "badge-outline" ? (
                <span 
                  className="badge text-xs whitespace-nowrap" 
                  style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                >
                  {statusConfig[count.status as keyof typeof statusConfig].label}
                </span>
              ) : (
                <span className={`badge ${statusConfig[count.status as keyof typeof statusConfig].class}`}>
                  {statusConfig[count.status as keyof typeof statusConfig].label}
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Progress</label>
            <p className="font-semibold">{count.countedLocations}/{count.totalLocations}</p>
          </div>
        </div>

        <div className="divider">Assignment Details</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Assigned By</label>
            <p className="font-semibold">{count.assignedBy || "System"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Assigned Date</label>
            <p className="font-semibold">{count.assignedDate || "N/A"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Assigned Workers</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {count.assignedWorkers.map((worker, idx) => (
                <span key={idx} className="badge badge-primary badge-sm">{worker}</span>
              ))}
            </div>
          </div>
          {count.performedBy && (
            <div>
              <label className="text-sm text-base-content/60">Performed By</label>
              <p className="font-semibold">{count.performedBy}</p>
            </div>
          )}
        </div>

        <div className="divider">Count Results</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Total Locations</label>
            <p className="font-semibold">{count.totalLocations}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Counted Locations</label>
            <p className="font-semibold">{count.countedLocations}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Discrepancies Found</label>
            <p className={`font-semibold ${count.discrepanciesFound > 0 ? "text-warning" : ""}`}>
              {count.discrepanciesFound}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {count.status === "completed" && count.discrepanciesFound > 0 && (
            <button className="btn btn-primary">
              Review Discrepancies
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

// Schedule Cycle Count Modal
export function ScheduleCycleCountModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    warehouseId: "",
    countType: "full",
    sectionId: "",
    scheduledDate: "",
    assignmentMethod: "automatic",
    workers: [] as string[],
    recurrence: "none",
    notes: "",
  });

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoadingWarehouses(true);
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      await operationsApi.createCycleCount({
        countNumber: "",
        warehouseId: formData.warehouseId,
        locationCode: formData.countType === "full" ? "ALL" : (formData.sectionId || "A-01-01"),
        scheduledDate: formData.scheduledDate,
        status: "scheduled",
        notes: formData.notes || undefined,
      });
      
      showToast.success("Cycle count scheduled successfully");
      await onSuccess();
      onClose();
      // Reset form
      setFormData({
        warehouseId: "",
        countType: "full",
        sectionId: "",
        scheduledDate: "",
        assignmentMethod: "automatic",
        workers: [],
        recurrence: "none",
        notes: "",
      });
    } catch (err) {
      console.error("Failed to schedule cycle count:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to schedule cycle count");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Cycle Count" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.warehouseId}
            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
            required
            disabled={isLoadingWarehouses}
          >
            <option value="">{isLoadingWarehouses ? "Loading warehouses..." : "Select warehouse"}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Count Type *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="full"
                checked={formData.countType === "full"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Full Warehouse</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="section"
                checked={formData.countType === "section"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Specific Section</span>
            </label>
          </div>
        </div>

        {formData.countType === "section" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Section *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.sectionId}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              required={formData.countType === "section"}
            >
              <option value="">Select section</option>
              <option value="A-01-01">Section A - Electronics</option>
              <option value="B-01-01">Section B - Appliances</option>
              <option value="C-01-01">Section C - Home Decor</option>
            </select>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Scheduled Date *</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            required
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Worker Assignment *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="automatic"
                checked={formData.assignmentMethod === "automatic"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Automatic</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="manual"
                checked={formData.assignmentMethod === "manual"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Manual</span>
            </label>
          </div>
        </div>

        {formData.assignmentMethod === "manual" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Select Workers *</span>
            </label>
            <div className="space-y-2">
              {["John Doe", "Jane Smith", "Mike Johnson", "Sarah Lee"].map((worker) => (
                <label key={worker} className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.workers.includes(worker)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, workers: [...formData.workers, worker] });
                      } else {
                        setFormData({
                          ...formData,
                          workers: formData.workers.filter((w) => w !== worker),
                        });
                      }
                    }}
                  />
                  <span className="label-text">{worker}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Recurrence</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.recurrence}
            onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Schedule Count
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Ad-Hoc Count Modal
export function CreateAdHocCountModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    warehouseId: "",
    countType: "section",
    sectionId: "",
    startNow: false,
    assignmentMethod: "automatic",
    workers: [] as string[],
    notes: "",
  });

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoadingWarehouses(true);
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      // Create ad-hoc cycle count
      await operationsApi.createCycleCount({
        countNumber: "",
        warehouseId: formData.warehouseId,
        locationCode: formData.countType === "full" ? "ALL" : (formData.sectionId || "A-01-01"),
        scheduledDate: new Date().toISOString().split("T")[0],
        status: formData.startNow ? "in_progress" : "scheduled",
        notes: formData.notes || undefined,
      });
      
      showToast.success("Ad-hoc cycle count created successfully");
      await onSuccess();
      onClose();
      // Reset form
      setFormData({
        warehouseId: "",
        countType: "section",
        sectionId: "",
        startNow: false,
        assignmentMethod: "automatic",
        workers: [],
        notes: "",
      });
    } catch (err) {
      console.error("Failed to create ad-hoc cycle count:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create ad-hoc cycle count");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Ad-Hoc Cycle Count" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.warehouseId}
            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
            required
            disabled={isLoadingWarehouses}
          >
            <option value="">{isLoadingWarehouses ? "Loading warehouses..." : "Select warehouse"}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Count Type *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="full"
                checked={formData.countType === "full"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Full Warehouse</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="section"
                checked={formData.countType === "section"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Specific Section</span>
            </label>
          </div>
        </div>

        {formData.countType === "section" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Section *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.sectionId}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              required={formData.countType === "section"}
            >
              <option value="">Select section</option>
              <option value="A-01-01">Section A - Electronics</option>
              <option value="B-01-01">Section B - Appliances</option>
              <option value="C-01-01">Section C - Home Decor</option>
            </select>
          </div>
        )}

        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={formData.startNow}
              onChange={(e) => setFormData({ ...formData, startNow: e.target.checked })}
            />
            <span className="label-text">Start Now</span>
          </label>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Worker Assignment *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="automatic"
                checked={formData.assignmentMethod === "automatic"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Automatic</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="manual"
                checked={formData.assignmentMethod === "manual"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Manual</span>
            </label>
          </div>
        </div>

        {formData.assignmentMethod === "manual" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Select Workers *</span>
            </label>
            <div className="space-y-2">
              {["John Doe", "Jane Smith", "Mike Johnson", "Sarah Lee"].map((worker) => (
                <label key={worker} className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.workers.includes(worker)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, workers: [...formData.workers, worker] });
                      } else {
                        setFormData({
                          ...formData,
                          workers: formData.workers.filter((w) => w !== worker),
                        });
                      }
                    }}
                  />
                  <span className="label-text">{worker}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Count
          </button>
        </div>
      </form>
    </Modal>
  );
}


// Edit Schedule Modal
export function EditScheduleModal({
  isOpen,
  onClose,
  count,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  count: CycleCountDisplay;
  onUpdated: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    scheduledDate: count.scheduledDate || "",
    assignedWorkers: [...count.assignedWorkers],
    notes: "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await operationsApi.updateCycleCount(count.id, {
        scheduledDate: formData.scheduledDate,
        notes: formData.notes || undefined,
      });
      showToast.success("Schedule updated successfully");
      await onUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to update schedule:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update schedule");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Schedule: ${count.countNumber}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Scheduled Date *</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Assigned Workers</span>
          </label>
          <div className="space-y-2">
            {["John Doe", "Jane Smith", "Mike Johnson", "Sarah Lee"].map((worker) => (
              <label key={worker} className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={formData.assignedWorkers.includes(worker)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, assignedWorkers: [...formData.assignedWorkers, worker] });
                    } else {
                      setFormData({
                        ...formData,
                        assignedWorkers: formData.assignedWorkers.filter((w) => w !== worker),
                      });
                    }
                  }}
                />
                <span className="label-text">{worker}</span>
              </label>
            ))}
          </div>
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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Schedule
          </button>
        </div>
      </form>
    </Modal>
  );
}
