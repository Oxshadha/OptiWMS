"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { useAvailableWorkers } from "@/hooks/useTaskAssignment";
import { Worker, validateTaskAssignment } from "@/lib/task-assignment";
import { WorkerRole } from "@/lib/worker-roles";
import { tasksApi } from "@/lib/api/tasks-api";
import { formatTaskNotes } from "@/lib/utils/task-notes";
import { usersApi } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";
import { logger } from "@/lib/utils/logger";
import { priorityConfig, statusConfig, taskTypeConfig, type TaskDisplay } from "../types";

function getTaskStatusTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "in_progress") return "info";
  return "warning";
}

function getTaskPriorityTone(priority: string): StatusTone {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "primary";
  if (priority === "normal") return "info";
  return "neutral";
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDisplay;
}) {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Task: ${task.taskNumber}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Task Number</label>
            <p className="font-semibold">{task.taskNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Task Type</label>
            {(() => {
              const type = taskTypeConfig[task.taskType as keyof typeof taskTypeConfig] || {
                label: task.taskType,
                icon: "task",
                class: "badge-outline",
              };
              return (
                <p>
                  <StatusChip label={type.label} tone="neutral" />
                </p>
              );
            })()}
          </div>
          <div>
            <label className="text-sm text-base-content/60">Worker</label>
            <p className="font-semibold">{task.workerName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{task.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Priority</label>
            <p>
              <StatusChip
                label={priorityConfig[task.priority as keyof typeof priorityConfig].label}
                tone={getTaskPriorityTone(task.priority)}
              />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            {(() => {
              const status = statusConfig[task.status as keyof typeof statusConfig] || {
                label: task.status,
                class: "badge-outline",
              };
              return (
                <p>
                  <StatusChip label={status.label} tone={getTaskStatusTone(task.status)} showDot />
                </p>
              );
            })()}
          </div>
          <div>
            <label className="text-sm text-base-content/60">Assigned Date</label>
            <p className="font-semibold">{task.assignedDate}</p>
          </div>
          {task.startedAt && (
            <div>
              <label className="text-sm text-base-content/60">Started At</label>
              <p className="font-semibold">{task.startedAt}</p>
            </div>
          )}
          {task.completedAt && (
            <div>
              <label className="text-sm text-base-content/60">Completed At</label>
              <p className="font-semibold">{task.completedAt}</p>
            </div>
          )}
          {task.duration !== null && (
            <div>
              <label className="text-sm text-base-content/60">Duration</label>
              <p className="font-semibold">{task.duration} minutes</p>
            </div>
          )}
          {task.locationCode && (
            <div>
              <label className="text-sm text-base-content/60">Location</label>
              <p className="font-semibold">{task.locationCode}</p>
            </div>
          )}
          {task.referenceType && (
            <div>
              <label className="text-sm text-base-content/60">Reference</label>
              <p className="font-semibold">
                {task.referenceType}
                {task.referenceId ? `: ${task.referenceId}` : ""}
              </p>
            </div>
          )}
          {formatTaskNotes(task.notes) && (
            <div className="col-span-2">
              <label className="text-sm text-base-content/60">Notes</label>
              <p className="font-semibold break-words whitespace-pre-line">
                {formatTaskNotes(task.notes)}
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <Link href={`/admin/tasks/${task.id}`}>
            <button className="btn btn-primary">View Full Details</button>
          </Link>
        </div>
      </div>
    </DetailModal>
  );
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    taskType: "",
    warehouseId: "",
    assignmentMethod: "automatic",
    workerId: "",
    priority: "normal",
    instructions: "",
    relatedOrderId: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadWorkersAndWarehouses = async () => {
      if (!isOpen) return;

      try {
        setIsLoadingWorkers(true);
        const workerRoles = [
          "forklift_operator",
          "stacker_operator",
          "powered_pallet_truck_operator",
          "unloading_worker",
          "cycle_count_worker",
          "picker",
          "packer",
          "shipment_worker",
          "returns_worker",
          "vehicle_inspector",
          "warehouse_safekeeping_worker",
        ];

        const allWorkers: Worker[] = [];
        const warehousesMap = new Map<string, string>();

        const warehousesData = await warehousesApi.getAll();
        warehousesData.forEach((w) => {
          warehousesMap.set(w.id, w.name);
        });
        setWarehouses(warehousesMap);

        for (const role of workerRoles) {
          try {
            const users = await usersApi.getAll(role);
            users.forEach((user) => {
              const worker: Worker = {
                id: user.id,
                workerId: user.employeeId || user.id.substring(0, 6),
                name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username,
                role: role as WorkerRole,
                warehouseId: user.warehouseId || "",
                warehouseName: user.warehouseId
                  ? warehousesMap.get(user.warehouseId) || "Unknown"
                  : "All Warehouses",
                shiftStart: "08:00",
                shiftEnd: "17:00",
                availabilityStatus: user.status === "active" ? "available" : "offline",
              };
              allWorkers.push(worker);
            });
          } catch (error) {
            logger.error(`Error fetching workers with role ${role}:`, error);
          }
        }

        setWorkers(allWorkers);
      } catch (error) {
        logger.error("Error loading workers:", error);
        setWorkers([]);
      } finally {
        setIsLoadingWorkers(false);
      }
    };

    void loadWorkersAndWarehouses();
  }, [isOpen]);

  const { availableWorkers } = useAvailableWorkers(
    workers,
    formData.taskType || null,
    formData.warehouseId || undefined
  );

  useEffect(() => {
    if (
      formData.assignmentMethod === "manual" &&
      formData.workerId &&
      formData.taskType
    ) {
      const selectedWorker = workers.find((w) => w.id === formData.workerId);
      if (selectedWorker) {
        validateTaskAssignment(selectedWorker, formData.taskType, {
          warehouseId: formData.warehouseId,
          taskType: formData.taskType,
        }).then((result) => {
          if (!result.valid) {
            setValidationError(result.error || "Invalid assignment");
            setValidationWarnings([]);
          } else {
            setValidationError(null);
            setValidationWarnings(result.warnings || []);
          }
        });
      }
    } else {
      setValidationError(null);
      setValidationWarnings([]);
    }
  }, [
    formData.workerId,
    formData.taskType,
    formData.warehouseId,
    formData.assignmentMethod,
    workers,
  ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      formData.assignmentMethod === "manual" &&
      formData.workerId &&
      formData.taskType
    ) {
      const selectedWorker = workers.find((w) => w.id === formData.workerId);
      if (selectedWorker) {
        const validation = await validateTaskAssignment(selectedWorker, formData.taskType, {
          warehouseId: formData.warehouseId,
          taskType: formData.taskType,
        });

        if (!validation.valid) {
          setValidationError(validation.error || "Invalid assignment");
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      setValidationError(null);
      const taskNumber = `TASK-${Date.now()}`;

      await tasksApi.create({
        taskNumber,
        taskType: formData.taskType,
        warehouseId: formData.warehouseId,
        assignedTo:
          formData.assignmentMethod === "manual" && formData.workerId
            ? formData.workerId
            : undefined,
        priority: formData.priority,
        status: "pending",
        notes: formData.instructions,
        referenceId: formData.relatedOrderId || undefined,
        referenceType: formData.relatedOrderId ? "order" : undefined,
      });

      await onCreated();
      onClose();
    } catch (err) {
      logger.error("Failed to create task:", err);
      setValidationError("Failed to create task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }

    setFormData({
      taskType: "",
      warehouseId: "",
      assignmentMethod: "automatic",
      workerId: "",
      priority: "normal",
      instructions: "",
      relatedOrderId: "",
    });
    setValidationError(null);
    setValidationWarnings([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Task" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Task Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.taskType}
            onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
            required
          >
            <option value="">Select task type</option>
            <option value="receiving">Receiving</option>
            <option value="quality_check">Quality Check</option>
            <option value="putaway">Putaway</option>
            <option value="picking">Picking</option>
            <option value="packing">Packing</option>
            <option value="cycle_count">Cycle Count</option>
            <option value="returns">Returns</option>
            <option value="relocation">Relocation</option>
            <option value="shipment">Shipment</option>
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
            disabled={isLoadingWorkers}
          >
            <option value="">Select warehouse</option>
            {Array.from(warehouses.entries()).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
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
                onChange={(e) =>
                  setFormData({ ...formData, assignmentMethod: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, assignmentMethod: e.target.value })
                }
              />
              <span className="label-text">Manual</span>
            </label>
          </div>
        </div>

        {formData.assignmentMethod === "manual" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Worker *</span>
              {formData.taskType && (
                <span className="label-text-alt text-info">
                  Showing workers who can perform {formData.taskType}
                </span>
              )}
            </label>
            {isLoadingWorkers ? (
              <div className="flex items-center gap-2">
                <span className="loading loading-spinner loading-sm"></span>
                <span className="text-sm text-base-content/60">Loading workers...</span>
              </div>
            ) : (
              <select
                className={`select select-bordered w-full ${
                  validationError ? "select-error" : ""
                }`}
                value={formData.workerId}
                onChange={(e) => {
                  setFormData({ ...formData, workerId: e.target.value });
                  setValidationError(null);
                }}
                required={formData.assignmentMethod === "manual"}
                disabled={!formData.taskType}
              >
                <option value="">
                  {formData.taskType
                    ? availableWorkers.length > 0
                      ? "Select worker"
                      : "No available workers for this task type"
                    : "Select task type first"}
                </option>
                {availableWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name} ({worker.workerId}) - {worker.availabilityStatus}
                  </option>
                ))}
              </select>
            )}
            {validationError && (
              <label className="label">
                <span className="label-text-alt text-error">{validationError}</span>
              </label>
            )}
            {validationWarnings.length > 0 && (
              <div className="mt-2">
                {validationWarnings.map((warning, idx) => (
                  <div key={idx} className="alert alert-warning py-2 px-3 text-sm">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
            {formData.taskType && availableWorkers.length === 0 && !isLoadingWorkers && (
              <label className="label">
                <span className="label-text-alt text-warning">
                  No workers available for this task type. Check worker roles and
                  availability.
                </span>
              </label>
            )}
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Priority *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            required
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Related Order (Optional)</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.relatedOrderId}
            onChange={(e) =>
              setFormData({ ...formData, relatedOrderId: e.target.value })
            }
            placeholder="Order number or ID"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Instructions</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            placeholder="Additional instructions for the worker..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !!validationError}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
