"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { operationsApi } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { usersApi, type User } from "@/lib/api/users";
import { locationsApi, type Location } from "@/lib/api/locations";
import { showToast } from "@/lib/utils/toast";
import { CycleCountDisplay, countTypeConfig, statusConfig } from "../types";
import { logger } from "@/lib/utils/logger";

interface SectionOption {
  value: string;
  label: string;
}

const CYCLE_COUNT_ASSIGNABLE_ROLES = new Set([
  "cycle_count_worker",
]);

function getSectionOptions(locations: Location[]): SectionOption[] {
  const areaSet = new Set<string>();
  const locationCodePrefixSet = new Set<string>();
  locations.forEach((location) => {
    const area = location.area?.trim();
    if (area) {
      areaSet.add(area);
      return;
    }
    const code = location.locationCode?.trim();
    if (!code) {
      return;
    }
    const prefix = code.split("-")[0]?.trim();
    if (prefix) {
      locationCodePrefixSet.add(prefix);
    }
  });

  const areaOptions = Array.from(areaSet)
    .sort((a, b) => a.localeCompare(b))
    .map((area) => ({
      value: `AREA:${area}`,
      label: `Area ${area}`,
    }));
  const prefixOptions = Array.from(locationCodePrefixSet)
    .sort((a, b) => a.localeCompare(b))
    .map((prefix) => ({
      value: `AREA:${prefix}`,
      label: `Section ${prefix}`,
    }));

  return [...areaOptions, ...prefixOptions];
}

function toWorkerLabel(user: User): string {
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.username || user.employeeId || user.id;
}

function getCycleCountStatusTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "in_progress" || status === "recount_required") return "info";
  return "warning";
}

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
              <StatusChip
                label={countTypeConfig[count.countType as keyof typeof countTypeConfig].label}
                tone="neutral"
              />
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
              <StatusChip
                label={statusConfig[count.status as keyof typeof statusConfig].label}
                tone={getCycleCountStatusTone(count.status)}
                showDot
              />
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
                <StatusChip key={idx} label={worker} tone="neutral" />
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
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [availableWorkers, setAvailableWorkers] = useState<User[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoadingWarehouses(true);
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
      } catch (err) {
        logger.error("Failed to load warehouses:", err);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  useEffect(() => {
    const selectedWarehouseId = formData.warehouseId;
    if (!selectedWarehouseId) {
      setSectionOptions([]);
      setAvailableWorkers([]);
      setFormData((prev) => ({ ...prev, sectionId: "", workers: [] }));
      return;
    }

    const loadWarehouseScopedData = async () => {
      try {
        const [locations, users] = await Promise.all([
          locationsApi.getByWarehouse(selectedWarehouseId),
          usersApi.getAll(undefined, selectedWarehouseId, "active"),
        ]);
        const workerUsers = users.filter((u) => CYCLE_COUNT_ASSIGNABLE_ROLES.has(u.role?.toLowerCase?.() || ""));
        setSectionOptions(getSectionOptions(locations));
        setAvailableWorkers(workerUsers);
      } catch (err) {
        logger.error("Failed to load warehouse sections/workers:", err);
        setSectionOptions([]);
        setAvailableWorkers([]);
      } finally {
        setIsLoadingWorkers(false);
      }
    };

    setIsLoadingWorkers(true);
    loadWarehouseScopedData();
  }, [formData.warehouseId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      if (formData.countType === "section" && !formData.sectionId) {
        showToast.error("Please select a section for specific section cycle count.");
        return;
      }
      if (formData.assignmentMethod === "manual" && formData.workers.length === 0) {
        showToast.error("Please select at least one worker for manual assignment.");
        return;
      }

      await operationsApi.createCycleCount({
        countNumber: "",
        warehouseId: formData.warehouseId,
        locationCode: formData.countType === "full" ? "ALL" : formData.sectionId,
        assignedWorkers: formData.assignmentMethod === "manual" ? formData.workers : undefined,
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
      logger.error("Failed to schedule cycle count:", err);
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
            onChange={(e) =>
              setFormData({ ...formData, warehouseId: e.target.value, sectionId: "", workers: [] })
            }
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
                onChange={(e) => setFormData({ ...formData, countType: e.target.value, sectionId: "" })}
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
              onChange={(e) => setFormData({ ...formData, countType: e.target.value, sectionId: "" })}
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
              <option value="">
                {sectionOptions.length > 0 ? "Select section" : "No sections found for this warehouse"}
              </option>
              {sectionOptions.map((section) => (
                <option key={section.value} value={section.value}>
                  {section.label}
                </option>
              ))}
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
              {availableWorkers.map((worker) => (
                <label key={worker.id} className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.workers.includes(worker.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, workers: [...formData.workers, worker.id] });
                      } else {
                        setFormData({
                          ...formData,
                          workers: formData.workers.filter((w) => w !== worker.id),
                        });
                      }
                    }}
                  />
                  <span className="label-text">{toWorkerLabel(worker)}</span>
                </label>
              ))}
              {isLoadingWorkers && <span className="text-xs text-base-content/60">Loading workers...</span>}
              {!isLoadingWorkers && availableWorkers.length === 0 && (
                <span className="text-xs text-base-content/60">No active workers in selected warehouse.</span>
              )}
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
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [availableWorkers, setAvailableWorkers] = useState<User[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoadingWarehouses(true);
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
      } catch (err) {
        logger.error("Failed to load warehouses:", err);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  useEffect(() => {
    const selectedWarehouseId = formData.warehouseId;
    if (!selectedWarehouseId) {
      setSectionOptions([]);
      setAvailableWorkers([]);
      setFormData((prev) => ({ ...prev, sectionId: "", workers: [] }));
      return;
    }

    const loadWarehouseScopedData = async () => {
      try {
        const [locations, users] = await Promise.all([
          locationsApi.getByWarehouse(selectedWarehouseId),
          usersApi.getAll(undefined, selectedWarehouseId, "active"),
        ]);
        const workerUsers = users.filter((u) => CYCLE_COUNT_ASSIGNABLE_ROLES.has(u.role?.toLowerCase?.() || ""));
        setSectionOptions(getSectionOptions(locations));
        setAvailableWorkers(workerUsers);
      } catch (err) {
        logger.error("Failed to load warehouse sections/workers:", err);
        setSectionOptions([]);
        setAvailableWorkers([]);
      } finally {
        setIsLoadingWorkers(false);
      }
    };

    setIsLoadingWorkers(true);
    loadWarehouseScopedData();
  }, [formData.warehouseId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      if (formData.countType === "section" && !formData.sectionId) {
        showToast.error("Please select a section for specific section cycle count.");
        return;
      }
      if (formData.assignmentMethod === "manual" && formData.workers.length === 0) {
        showToast.error("Please select at least one worker for manual assignment.");
        return;
      }

      // Create ad-hoc cycle count
      await operationsApi.createCycleCount({
        countNumber: `ADH-${Date.now()}`,
        warehouseId: formData.warehouseId,
        locationCode: formData.countType === "full" ? "ALL" : formData.sectionId,
        assignedWorkers: formData.assignmentMethod === "manual" ? formData.workers : undefined,
        scheduledDate: new Date().toISOString().split("T")[0],
        status: formData.startNow ? "in_progress" : "scheduled",
        notes: [formData.notes?.trim(), "source=ad_hoc"].filter(Boolean).join(" | "),
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
      logger.error("Failed to create ad-hoc cycle count:", err);
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
            onChange={(e) =>
              setFormData({ ...formData, warehouseId: e.target.value, sectionId: "", workers: [] })
            }
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
              onChange={(e) => setFormData({ ...formData, countType: e.target.value, sectionId: "" })}
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
              <option value="">
                {sectionOptions.length > 0 ? "Select section" : "No sections found for this warehouse"}
              </option>
              {sectionOptions.map((section) => (
                <option key={section.value} value={section.value}>
                  {section.label}
                </option>
              ))}
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
              {availableWorkers.map((worker) => (
                <label key={worker.id} className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.workers.includes(worker.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, workers: [...formData.workers, worker.id] });
                      } else {
                        setFormData({
                          ...formData,
                          workers: formData.workers.filter((w) => w !== worker.id),
                        });
                      }
                    }}
                  />
                  <span className="label-text">{toWorkerLabel(worker)}</span>
                </label>
              ))}
              {isLoadingWorkers && <span className="text-xs text-base-content/60">Loading workers...</span>}
              {!isLoadingWorkers && availableWorkers.length === 0 && (
                <span className="text-xs text-base-content/60">No active workers in selected warehouse.</span>
              )}
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
  const [availableWorkers, setAvailableWorkers] = useState<User[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [resolvedWarehouseId, setResolvedWarehouseId] = useState<string>(count.warehouseId || "");
  const [formData, setFormData] = useState({
    scheduledDate: count.scheduledDate || "",
    assignedWorkers: [...(count.assignedWorkerIds || [])],
    notes: "",
  });

  useEffect(() => {
    setFormData({
      scheduledDate: count.scheduledDate || "",
      assignedWorkers: [...(count.assignedWorkerIds || [])],
      notes: "",
    });
    setResolvedWarehouseId(count.warehouseId || "");
  }, [count.id, count.scheduledDate, count.assignedWorkerIds, count.warehouseId]);

  useEffect(() => {
    const loadEditableData = async () => {
      if (!isOpen) {
        return;
      }
      try {
        const detail = await operationsApi.getCycleCountById(count.id);
        const warehouseId = detail.warehouseId || count.warehouseId || "";
        setResolvedWarehouseId(warehouseId);
        const assignedIds = detail.assignedWorkers || count.assignedWorkerIds || [];
        setFormData((prev) => ({
          ...prev,
          scheduledDate: detail.scheduledDate || prev.scheduledDate,
          assignedWorkers: [...assignedIds],
        }));

        if (!warehouseId) {
          setAvailableWorkers([]);
          return;
        }
        setIsLoadingWorkers(true);
        const users = await usersApi.getAll(undefined, warehouseId, "active");
        const eligibleWorkers = users.filter((u) =>
          CYCLE_COUNT_ASSIGNABLE_ROLES.has(u.role?.toLowerCase?.() || "")
        );
        setAvailableWorkers(eligibleWorkers);
      } catch (err) {
        logger.error("Failed to load cycle count edit data:", err);
        setAvailableWorkers([]);
      } finally {
        setIsLoadingWorkers(false);
      }
    };

    loadEditableData();
  }, [isOpen, count.id, count.assignedWorkerIds, count.warehouseId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await operationsApi.updateCycleCount(count.id, {
        scheduledDate: formData.scheduledDate,
        assignedWorkers: formData.assignedWorkers,
        notes: formData.notes || undefined,
      });
      showToast.success("Schedule updated successfully");
      await onUpdated();
      onClose();
    } catch (err) {
      logger.error("Failed to update schedule:", err);
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
            {availableWorkers.map((worker) => (
              <label key={worker.id} className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={formData.assignedWorkers.includes(worker.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, assignedWorkers: [...formData.assignedWorkers, worker.id] });
                    } else {
                      setFormData({
                        ...formData,
                        assignedWorkers: formData.assignedWorkers.filter((w) => w !== worker.id),
                      });
                    }
                  }}
                />
                <span className="label-text">{toWorkerLabel(worker)}</span>
              </label>
            ))}
            {isLoadingWorkers && <span className="text-xs text-base-content/60">Loading workers...</span>}
            {!isLoadingWorkers && availableWorkers.length === 0 && (
              <span className="text-xs text-base-content/60">
                {resolvedWarehouseId
                  ? "No cycle count workers found in this warehouse."
                  : "Warehouse not found for this cycle count."}
              </span>
            )}
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
