"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import {
  WorkerRole,
  getRoleDisplayName,
} from "@/lib/worker-roles";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { usersApi } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";
import { tasksApi } from "@/lib/api/tasks-api";
import { showToast } from "@/lib/utils/toast";
import { WorkerDisplay, statusConfig } from "./types";
import {
  CreateWorkerModal,
  DeleteWorkerModal,
  EditWorkerModal,
  WorkerDetailModal,
} from "./components/WorkerModals";

export default function WorkersPage() {
  const { hasPermission, role, admin } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // API state
  const [workers, setWorkers] = useState<WorkerDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  const loadData = async () => {
    try {
        setIsLoading(true);
        setError(null);
        
        // Load all users, warehouses, and tasks
        // We'll filter for worker roles on the frontend
        const [allUsersData, warehousesData, tasksData] = await Promise.all([
          usersApi.getAll(), // Get all users
          warehousesApi.getAll(),
          tasksApi.getAll(),
        ]);
        
        // Filter for worker roles
        const workerRoles = [
          'forklift_operator', 'stacker_operator', 'powered_pallet_truck_operator',
          'unloading_worker', 'cycle_count_worker', 'picker', 'packer',
          'shipment_worker', 'returns_worker', 'vehicle_inspector', 'warehouse_safekeeping_worker'
        ];
        const usersData = allUsersData.filter(u => workerRoles.includes(u.role?.toLowerCase()));
        
        // Create warehouse lookup
        const warehousesMap = new Map<string, string>();
        warehousesData.forEach((w) => {
          warehousesMap.set(w.id, w.name);
        });
        
        // Count tasks per worker
        const taskCounts = new Map<string, number>();
        const completedTaskCounts = new Map<string, number>();
        tasksData.forEach((task) => {
          if (task.assignedTo) {
            taskCounts.set(task.assignedTo, (taskCounts.get(task.assignedTo) || 0) + 1);
            if (task.status === "completed") {
              completedTaskCounts.set(task.assignedTo, (completedTaskCounts.get(task.assignedTo) || 0) + 1);
            }
          }
        });
        
        // Transform to display format
        const displayWorkers: WorkerDisplay[] = usersData.map((u) => {
          const warehouseName = u.warehouseId ? warehousesMap.get(u.warehouseId) || "Unknown" : "Unassigned";
          const tasksToday = taskCounts.get(u.id) || 0;
          const totalCompleted = completedTaskCounts.get(u.id) || 0;
          
          // Map user role to WorkerRole
          const workerRole: WorkerRole = (u.role?.toLowerCase() || "picker") as WorkerRole;
          
          return {
            id: u.id,
            workerId: u.employeeId || u.id.slice(0, 6),
            name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username,
            warehouseName,
            availabilityStatus: u.status === "active" ? "available" : "offline",
            shiftStart: "08:00", // TODO: Get from user data
            shiftEnd: "17:00", // TODO: Get from user data
            tasksToday,
            totalTasksCompleted: totalCompleted,
            avgTaskTime: 15.0, // TODO: Calculate from task data
            lastActive: u.lastLoginAt || "Never",
            avatar: u.avatarUrl || "/assets/avatars/placeholder.svg",
            role: workerRole,
          };
        });
        
        setWorkers(displayWorkers);
      } catch (err) {
        console.error("Failed to load workers:", err);
        setError(err instanceof Error ? err.message : "Failed to load workers");
        setWorkers([]);
        if (err instanceof Error && !err.message.includes("Not authenticated")) {
          showToast.error("Failed to load workers. Please try again.");
        }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const canCreate = hasPermission(ADMIN_ROUTES.WORKERS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.WORKERS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.WORKERS, "delete");
  // Filter workers by warehouse for warehouse managers
  const filteredWorkersByWarehouse = isWarehouseManager && assignedWarehouseName
    ? workers.filter((w) => w.warehouseName === assignedWarehouseName)
    : workers;

  const summary = {
    totalWorkers: filteredWorkersByWarehouse.length,
    activeNow: filteredWorkersByWarehouse.filter((w) => w.availabilityStatus === "available" || w.availabilityStatus === "busy").length,
    offline: filteredWorkersByWarehouse.filter((w) => w.availabilityStatus === "offline").length,
    tasksCompletedToday: filteredWorkersByWarehouse.reduce((sum, w) => sum + w.tasksToday, 0),
  };

  const filteredWorkers = filteredWorkersByWarehouse.filter((worker) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      worker.name.toLowerCase().includes(query) ||
      worker.workerId.toLowerCase().includes(query) ||
      worker.warehouseName.toLowerCase().includes(query) ||
      worker.availabilityStatus.toLowerCase().includes(query) ||
      worker.shiftStart.toLowerCase().includes(query) ||
      worker.shiftEnd.toLowerCase().includes(query) ||
      worker.tasksToday.toString().includes(query) ||
      worker.totalTasksCompleted.toString().includes(query) ||
      worker.avgTaskTime.toString().includes(query) ||
      worker.lastActive.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" || worker.availabilityStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const summaryCards = [
    {
      label: "Total Workers",
      value: summary.totalWorkers,
      icon: "group",
      color: "primary" as const,
    },
    {
      label: "Active Now",
      value: summary.activeNow,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Offline",
      value: summary.offline,
      icon: "cancel",
      color: "error" as const,
    },
    {
      label: "Tasks Completed Today",
      value: summary.tasksCompletedToday,
      icon: "task_alt",
      color: "info" as const,
    },
  ];

  const columns = [
    {
      key: "workerId",
      label: "Worker ID",
      render: (worker: (typeof workers)[0]) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            <Image
              src={worker.avatar}
              alt={worker.name}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          </div>
          <span className="font-semibold">{worker.workerId}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "name",
      label: "Name",
      render: (worker: (typeof workers)[0]) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedWorker(worker);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {worker.name}
        </button>
      ),
      sortable: true,
    },
    {
      key: "warehouseName",
      label: "Warehouse",
      sortable: true,
    },
    {
      key: "role",
      label: "Role",
      render: (worker: (typeof workers)[0]) => {
        if (!worker.role)
          return <span className="text-base-content/50">-</span>;
        return (
          <div className="inline-block max-w-full">
            <span className=" whitespace-normal break-words block w-fit">
              {getRoleDisplayName(worker.role)}
            </span>
          </div>
        );
      },
      sortable: true,
    },
    {
      key: "availabilityStatus",
      label: "Status",
      render: (worker: (typeof workers)[0]) => {
        const status =
          statusConfig[worker.availabilityStatus as keyof typeof statusConfig];
        return <span className={`badge ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "shift",
      label: "Shift",
      render: (worker: (typeof workers)[0]) =>
        `${worker.shiftStart} - ${worker.shiftEnd}`,
    },
    {
      key: "tasksToday",
      label: "Tasks Today",
      sortable: true,
    },
    {
      key: "totalTasksCompleted",
      label: "Total Completed",
      sortable: true,
    },
    {
      key: "avgTaskTime",
      label: "Avg Time (min)",
      render: (worker: (typeof workers)[0]) => `${worker.avgTaskTime} min`,
      sortable: true,
    },
    {
      key: "lastActive",
      label: "Last Active",
      className: "text-base-content/70",
    },
  ];

  const renderActions = (worker: (typeof workers)[0]) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <Link href={`/admin/workers/${worker.id}`}>
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            View Details
          </Link>
        </li>
        {canEdit && (
          <li>
            <Link href={`/admin/workers/${worker.id}?edit=true`}>
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Worker
            </Link>
          </li>
        )}
        <li>
          <Link href={`/admin/tasks?worker=${worker.id}`}>
            <span className="material-symbols-outlined text-sm">task</span>
            View Tasks
          </Link>
        </li>
        <li>
          <Link href={`/admin/workers/${worker.id}?tab=performance`}>
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            Performance
          </Link>
        </li>
        {canDelete && (
          <li>
            <button
              className="text-error"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedWorker(worker);
                setShowDeleteModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete Worker
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
            <h1 className="text-3xl font-bold text-base-content">Workers</h1>
            {isWarehouseManager && assignedWarehouseName && (
              <div className="badge badge-primary badge-lg">
                <span className="material-symbols-outlined text-sm mr-1">warehouse</span>
                {assignedWarehouseName}
              </div>
            )}
          </div>
          <p className="text-sm text-base-content/60 mt-1">
            {isWarehouseManager && assignedWarehouseName
              ? `Workers assigned to ${assignedWarehouseName}`
              : "Manage warehouse workers and their performance"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => loadData()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="form-control">
            <input
              type="text"
              placeholder="Search workers..."
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
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setStatusFilter("all")}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("available")}>
                  Available
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("busy")}>Busy</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("offline")}>
                  Offline
                </button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add Worker</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Workers Table */}
      {error && (
        <div className="alert alert-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="btn btn-xs btn-ghost ml-auto" onClick={() => loadData()}>
            Retry
          </button>
        </div>
      )}
      {isLoading && (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-center gap-3 text-base-content/70">
            <span className="loading loading-spinner loading-md" />
            <span>Loading workers...</span>
          </div>
        </div>
      )}
      {!isLoading && (
        <DataTable
          data={filteredWorkers}
          columns={columns}
          keyExtractor={(worker) => worker.id}
          onRowClick={(worker) => {
            setSelectedWorker(worker);
            setShowDetailModal(true);
          }}
          actions={renderActions}
          emptyMessage="No workers found"
        />
      )}

      {/* Create Worker Modal */}
      <CreateWorkerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadData}
      />

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <WorkerDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedWorker(null);
          }}
          worker={selectedWorker}
          onEdit={(worker) => {
            setShowDetailModal(false);
            setSelectedWorker(worker);
            setShowEditModal(true);
          }}
          canEdit={canEdit}
        />
      )}

      {/* Edit Worker Modal */}
      {selectedWorker && (
        <EditWorkerModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedWorker(null);
          }}
          onUpdated={loadData}
          worker={selectedWorker}
        />
      )}

      {/* Delete Worker Modal */}
      {selectedWorker && (
        <DeleteWorkerModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedWorker(null);
          }}
          onConfirm={async () => {
            if (!selectedWorker) return;
            
            try {
              await usersApi.delete(selectedWorker.id);
              showToast.success("Worker deleted successfully");
              setShowDeleteModal(false);
              setSelectedWorker(null);
              await loadData();
            } catch (err) {
              console.error("Failed to delete worker:", err);
              showToast.error(err instanceof Error ? err.message : "Failed to delete worker");
            }
          }}
          worker={selectedWorker}
        />
      )}
    </div>
  );
}
