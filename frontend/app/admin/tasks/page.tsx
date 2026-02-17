"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { tasksApi } from "@/lib/api/tasks-api";
import { usersApi } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";
import { logger } from "@/lib/utils/logger";
import { CreateTaskModal, TaskDetailModal } from "./components/TaskModals";
import {
  priorityConfig,
  statusConfig,
  taskTypeConfig,
  type TaskDisplay,
} from "./types";

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

export default function TasksPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const assignedWarehouseName = admin?.warehouseName;
  const canCancel = hasPermission(ADMIN_ROUTES.TASKS, "delete");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [, setShowCancelModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // API state
  const [tasks, setTasks] = useState<TaskDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
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

      // Transform tasks to display format
      const displayTasks: TaskDisplay[] = tasksData.map((task) => {
        const workerName = task.assignedTo ? usersMap.get(task.assignedTo) || "Unassigned" : "Unassigned";
        const warehouseName = task.warehouseId ? warehousesMap.get(task.warehouseId) || "Unknown" : "Unknown";
        
        // Map backend status to frontend status
        let status = task.status;
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

        const notePairs = new Map<string, string>();
        (task.notes || "")
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => {
            const [k, ...rest] = part.split("=");
            if (!k || rest.length === 0) return;
            notePairs.set(k.trim().toLowerCase(), rest.join("=").trim());
          });
        const cycleCountRef =
          notePairs.get("count") ||
          (task.referenceType === "cycle_count" ? task.referenceId : null);
        const scope = notePairs.get("scope") || task.locationCode || null;
        const noteRole = notePairs.get("role") || null;
        const details =
          task.taskType === "cycle_count"
            ? [cycleCountRef ? `Count ${cycleCountRef}` : null, scope ? `Scope ${scope}` : null, noteRole ? `Role ${noteRole}` : null]
                .filter(Boolean)
                .join(" | ")
            : [task.referenceType ? `Ref ${task.referenceType}` : null, task.referenceId ? task.referenceId.slice(0, 8) : null]
                .filter(Boolean)
                .join(": ");

        return {
          id: task.id,
          taskNumber: task.taskNumber,
          taskType: task.taskType,
          workerName,
          warehouseId: task.warehouseId,
          warehouseName,
          priority: task.priority || "normal",
          status,
          assignedDate: task.dueDate || new Date().toISOString(),
          startedAt: task.dueDate || null,
          completedAt: task.completedAt || null,
          duration,
          locationCode: task.locationCode || null,
          referenceType: task.referenceType || null,
          referenceId: task.referenceId || null,
          notes: task.notes || null,
          details,
        };
      });

      setTasks(displayTasks);
    } catch (err) {
      logger.error("Failed to load tasks:", err);
      setError("Failed to load tasks. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter tasks by warehouse for warehouse managers
  const tasksForWarehouse = isWarehouseManager && assignedWarehouseId
    ? tasks.filter((t) => t.warehouseId === assignedWarehouseId)
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
      (task.details && task.details.toLowerCase().includes(query)) ||
      (task.notes && task.notes.toLowerCase().includes(query)) ||
      (task.referenceId && task.referenceId.toLowerCase().includes(query)) ||
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
          <button className="btn btn-sm" onClick={() => loadData()}>
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
          taskTypeConfig[task.taskType as keyof typeof taskTypeConfig] || {
            label: task.taskType,
            icon: "task",
            class: "badge-outline",
          };
        return (
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-base-content/70">
              {type.icon}
            </span>
            <StatusChip label={type.label} tone="neutral" />
          </div>
        );
      },
      sortable: true,
    },
    {
      key: "details",
      label: "Details",
      render: (task: TaskDisplay) => (
        <span className="text-xs text-base-content/70">
          {task.details || "-"}
        </span>
      ),
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
          priorityConfig[task.priority as keyof typeof priorityConfig] ||
          {
            label: task.priority,
            class: "badge-outline",
          };
        const tone = getTaskPriorityTone(task.priority);
        return (
          <StatusChip label={priority.label} tone={tone} />
        );
      },
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (task: TaskDisplay) => {
        const status = statusConfig[task.status as keyof typeof statusConfig] || {
          label: task.status,
          class: "badge-outline",
        };
        const tone = getTaskStatusTone(task.status);
        return <StatusChip label={status.label} tone={tone} showDot />;
      },
      sortable: true,
    },
    {
      key: "assignedDate",
      label: "Assigned Date",
      render: (task: TaskDisplay) => task.assignedDate.split(" ")[0],
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "duration",
      label: "Duration",
      render: (task: TaskDisplay) =>
        task.duration ? `${task.duration} min` : "-",
      sortable: true,
    },
  ];

  const renderActions = (task: TaskDisplay) => (
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
        onCreated={loadData}
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
