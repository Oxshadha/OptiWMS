"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import {
  useAvailableWorkers,
  useTaskAssignment,
} from "@/hooks/useTaskAssignment";
import { Worker, validateTaskAssignment } from "@/lib/task-assignment";
import { WorkerRole } from "@/lib/worker-roles";

// Mock data - will be replaced with API calls
const tasks = [
  {
    id: "task-1",
    taskNumber: "TASK-452368",
    taskType: "receiving",
    workerName: "John Doe",
    warehouseName: "Warehouse 1",
    priority: "high",
    status: "in_progress",
    assignedDate: "2025-12-15 08:00",
    startedAt: "2025-12-15 08:15",
    completedAt: null,
    duration: null,
  },
  {
    id: "task-2",
    taskNumber: "TASK-452369",
    taskType: "picking",
    workerName: "Jane Smith",
    warehouseName: "Warehouse 1",
    priority: "urgent",
    status: "in_progress",
    assignedDate: "2025-12-15 09:00",
    startedAt: "2025-12-15 09:05",
    completedAt: null,
    duration: null,
  },
  {
    id: "task-3",
    taskNumber: "TASK-452370",
    taskType: "putaway",
    workerName: "Mike Johnson",
    warehouseName: "Warehouse 2",
    priority: "normal",
    status: "completed",
    assignedDate: "2025-12-14 10:00",
    startedAt: "2025-12-14 10:10",
    completedAt: "2025-12-14 10:45",
    duration: 35,
  },
  {
    id: "task-4",
    taskNumber: "TASK-452371",
    taskType: "cycle_count",
    workerName: "John Doe",
    warehouseName: "Warehouse 1",
    priority: "normal",
    status: "assigned",
    assignedDate: "2025-12-15 11:00",
    startedAt: null,
    completedAt: null,
    duration: null,
  },
];

const taskTypeConfig = {
  receiving: { label: "Receiving", icon: "input", class: "badge-primary" },
  quality_check: {
    label: "Quality Check",
    icon: "verified",
    class: "badge-info",
  },
  putaway: { label: "Putaway", icon: "move_to_inbox", class: "badge-success" },
  picking: { label: "Picking", icon: "shopping_cart", class: "badge-warning" },
  packing: { label: "Packing", icon: "inventory_2", class: "badge-info" },
  cycle_count: {
    label: "Cycle Count",
    icon: "autorenew",
    class: "badge-accent",
  },
  returns: {
    label: "Returns",
    icon: "keyboard_return",
    class: "badge-warning",
  },
  relocation: { label: "Relocation", icon: "swap_horiz", class: "badge-info" },
  shipment: {
    label: "Shipment",
    icon: "local_shipping",
    class: "badge-primary",
  },
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

export default function TasksPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<(typeof tasks)[0] | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const summary = {
    totalTasksToday: 45,
    pending: 8,
    inProgress: 12,
    completedToday: 25,
  };

  const filteredTasks = tasks.filter((task) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      task.taskNumber.toLowerCase().includes(query) ||
      task.workerName.toLowerCase().includes(query) ||
      task.warehouseName.toLowerCase().includes(query) ||
      task.taskType.toLowerCase().includes(query) ||
      task.priority.toLowerCase().includes(query) ||
      task.status.toLowerCase().includes(query) ||
      task.assignedDate.toLowerCase().includes(query) ||
      (task.startedAt && task.startedAt.toLowerCase().includes(query)) ||
      (task.completedAt && task.completedAt.toLowerCase().includes(query)) ||
      (task.duration && task.duration.toString().includes(query));
    const matchesType = typeFilter === "all" || task.taskType === typeFilter;
    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const summaryCards = [
    {
      label: "Total Tasks Today",
      value: summary.totalTasksToday,
      icon: "task",
      color: "primary" as const,
    },
    {
      label: "Pending",
      value: summary.pending,
      icon: "schedule",
      color: "warning" as const,
    },
    {
      label: "In Progress",
      value: summary.inProgress,
      icon: "sync",
      color: "info" as const,
    },
    {
      label: "Completed Today",
      value: summary.completedToday,
      icon: "check_circle",
      color: "success" as const,
    },
  ];

  const columns = [
    {
      key: "taskNumber",
      label: "Task Number",
      render: (task: (typeof tasks)[0]) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTask(task);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {task.taskNumber}
        </button>
      ),
      sortable: true,
    },
    {
      key: "taskType",
      label: "Task Type",
      render: (task: (typeof tasks)[0]) => {
        const type =
          taskTypeConfig[task.taskType as keyof typeof taskTypeConfig];
        return (
          <div className="flex items-center gap-2">
            <span className={`badge ${type.class} whitespace-nowrap`}>
              <span className="material-symbols-outlined text-xs mr-1">
                {type.icon}
              </span>
              {type.label}
            </span>
          </div>
        );
      },
      sortable: true,
    },
    {
      key: "workerName",
      label: "Worker",
      sortable: true,
    },
    {
      key: "warehouseName",
      label: "Warehouse",
      sortable: true,
    },
    {
      key: "priority",
      label: "Priority",
      render: (task: (typeof tasks)[0]) => {
        const priority =
          priorityConfig[task.priority as keyof typeof priorityConfig];
        return (
          <span className={`badge ${priority.class} whitespace-nowrap`}>
            {priority.label}
          </span>
        );
      },
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (task: (typeof tasks)[0]) => {
        const status = statusConfig[task.status as keyof typeof statusConfig];
        return (
          <span className={`badge ${status.class} whitespace-nowrap`}>
            {status.label}
          </span>
        );
      },
      sortable: true,
    },
    {
      key: "assignedDate",
      label: "Assigned Date",
      render: (task: (typeof tasks)[0]) => task.assignedDate.split(" ")[0],
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "duration",
      label: "Duration",
      render: (task: (typeof tasks)[0]) =>
        task.duration ? `${task.duration} min` : "-",
      sortable: true,
    },
  ];

  const renderActions = (task: (typeof tasks)[0]) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <Link href={`/admin/tasks/${task.id}`}>
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            View Details
          </Link>
        </li>
        {task.status === "pending" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">
                person_add
              </span>
              Reassign Worker
            </button>
          </li>
        )}
        {task.status === "in_progress" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">cancel</span>
              Cancel Task
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Tasks</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Monitor and manage worker tasks
          </p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search tasks..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-64 border border-base-300 z-10"
            >
              <li className="menu-title">Task Type</li>
              <li>
                <button onClick={() => setTypeFilter("all")}>All Types</button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("receiving")}>
                  Receiving
                </button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("picking")}>
                  Picking
                </button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("putaway")}>
                  Putaway
                </button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("cycle_count")}>
                  Cycle Count
                </button>
              </li>
              <li className="menu-title mt-2">Status</li>
              <li>
                <button onClick={() => setStatusFilter("all")}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("pending")}>
                  Pending
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("in_progress")}>
                  In Progress
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("completed")}>
                  Completed
                </button>
              </li>
            </ul>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Tasks Table */}
      <DataTable
        data={filteredTasks}
        columns={columns}
        keyExtractor={(task) => task.id}
        onRowClick={(task) => {
          setSelectedTask(task);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No tasks found"
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
        />
      )}
    </div>
  );
}

// Task Detail Modal
function TaskDetailModal({
  isOpen,
  onClose,
  task,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: (typeof tasks)[0];
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
            <p>
              <span
                className={`badge ${
                  taskTypeConfig[task.taskType as keyof typeof taskTypeConfig]
                    .class
                }`}
              >
                {
                  taskTypeConfig[task.taskType as keyof typeof taskTypeConfig]
                    .label
                }
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
              <span
                className={`badge ${
                  priorityConfig[task.priority as keyof typeof priorityConfig]
                    .class
                }`}
              >
                {
                  priorityConfig[task.priority as keyof typeof priorityConfig]
                    .label
                }
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span
                className={`badge ${
                  statusConfig[task.status as keyof typeof statusConfig].class
                }`}
              >
                {statusConfig[task.status as keyof typeof statusConfig].label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Assigned Date
            </label>
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
              <label className="text-sm text-base-content/60">
                Completed At
              </label>
              <p className="font-semibold">{task.completedAt}</p>
            </div>
          )}
          {task.duration && (
            <div>
              <label className="text-sm text-base-content/60">Duration</label>
              <p className="font-semibold">{task.duration} minutes</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">View Full Details</button>
        </div>
      </div>
    </DetailModal>
  );
}

// Mock workers data - in production, this would come from API
const mockWorkers: Worker[] = [
  {
    id: "worker-1",
    workerId: "e8b5d4",
    name: "John Doe",
    role: "picker" as WorkerRole,
    warehouseId: "wh-1",
    warehouseName: "Warehouse 1",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    availabilityStatus: "available",
  },
  {
    id: "worker-2",
    workerId: "a3f7b2",
    name: "Jane Smith",
    role: "packer" as WorkerRole,
    warehouseId: "wh-1",
    warehouseName: "Warehouse 1",
    shiftStart: "09:00",
    shiftEnd: "18:00",
    availabilityStatus: "busy",
  },
  {
    id: "worker-3",
    workerId: "c9e1d6",
    name: "Mike Johnson",
    role: "forklift_operator" as WorkerRole,
    warehouseId: "wh-2",
    warehouseName: "Warehouse 2",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    availabilityStatus: "offline",
  },
];

// Create Task Modal
function CreateTaskModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
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

  // Get available workers for the selected task type
  const { availableWorkers, isLoading: isLoadingWorkers } = useAvailableWorkers(
    mockWorkers,
    formData.taskType || null,
    formData.warehouseId || undefined
  );

  // Get eligible workers (regardless of availability)
  const eligibleWorkers = formData.taskType
    ? mockWorkers.filter((w) => {
        if (formData.warehouseId && w.warehouseId !== formData.warehouseId) {
          return false;
        }
        // This will be filtered by the validation service
        return true;
      })
    : [];

  // Validate assignment when worker or task type changes
  useEffect(() => {
    if (
      formData.assignmentMethod === "manual" &&
      formData.workerId &&
      formData.taskType
    ) {
      const selectedWorker = mockWorkers.find(
        (w) => w.id === formData.workerId
      );
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
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate if manual assignment
    if (
      formData.assignmentMethod === "manual" &&
      formData.workerId &&
      formData.taskType
    ) {
      const selectedWorker = mockWorkers.find(
        (w) => w.id === formData.workerId
      );
      if (selectedWorker) {
        const validation = await validateTaskAssignment(
          selectedWorker,
          formData.taskType,
          {
            warehouseId: formData.warehouseId,
            taskType: formData.taskType,
          }
        );

        if (!validation.valid) {
          setValidationError(validation.error || "Invalid assignment");
          return;
        }
      }
    }

    // TODO: API call to create task
    console.log("Creating task:", formData);
    onClose();
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
            onChange={(e) =>
              setFormData({ ...formData, taskType: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, warehouseId: e.target.value })
            }
            required
          >
            <option value="">Select warehouse</option>
            <option value="wh-1">Warehouse 1</option>
            <option value="wh-2">Warehouse 2</option>
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
                <span className="text-sm text-base-content/60">
                  Loading workers...
                </span>
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
                    {worker.name} ({worker.workerId}) -{" "}
                    {worker.availabilityStatus}
                  </option>
                ))}
              </select>
            )}
            {validationError && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {validationError}
                </span>
              </label>
            )}
            {validationWarnings.length > 0 && (
              <div className="mt-2">
                {validationWarnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className="alert alert-warning py-2 px-3 text-sm"
                  >
                    <span className="material-symbols-outlined text-sm">
                      warning
                    </span>
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
            {formData.taskType &&
              availableWorkers.length === 0 &&
              !isLoadingWorkers && (
                <label className="label">
                  <span className="label-text-alt text-warning">
                    No workers available for this task type. Check worker roles
                    and availability.
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
            onChange={(e) =>
              setFormData({ ...formData, priority: e.target.value })
            }
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
            <span className="label-text font-medium">
              Related Order (Optional)
            </span>
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
            onChange={(e) =>
              setFormData({ ...formData, instructions: e.target.value })
            }
            placeholder="Additional instructions for the worker..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Task
          </button>
        </div>
      </form>
    </Modal>
  );
}
