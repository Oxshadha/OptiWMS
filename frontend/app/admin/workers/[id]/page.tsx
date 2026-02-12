"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import {
  WorkerRole,
  getAllWorkerRoles,
  ROLE_DISPLAY_NAMES,
  getRoleDisplayName,
} from "@/lib/worker-roles";
import { warehousesApi } from "@/lib/api/warehouses";

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
    email: "john.doe@optiwms.com",
    phone: "+1 234-567-8900",
    joinDate: "2024-01-15",
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
    email: "jane.smith@optiwms.com",
    phone: "+1 234-567-8901",
    joinDate: "2024-02-20",
  },
];

const statusConfig = {
  available: { label: "Available", class: "badge-success" },
  busy: { label: "Busy", class: "badge-warning" },
  offline: { label: "Offline", class: "badge-error" },
};

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAdmin();
  const workerId = params.id as string;
  const isEditMode = searchParams.get("edit") === "true";
  const worker = workers.find((w) => w.id === workerId);

  const canEdit = hasPermission(ADMIN_ROUTES.WORKERS, "edit");

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoadingWarehouses(true);
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData);
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };
    loadWarehouses();
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "" as WorkerRole | "",
    warehouseName: "",
    shiftStart: "",
    shiftEnd: "",
  });

  useEffect(() => {
    if (worker) {
      setFormData({
        name: worker.name,
        email: worker.email || "",
        phone: worker.phone || "",
        role: worker.role,
        warehouseName: worker.warehouseName,
        shiftStart: worker.shiftStart,
        shiftEnd: worker.shiftEnd,
      });
    }
  }, [worker]);

  if (!worker) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Worker not found</span>
          <Link href="/admin/workers" className="btn btn-sm">
            Back to Workers
          </Link>
        </div>
      </div>
    );
  }

  const status = statusConfig[worker.availabilityStatus as keyof typeof statusConfig];

  const handleSave = async () => {
    // TODO: API call to update worker
    console.log("Updating worker:", workerId, formData);
    router.push(`/admin/workers/${workerId}`);
  };

  if (isEditMode && !canEdit) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>You don't have permission to edit workers</span>
          <Link href={`/admin/workers/${workerId}`} className="btn btn-sm">
            View Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/workers" className="text-primary hover:underline mb-2 inline-block">
            ← Back to Workers
          </Link>
          <h1 className="text-3xl font-bold text-base-content">
            {isEditMode ? "Edit Worker" : worker.name}
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            {isEditMode ? "Update worker information" : "Worker Details"}
          </p>
        </div>
        {!isEditMode && canEdit && (
          <Link href={`/admin/workers/${workerId}?edit=true`}>
            <button className="btn btn-primary">
              <span className="material-symbols-outlined">edit</span>
              Edit Worker
            </button>
          </Link>
        )}
      </div>

      {/* Worker Information */}
      <div className="card bg-base-100 border border-base-300 p-6">
        {isEditMode ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Email *</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Role *</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as WorkerRole })}
                  required
                >
                  <option value="">Select role</option>
                  {getAllWorkerRoles().map((role) => (
                    <option key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Warehouse *</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={formData.warehouseName}
                  onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
                  required
                >
                  <option value="">{isLoadingWarehouses ? "Loading warehouses..." : "Select warehouse"}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.name}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Shift Start *</span>
                </label>
                <input
                  type="time"
                  className="input input-bordered w-full"
                  value={formData.shiftStart}
                  onChange={(e) => setFormData({ ...formData, shiftStart: e.target.value })}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Shift End *</span>
                </label>
                <input
                  type="time"
                  className="input input-bordered w-full"
                  value={formData.shiftEnd}
                  onChange={(e) => setFormData({ ...formData, shiftEnd: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/admin/workers/${workerId}`}>
                <button type="button" className="btn btn-ghost">Cancel</button>
              </Link>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-base-content/60">Worker ID</label>
              <p className="font-semibold font-mono">{worker.workerId}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Name</label>
              <p className="font-semibold text-lg">{worker.name}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Email</label>
              <p className="font-semibold">{worker.email}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Phone</label>
              <p className="font-semibold">{worker.phone}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Role</label>
              <p>
                <span className="badge badge-info">{getRoleDisplayName(worker.role)}</span>
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Warehouse</label>
              <p className="font-semibold">{worker.warehouseName}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Status</label>
              <p>
                <span className={`badge ${status.class}`}>{status.label}</span>
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Shift</label>
              <p className="font-semibold">{worker.shiftStart} - {worker.shiftEnd}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Tasks Today</label>
              <p className="font-semibold">{worker.tasksToday}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Total Tasks Completed</label>
              <p className="font-semibold">{worker.totalTasksCompleted}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Average Task Time</label>
              <p className="font-semibold">{worker.avgTaskTime} min</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Last Active</label>
              <p className="font-semibold">{worker.lastActive}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Join Date</label>
              <p className="font-semibold">{worker.joinDate}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

