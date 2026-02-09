"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import {
  WorkerRole,
  getAllWorkerRoles,
  ROLE_DISPLAY_NAMES,
  getRoleDisplayName,
} from "@/lib/worker-roles";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { RolePermissions } from "@/components/RolePermissions";
import { getWorkerAvailabilityDetails } from "@/lib/worker-availability";
import { usersApi, User } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";
import { tasksApi } from "@/lib/api/tasks-api";
import { showToast } from "@/lib/utils/toast";

// Display format for workers
interface WorkerDisplay {
  id: string;
  workerId: string;
  name: string;
  warehouseName: string;
  availabilityStatus: "available" | "busy" | "offline";
  shiftStart: string;
  shiftEnd: string;
  tasksToday: number;
  totalTasksCompleted: number;
  avgTaskTime: number;
  lastActive: string;
  avatar: string;
  role: WorkerRole;
}

const statusConfig = {
  available: { label: "Available", class: "badge-success" },
  busy: { label: "Busy", class: "badge-warning" },
  offline: { label: "Offline", class: "badge-error" },
};

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

// Worker Detail Modal Component
function WorkerDetailModal({
  isOpen,
  onClose,
  worker,
  onEdit,
  canEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  worker: WorkerDisplay;
  onEdit?: (worker: WorkerDisplay) => void;
  canEdit?: boolean;
}) {
  const [availabilityDetails, setAvailabilityDetails] = useState<{
    status: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && worker) {
      getWorkerAvailabilityDetails({
        id: worker.id,
        shiftStart: worker.shiftStart,
        shiftEnd: worker.shiftEnd,
        availabilityStatus: worker.availabilityStatus as
          | "available"
          | "busy"
          | "offline"
          | undefined,
      }).then((details) => {
        setAvailabilityDetails({
          status: details.status,
          message: details.message,
        });
      });
    }
  }, [isOpen, worker]);

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Worker: ${worker.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            <Image
              src={worker.avatar}
              alt={worker.name}
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
          </div>
          <div>
            <h3 className="text-xl font-bold">{worker.name}</h3>
            <p className="text-sm text-base-content/60">
              Worker ID: {worker.workerId}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{worker.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span
                className={`badge ${
                  statusConfig[
                    worker.availabilityStatus as keyof typeof statusConfig
                  ].class
                }`}
              >
                {
                  statusConfig[
                    worker.availabilityStatus as keyof typeof statusConfig
                  ].label
                }
              </span>
            </p>
            {availabilityDetails && (
              <p className="text-xs text-base-content/60 mt-1">
                {availabilityDetails.message}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-base-content/60">Shift</label>
            <p className="font-semibold">
              {worker.shiftStart} - {worker.shiftEnd}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Tasks Today</label>
            <p className="font-semibold">{worker.tasksToday}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Total Tasks Completed
            </label>
            <p className="font-semibold">{worker.totalTasksCompleted}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Average Task Time
            </label>
            <p className="font-semibold">{worker.avgTaskTime} min</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Last Active</label>
            <p className="font-semibold">{worker.lastActive}</p>
          </div>
          {worker.role && (
            <div>
              <label className="text-sm text-base-content/60">Role</label>
              <p>
                <span className="badge badge-primary">
                  {getRoleDisplayName(worker.role)}
                </span>
              </p>
            </div>
          )}
        </div>
        {worker.role && (
          <div className="border-t pt-4">
            <RolePermissions role={worker.role} />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {canEdit && onEdit && (
            <button className="btn btn-primary" onClick={() => onEdit(worker)}>
              Edit Worker
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

// Create Worker Modal
function CreateWorkerModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => Promise<void>;
}) {
  const { hasPermission, role } = useAdmin();
  const canAssignRole =
    role === "admin" && hasPermission(ADMIN_ROUTES.WORKERS, "create");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    workerId: "",
    warehouseId: "",
    shiftStart: "",
    shiftEnd: "",
    password: "",
    role: "" as WorkerRole | "",
    avatar: null as File | null,
  });

  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load warehouses from API
  useEffect(() => {
    const loadWarehouses = async () => {
      if (!isOpen) return;
      
      try {
        setIsLoadingWarehouses(true);
        setError(""); // Clear previous errors
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
      } catch (err) {
        console.error("[CreateWorkerModal] Failed to load warehouses:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load warehouses. Please try again.";
        setError(errorMessage);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };
    
    loadWarehouses();
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (!formData.role) {
        throw new Error("Role is required");
      }
      if (!formData.warehouseId) {
        throw new Error("Warehouse is required");
      }

      // Generate username from email or use email as username
      const username = formData.email.split("@")[0] || formData.email;
      
      await usersApi.create({
        username: username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        employeeId: formData.workerId,
        role: formData.role,
        warehouseId: formData.warehouseId,
        phone: formData.phone || undefined,
        status: "active",
      });

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        workerId: "",
        warehouseId: "",
        shiftStart: "",
        shiftEnd: "",
        password: "",
        role: "" as WorkerRole | "",
        avatar: null,
      });
      
      // Close modal
      onClose();
      
      // Reload workers list
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err: any) {
      console.error("Failed to create worker:", err);
      
      // Try to extract error message from API response
      let errorMessage = "Failed to create worker. Please try again.";
      
      if (err?.response) {
        // Handle fetch API error response
        try {
          const errorData = await err.response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `API Error: ${err.response.status} - ${err.response.statusText || errorMessage}`;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      console.error("Error details:", {
        message: errorMessage,
        error: err,
        formData: {
          email: formData.email,
          role: formData.role,
          warehouseId: formData.warehouseId,
          workerId: formData.workerId,
        }
      });
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Worker" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">First Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Last Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email *</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Phone</span>
            </label>
            <input
              type="tel"
              className="input input-bordered w-full"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Worker ID *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.workerId}
              onChange={(e) =>
                setFormData({ ...formData, workerId: e.target.value })
              }
              required
            />
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
              disabled={isLoadingWarehouses}
            >
              <option value="">{isLoadingWarehouses ? "Loading warehouses..." : "Select warehouse"}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Shift Start Time</span>
            </label>
            <input
              type="time"
              className="input input-bordered w-full"
              value={formData.shiftStart}
              onChange={(e) =>
                setFormData({ ...formData, shiftStart: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Shift End Time</span>
            </label>
            <input
              type="time"
              className="input input-bordered w-full"
              value={formData.shiftEnd}
              onChange={(e) =>
                setFormData({ ...formData, shiftEnd: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Role *</span>
            {!canAssignRole && (
              <span className="label-text-alt text-warning">
                Only Admin can assign roles
              </span>
            )}
          </label>
          {canAssignRole ? (
            <select
              className="select select-bordered w-full"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as WorkerRole })
              }
              required
            >
              <option value="">Select role</option>
              {getAllWorkerRoles().map((role) => (
                <option key={role} value={role}>
                  {ROLE_DISPLAY_NAMES[role]}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="input input-bordered w-full input-disabled"
              value="Role assignment restricted to Admin"
              disabled
              readOnly
            />
          )}
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Password *</span>
          </label>
          <input
            type="password"
            className="input input-bordered w-full"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Avatar</span>
          </label>
          <input
            type="file"
            className="file-input file-input-bordered w-full"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setFormData({ ...formData, avatar: file });
            }}
          />
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button 
            type="button" 
            className="btn btn-ghost" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSubmitting || isLoadingWarehouses}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Worker"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Worker Modal
function EditWorkerModal({
  isOpen,
  onClose,
  onUpdated,
  worker,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  worker: WorkerDisplay;
}) {
  const { hasPermission, role } = useAdmin();
  const canAssignRole =
    role === "admin" && hasPermission(ADMIN_ROUTES.WORKERS, "edit");

  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: worker.name.split(" ")[0] || "",
    lastName: worker.name.split(" ").slice(1).join(" ") || "",
    email: "",
    phone: "",
    workerId: worker.workerId,
    warehouseId: "",
    shiftStart: worker.shiftStart,
    shiftEnd: worker.shiftEnd,
    password: "",
    role: worker.role || ("" as WorkerRole | ""),
    avatar: null as File | null,
  });

  // Load warehouses and user data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setIsLoadingWarehouses(true);
        
        // Load warehouses
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
        // Find warehouseId from warehouseName
        const matchingWarehouse = warehousesData.find(w => w.name === worker.warehouseName);
        if (matchingWarehouse) {
          setFormData(prev => ({
            ...prev,
            warehouseId: matchingWarehouse.id
          }));
        }

        // Load full user data to get email, phone, etc.
        try {
          const userData = await usersApi.getById(worker.id);
          setFormData(prev => ({
            ...prev,
            email: userData.email || "",
            phone: userData.phone || "",
          }));
        } catch (err) {
          console.warn("[EditWorkerModal] Could not load user details:", err);
        }
      } catch (err) {
        console.error("[EditWorkerModal] Failed to load warehouses:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load warehouses. Please try again.";
        showToast.error(errorMessage);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };

    loadData();
  }, [isOpen, worker.id, worker.warehouseName]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      // Update worker
      await usersApi.update(worker.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        employeeId: formData.workerId,
        role: formData.role || undefined,
        warehouseId: formData.warehouseId || undefined,
      });

      // If warehouse changed, assign it
      if (formData.warehouseId) {
        await usersApi.assignWarehouse(worker.id, formData.warehouseId);
      }

      showToast.success("Worker updated successfully");
      await onUpdated();
      onClose();
    } catch (err: any) {
      console.error("[EditWorkerModal] Failed to update worker:", err);
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to update worker. Please try again.";
      showToast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Worker" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">First Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Last Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email *</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Phone</span>
            </label>
            <input
              type="tel"
              className="input input-bordered w-full"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Worker ID *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.workerId}
              onChange={(e) =>
                setFormData({ ...formData, workerId: e.target.value })
              }
              required
            />
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
              disabled={isLoadingWarehouses}
            >
              <option value="">{isLoadingWarehouses ? "Loading warehouses..." : "Select warehouse"}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Shift Start Time</span>
            </label>
            <input
              type="time"
              className="input input-bordered w-full"
              value={formData.shiftStart}
              onChange={(e) =>
                setFormData({ ...formData, shiftStart: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Shift End Time</span>
            </label>
            <input
              type="time"
              className="input input-bordered w-full"
              value={formData.shiftEnd}
              onChange={(e) =>
                setFormData({ ...formData, shiftEnd: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Role</span>
            {!canAssignRole && (
              <span className="label-text-alt text-warning">
                Only Admin can assign roles
              </span>
            )}
          </label>
          {canAssignRole ? (
            <select
              className="select select-bordered w-full"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as WorkerRole })
              }
            >
              <option value="">No role assigned</option>
              {getAllWorkerRoles().map((role) => (
                <option key={role} value={role}>
                  {ROLE_DISPLAY_NAMES[role]}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="input input-bordered w-full input-disabled"
              value={worker.role ? getRoleDisplayName(worker.role) : "No role assigned"}
              disabled
              readOnly
            />
          )}
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">New Password</span>
            <span className="label-text-alt">Leave blank to keep current password</span>
          </label>
          <input
            type="password"
            className="input input-bordered w-full"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Avatar</span>
          </label>
          <input
            type="file"
            className="file-input file-input-bordered w-full"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setFormData({ ...formData, avatar: file });
            }}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || isLoadingWarehouses}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Updating...
              </>
            ) : (
              "Update Worker"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Delete Worker Modal
function DeleteWorkerModal({
  isOpen,
  onClose,
  onConfirm,
  worker,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  worker: WorkerDisplay;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Worker" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">
              Warning: This action cannot be undone!
            </h3>
            <div className="text-sm">
              You are about to delete <strong>{worker.name}</strong> (Worker ID:{" "}
              {worker.workerId}). This will permanently remove their access to
              the system and all associated data.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Name:</strong> {worker.name}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Worker ID:</strong> {worker.workerId}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Role:</strong>{" "}
            {worker.role ? getRoleDisplayName(worker.role) : "N/A"}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Warehouse:</strong> {worker.warehouseName}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Worker
          </button>
        </div>
      </div>
    </Modal>
  );
}
