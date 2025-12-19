"use client";

import { useState } from "react";
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
import { useEffect } from "react";

// Mock data - will be replaced with API calls
const workers = [
  {
    id: "worker-1",
    workerId: "e8b5d4",
    name: "John Doe",
    warehouseName: "Warehouse 1",
    availabilityStatus: "available",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    tasksToday: 12,
    totalTasksCompleted: 245,
    avgTaskTime: 15.5,
    lastActive: "2 minutes ago",
    avatar: "/assets/avatars/Jhon Doe.jpg",
    role: "picker" as WorkerRole,
  },
  {
    id: "worker-2",
    workerId: "a3f7b2",
    name: "Jane Smith",
    warehouseName: "Warehouse 1",
    availabilityStatus: "busy",
    shiftStart: "09:00",
    shiftEnd: "18:00",
    tasksToday: 8,
    totalTasksCompleted: 189,
    avgTaskTime: 18.2,
    lastActive: "5 minutes ago",
    avatar: "/assets/avatars/placeholder.svg",
    role: "packer" as WorkerRole,
  },
  {
    id: "worker-3",
    workerId: "c9e1d6",
    name: "Mike Johnson",
    warehouseName: "Warehouse 2",
    availabilityStatus: "offline",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    tasksToday: 0,
    totalTasksCompleted: 156,
    avgTaskTime: 20.1,
    lastActive: "2 hours ago",
    avatar: "/assets/avatars/placeholder.svg",
    role: "forklift_operator" as WorkerRole,
  },
];

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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<
    (typeof workers)[0] | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const canCreate = hasPermission(ADMIN_ROUTES.WORKERS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.WORKERS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.WORKERS, "delete");
  // Only Admin can assign roles
  const canAssignRole =
    role === "admin" && hasPermission(ADMIN_ROUTES.WORKERS, "create");

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

      {/* Create Worker Modal */}
      <CreateWorkerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
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
          onConfirm={() => {
            // TODO: API call to delete worker
            console.log("Deleting worker:", selectedWorker.id);
            setShowDeleteModal(false);
            setSelectedWorker(null);
          }}
          worker={selectedWorker}
        />
      )}
    </div>
  );
}

// Worker Detail Modal
function WorkerDetailModal({
  isOpen,
  onClose,
  worker,
}: {
  isOpen: boolean;
  onClose: () => void;
  worker: (typeof workers)[0];
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
          <button className="btn btn-primary">Edit Worker</button>
        </div>
      </div>
    </DetailModal>
  );
}

// Create Worker Modal
function CreateWorkerModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create worker
    console.log("Creating worker:", formData);
    onClose();
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
            >
              <option value="">Select warehouse</option>
              <option value="wh-1">Warehouse 1</option>
              <option value="wh-2">Warehouse 2</option>
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

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Worker
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
  worker: (typeof workers)[0];
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
