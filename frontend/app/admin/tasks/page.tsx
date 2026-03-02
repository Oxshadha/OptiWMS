"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
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

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getDurationMinutes(startedAt?: string | null, completedAt?: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
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
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const tasksQuery = useQuery({
    queryKey: [
      "admin-tasks",
      currentPage,
      itemsPerPage,
      typeFilter,
      statusFilter,
      searchQuery.trim() || "",
      isWarehouseManager ? assignedWarehouseId || "assigned" : "all",
    ],
    queryFn: () =>
      tasksApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "createdAt",
        sortDir: "desc",
        taskType: typeFilter === "all" ? undefined : typeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        warehouseId: isWarehouseManager ? assignedWarehouseId : undefined,
        q: searchQuery.trim() || undefined,
      }),
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const usersQuery = useQuery({
    queryKey: ["reference-data", "users"],
    queryFn: () => usersApi.getAll(),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  const warehousesQuery = useQuery({
    queryKey: ["reference-data", "warehouses"],
    queryFn: () => warehousesApi.getAll(),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const tasks = useMemo<TaskDisplay[]>(() => {
    const usersMap = new Map<string, string>();
    (usersQuery.data || []).forEach((user) => {
      usersMap.set(
        user.id,
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username
      );
    });

    const warehousesMap = new Map<string, string>();
    (warehousesQuery.data || []).forEach((warehouse) => {
      warehousesMap.set(warehouse.id, warehouse.name);
    });

    return (tasksQuery.data?.data || []).map((task) => {
      const workerName = task.assignedTo
        ? usersMap.get(task.assignedTo) || "Unassigned"
        : "Unassigned";
      const warehouseName = task.warehouseId
        ? warehousesMap.get(task.warehouseId) || "Unknown"
        : "Unknown";

      const duration = getDurationMinutes(task.startedAt, task.completedAt);

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
          ? [
              cycleCountRef ? `Count ${cycleCountRef}` : null,
              scope ? `Scope ${scope}` : null,
              noteRole ? `Role ${noteRole}` : null,
            ]
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
        status: task.status,
        assignedDate: task.dueDate || new Date().toISOString(),
        startedAt: task.startedAt || null,
        completedAt: task.completedAt || null,
        duration,
        locationCode: task.locationCode || null,
        referenceType: task.referenceType || null,
        referenceId: task.referenceId || null,
        notes: task.notes || null,
        details,
      };
    });
  }, [tasksQuery.data, usersQuery.data, warehousesQuery.data]);

  const isLoading =
    (tasksQuery.isPending && !tasksQuery.data) ||
    (usersQuery.isPending && !usersQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const isFetching =
    tasksQuery.isFetching || usersQuery.isFetching || warehousesQuery.isFetching;
  const error =
    tasksQuery.error || usersQuery.error || warehousesQuery.error
      ? "Failed to load tasks. Please try again."
      : null;
  const totalItems = tasksQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(tasksQuery.data?.totalPages ?? 1, 1);
  const reload = async () => {
    try {
      await Promise.all([
        tasksQuery.refetch(),
        usersQuery.refetch(),
        warehousesQuery.refetch(),
      ]);
    } catch (err) {
      logger.error("Failed to reload tasks:", err);
    }
  };

  const availableTaskTypes = Object.entries(taskTypeConfig);

  // Calculate summary from tasks
  const today = new Date().toISOString().split("T")[0];
  const summary = {
    totalTasksToday: tasks.filter((t) => t.assignedDate.includes(today)).length,
    pending: tasks.filter((t) => t.status === "assigned" || t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completedToday: tasks.filter((t) => t.status === "completed" && (t.completedAt || "").includes(today)).length,
  };

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
          <button className="btn btn-sm" onClick={() => void reload()}>
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
      render: (task: TaskDisplay) => formatDateTime(task.assignedDate),
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "startedAt",
      label: "Started At",
      render: (task: TaskDisplay) => formatDateTime(task.startedAt),
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "completedAt",
      label: "Completed At",
      render: (task: TaskDisplay) => formatDateTime(task.completedAt),
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "duration",
      label: "Duration",
      render: (task: TaskDisplay) =>
        task.duration !== null ? `${task.duration} min` : "-",
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
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-[80]"
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
          {isFetching && (
            <div className="flex items-center text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              Updating...
            </div>
          )}
          <div className="form-control">
            <input
              type="text"
              placeholder="Search tasks..."
              className="input input-bordered input-sm w-64"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
            />
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-64 border border-base-300 z-[80]"
            >
              <li className="menu-title">Task Type</li>
              <li>
                <button onClick={() => {
                  setTypeFilter("all");
                  setCurrentPage(1);
                }}>All Types</button>
              </li>
              {availableTaskTypes.map(([taskType, typeInfo]) => (
                <li key={taskType}>
                  <button onClick={() => {
                    setTypeFilter(taskType);
                    setCurrentPage(1);
                  }}>
                    {typeInfo.label}
                  </button>
                </li>
              ))}
              <li className="menu-title mt-2">Status</li>
              <li>
                <button onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("assigned");
                  setCurrentPage(1);
                }}>
                  Assigned
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("pending");
                  setCurrentPage(1);
                }}>
                  Pending
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("in_progress");
                  setCurrentPage(1);
                }}>
                  In Progress
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("completed");
                  setCurrentPage(1);
                }}>
                  Completed
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("cancelled");
                  setCurrentPage(1);
                }}>
                  Cancelled
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
        data={tasks}
        columns={columns}
        keyExtractor={(task) => task.id}
        onRowClick={(task) => {
          setSelectedTask(task);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No tasks found"
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
        showItemsPerPage
        onItemsPerPageChange={(next) => {
          setItemsPerPage(next);
          setCurrentPage(1);
        }}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={reload}
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
