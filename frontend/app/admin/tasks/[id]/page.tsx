"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { tasksApi, Task } from "@/lib/api/tasks-api";
import { usersApi, User } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";
import { useAdmin } from "@/contexts/AdminContext";
import { showToast } from "@/lib/utils/toast";

interface TaskDetailDisplay {
  id: string;
  taskNumber: string;
  taskType: string;
  workerId: string | null;
  workerName: string;
  warehouseName: string;
  priority: string;
  status: string;
  assignedDate: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  locationCode: string | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
}

const taskTypeConfig = {
  receiving: { label: "Receiving", icon: "input", class: "badge-primary" },
  quality_check: { label: "Quality Check", icon: "verified", class: "badge-info" },
  putaway: { label: "Putaway", icon: "move_to_inbox", class: "badge-success" },
  picking: { label: "Picking", icon: "shopping_cart", class: "badge-warning" },
  packing: { label: "Packing", icon: "inventory_2", class: "badge-info" },
  cycle_count: { label: "Cycle Count", icon: "autorenew", class: "badge-accent" },
  returns: { label: "Returns", icon: "keyboard_return", class: "badge-warning" },
  relocation: { label: "Relocation", icon: "swap_horiz", class: "badge-info" },
  shipment: { label: "Shipment", icon: "local_shipping", class: "badge-primary" },
};

const statusConfig = {
  pending: { label: "Pending", class: "badge-outline" },
  assigned: { label: "Assigned", class: "badge-info" },
  in_progress: { label: "In Progress", class: "badge-primary" },
  completed: { label: "Completed", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};

const priorityConfig = {
  low: { label: "Low", class: "badge-outline" },
  normal: { label: "Normal", class: "badge-info" },
  high: { label: "High", class: "badge-warning" },
  urgent: { label: "Urgent", class: "badge-error" },
};

function toDisplayTask(
  task: Task,
  workerName: string,
  warehouseName: string
): TaskDetailDisplay {
  const assignedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleString()
    : "N/A";
  const completedAt = task.completedAt
    ? new Date(task.completedAt).toLocaleString()
    : null;
  const startedAt = task.status === "in_progress" ? assignedDate : null;

  let duration: number | null = null;
  if (task.completedAt && task.dueDate) {
    const start = new Date(task.dueDate);
    const end = new Date(task.completedAt);
    duration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  return {
    id: task.id,
    taskNumber: task.taskNumber,
    taskType: task.taskType,
    workerId: task.assignedTo || null,
    workerName,
    warehouseName,
    priority: task.priority || "normal",
    status: task.status || "pending",
    assignedDate,
    startedAt,
    completedAt,
    duration,
    locationCode: task.locationCode || null,
    referenceType: task.referenceType || null,
    referenceId: task.referenceId || null,
    notes: task.notes || null,
  };
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { admin } = useAdmin();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskDetailDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [workers, setWorkers] = useState<User[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiTask = await tasksApi.getById(taskId);
      const [usersData, warehousesData] = await Promise.all([
        usersApi.getAll(),
        warehousesApi.getAll(),
      ]);

      const workersOnly = usersData.filter((u) =>
        (u.role || "").toLowerCase().includes("worker")
      );
      setWorkers(workersOnly);

      const warehouseName = apiTask.warehouseId
        ? warehousesData.find((w) => w.id === apiTask.warehouseId)?.name || "Unknown"
        : "Unknown";
      const workerName = apiTask.assignedTo
        ? usersData.find((u) => u.id === apiTask.assignedTo)
          ? `${usersData.find((u) => u.id === apiTask.assignedTo)?.firstName || ""} ${
              usersData.find((u) => u.id === apiTask.assignedTo)?.lastName || ""
            }`.trim() ||
            usersData.find((u) => u.id === apiTask.assignedTo)?.username ||
            "Unknown"
          : "Unassigned"
        : "Unassigned";

      setTask(toDisplayTask(apiTask, workerName, warehouseName));
      setSelectedWorkerId(apiTask.assignedTo || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task");
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      loadData();
    }
  }, [taskId]);

  const taskType = useMemo(() => {
    if (!task) return null;
    return (
      taskTypeConfig[task.taskType as keyof typeof taskTypeConfig] || {
        label: task.taskType,
        icon: "task",
        class: "badge-outline",
      }
    );
  }, [task]);

  const status = useMemo(() => {
    if (!task) return null;
    return (
      statusConfig[task.status as keyof typeof statusConfig] || {
        label: task.status,
        class: "badge-outline",
      }
    );
  }, [task]);

  const priority = useMemo(() => {
    if (!task) return null;
    return (
      priorityConfig[task.priority as keyof typeof priorityConfig] || {
        label: task.priority,
        class: "badge-outline",
      }
    );
  }, [task]);

  const handleCancelTask = async () => {
    if (!task) return;
    try {
      setIsSubmitting(true);
      await tasksApi.updateStatus(task.id, "cancelled");
      showToast.success("Task cancelled");
      await loadData();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to cancel task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignWorker = async () => {
    if (!task) return;
    if (!selectedWorkerId) {
      showToast.warning("Please select a worker");
      return;
    }
    try {
      setIsSubmitting(true);
      await tasksApi.assign(task.id, {
        workerId: selectedWorkerId,
        assignedBy: admin?.id || "admin",
      });
      showToast.success("Task reassigned");
      setShowAssignModal(false);
      await loadData();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to reassign task");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !task || !taskType || !status || !priority) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>{error || "Task not found"}</span>
          <Link href="/admin/tasks" className="btn btn-sm">
            Back to Tasks
          </Link>
        </div>
      </div>
    );
  }

  const canReassign = task.status === "pending" || task.status === "assigned";
  const canCancel =
    task.status === "pending" || task.status === "assigned" || task.status === "in_progress";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tasks" className="text-primary hover:underline mb-2 inline-block">
            ← Back to Tasks
          </Link>
          <h1 className="text-3xl font-bold text-base-content">{task.taskNumber}</h1>
          <p className="text-sm text-base-content/60 mt-1">Task Details</p>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-base-content/60">Task Number</label>
            <p className="font-semibold text-lg">{task.taskNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Task Type</label>
            <p>
              <span className={`badge ${taskType.class}`}>
                <span className="material-symbols-outlined text-xs mr-1">
                  {taskType.icon}
                </span>
                {taskType.label}
              </span>
            </p>
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
              <span className={`badge ${priority.class}`}>{priority.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${status.class}`}>{status.label}</span>
            </p>
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
              <p className="font-semibold font-mono">{task.locationCode}</p>
            </div>
          )}
          {task.referenceType && task.referenceId && (
            <div>
              <label className="text-sm text-base-content/60">Related Reference</label>
              <p className="font-semibold">
                {task.referenceType}: {task.referenceId}
              </p>
            </div>
          )}
        </div>

        {task.notes && (
          <div className="mt-6 pt-6 border-t border-base-300">
            <label className="text-sm text-base-content/60">Notes</label>
            <p className="mt-2">{task.notes}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Link href="/admin/tasks">
          <button className="btn btn-ghost">Back to Tasks</button>
        </Link>
        {canReassign && (
          <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
            <span className="material-symbols-outlined">person_add</span>
            Reassign Worker
          </button>
        )}
        {canCancel && (
          <button
            className="btn btn-error"
            onClick={handleCancelTask}
            disabled={isSubmitting}
          >
            <span className="material-symbols-outlined">cancel</span>
            Cancel Task
          </button>
        )}
      </div>

      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Reassign Worker"
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Select Worker</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
            >
              <option value="">Choose worker</option>
              {workers.map((worker) => {
                const name =
                  `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
                  worker.username;
                return (
                  <option key={worker.id} value={worker.id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => setShowAssignModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAssignWorker} disabled={isSubmitting}>
              Assign
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
