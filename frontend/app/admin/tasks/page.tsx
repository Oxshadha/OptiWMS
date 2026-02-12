"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import {
  useAvailableWorkers,
  useTaskAssignment,
} from "@/hooks/useTaskAssignment";
import { Worker, validateTaskAssignment } from "@/lib/task-assignment";
import { WorkerRole } from "@/lib/worker-roles";
import { tasksApi, Task } from "@/lib/api/tasks-api";
import { usersApi } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";

// Display format for tasks
interface TaskDisplay {
  id: string;
  taskNumber: string;
  taskType: string;
  workerName: string;
  warehouseName: string;
  priority: string;
  status: string;
  assignedDate: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
}

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
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const assignedWarehouseName = admin?.warehouseName;
  const canCancel = hasPermission(ADMIN_ROUTES.TASKS, "delete");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // API state
  const [tasks, setTasks] = useState<TaskDisplay[]>([]);
  const [users, setUsers] = useState<Map<string, string>>(new Map());
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load tasks, users, and warehouses in parallel
        const [tasksData, usersData, warehousesData] = await Promise.all([
          tasksApi.getAll(),
          usersApi.getAll(),
          warehousesApi.getAll(),
        ]);

        // Create lookup maps
        const usersMap = new Map();
        usersData.forEach((u) => {
          usersMap.set(u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username);
        });

        const warehousesMap = new Map();
        warehousesData.forEach((w) => {
          warehousesMap.set(w.id, w.name);
        });

        setUsers(usersMap);
        setWarehouses(warehousesMap);

        // Transform tasks to display format
        const displayTasks: TaskDisplay[] = tasksData.map((task) => {
          const workerName = task.assignedTo ? usersMap.get(task.assignedTo) || "Unassigned" : "Unassigned";
          const warehouseName = task.warehouseId ? warehousesMap.get(task.warehouseId) || "Unknown" : "Unknown";
          
          // Map backend status to frontend status
          let status = task.status;
          if (status === "pending") status = "assigned";
          if (status === "in_progress") status = "in_progress";
          if (status === "completed") status = "completed";
          if (status === "cancelled") status = "cancelled";

          // Calculate duration if completed
          let duration: number | null = null;
          if (task.completedAt && task.dueDate) {
            const start = new Date(task.dueDate);
            const end = new Date(task.completedAt);
            duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
          }

          return {
            id: task.id,
            taskNumber: task.taskNumber,
            taskType: task.taskType,
            workerName,
            warehouseName,
            priority: task.priority || "normal",
            status,
            assignedDate: task.dueDate || new Date().toISOString(),
            startedAt: task.dueDate || null,
            completedAt: task.completedAt || null,
            duration,
          };
        });

        setTasks(displayTasks);
      } catch (err) {
        console.error("Failed to load tasks:", err);
        setError("Failed to load tasks. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter tasks by warehouse for warehouse managers
  const tasksForWarehouse = isWarehouseManager && assignedWarehouseId
    ? tasks.filter((t) => {
        const task = tasks.find((task) => task.id === t.id);
        // Filter by warehouse ID if available
        return true; // TODO: Add warehouse ID to TaskDisplay
      })
    : tasks;

  // Calculate summary from tasks
  const today = new Date().toISOString().split("T")[0];
  const summary = {
    totalTasksToday: tasksForWarehouse.filter((t) => t.assignedDate.includes(today)).length,
    pending: tasksForWarehouse.filter((t) => t.status === "assigned" || t.status === "pending").length,
    inProgress: tasksForWarehouse.filter((t) => t.status === "in_progress").length,
    completedToday: tasksForWarehouse.filter((t) => t.status === "completed" && t.assignedDate.includes(today)).length,
  };

  const filteredTasks = tasksForWarehouse.filter((task) => {
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const columns = [
    {
      key: "taskNumber",
      label: "Task Number",
      render: (task: TaskDisplay) => (
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
      render: (task: TaskDisplay) => {
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
      render: (task: TaskDisplay) => {
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
      render: (task: TaskDisplay) => {
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
        {task.status === "in_progress" && canCancel && (
          <li>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTask(task);
                setShowCancelModal(true);
              }}
              className="text-error"
            >
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-base-content">Tasks</h1>
            {isWarehouseManager && assignedWarehouseName && (
              <div className="badge badge-primary badge-lg">
                <span className="material-symbols-outlined text-sm mr-1">warehouse</span>
                {assignedWarehouseName}
              </div>
            )}
          </div>
          <p className="text-sm text-base-content/60 mt-1">
            {isWarehouseManager && assignedWarehouseName
              ? `Tasks for ${assignedWarehouseName}`
              : "Monitor and manage worker tasks"}
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
          <Link href={`/admin/tasks/${task.id}`}>
            <button className="btn btn-primary">View Full Details</button>
          </Link>
        </div>
      </div>
    </DetailModal>
  );
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());

  // Fetch workers and warehouses from API
  useEffect(() => {
    const loadWorkersAndWarehouses = async () => {
      if (!isOpen) return; // Only load when modal is open
      
      try {
        setIsLoadingWorkers(true);
        
        // Fetch all worker roles - get users with worker roles
        const workerRoles = [
          'forklift_operator', 'stacker_operator', 'powered_pallet_truck_operator',
          'unloading_worker', 'cycle_count_worker', 'picker', 'packer',
          'shipment_worker', 'returns_worker', 'vehicle_inspector', 'warehouse_safekeeping_worker'
        ];
        
        const allWorkers: Worker[] = [];
        const warehousesMap = new Map<string, string>();
        
        // Fetch warehouses
        const warehousesData = await warehousesApi.getAll();
        warehousesData.forEach((w) => {
          warehousesMap.set(w.id, w.name);
        });
        setWarehouses(warehousesMap);
        
        // Fetch users for each worker role
        for (const role of workerRoles) {
          try {
            const users = await usersApi.getAll(role);
            users.forEach((user) => {
              // Map User to Worker format
              const worker: Worker = {
                id: user.id,
                workerId: user.employeeId || user.id.substring(0, 6),
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
                role: role as WorkerRole,
                warehouseId: user.warehouseId || '',
                warehouseName: user.warehouseId ? warehousesMap.get(user.warehouseId) || 'Unknown' : 'All Warehouses',
                shiftStart: "08:00", // Default, can be enhanced later
                shiftEnd: "17:00", // Default, can be enhanced later
                availabilityStatus: user.status === "active" ? "available" : "offline",
              };
              allWorkers.push(worker);
            });
          } catch (error) {
            console.error(`Error fetching workers with role ${role}:`, error);
          }
        }
        
        setWorkers(allWorkers);
      } catch (error) {
        console.error("Error loading workers:", error);
        setWorkers([]);
      } finally {
        setIsLoadingWorkers(false);
      }
    };
    
    loadWorkersAndWarehouses();
  }, [isOpen]);

  // Get available workers for the selected task type
  const { availableWorkers } = useAvailableWorkers(
    workers,
    formData.taskType || null,
    formData.warehouseId || undefined
  );

  // Get eligible workers (regardless of availability)
  const eligibleWorkers = formData.taskType
    ? workers.filter((w) => {
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
      const selectedWorker = workers.find(
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
    workers,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate if manual assignment
    if (
      formData.assignmentMethod === "manual" &&
      formData.workerId &&
      formData.taskType
    ) {
      const selectedWorker = workers.find(
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

    try {
      setIsSubmitting(true);
      setValidationError(null);

      // Generate task number
      const taskNumber = `TASK-${Date.now()}`;

      await tasksApi.create({
        taskNumber,
        taskType: formData.taskType,
        warehouseId: formData.warehouseId,
        assignedTo: formData.assignmentMethod === "manual" && formData.workerId ? formData.workerId : undefined,
        priority: formData.priority,
        status: "pending",
        notes: formData.instructions,
        referenceId: formData.relatedOrderId || undefined,
        referenceType: formData.relatedOrderId ? "order" : undefined,
      });

      onClose();
      // Reload page to refresh task list
      window.location.reload();
    } catch (err) {
      console.error("Failed to create task:", err);
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
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !!validationError}>
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
