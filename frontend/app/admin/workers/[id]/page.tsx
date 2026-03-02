"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import {
  WorkerRole,
  getAllWorkerRoles,
  getRoleDisplayName,
} from "@/lib/worker-roles";
import { usersApi } from "@/lib/api/users";
import { tasksApi } from "@/lib/api/tasks-api";
import {
  useInvalidateAdminListAndDetail,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";

interface WorkerDetailDisplay {
  id: string;
  workerId: string;
  name: string;
  email: string;
  phone: string;
  role: WorkerRole;
  warehouseId: string;
  warehouseName: string;
  availabilityStatus: "available" | "busy" | "offline";
  shiftStart: string;
  shiftEnd: string;
  tasksToday: number;
  totalTasksCompleted: number;
  avgTaskTime: number;
  lastActive: string;
  joinDate: string;
  status: string;
}

const statusConfig: Record<string, { label: string; tone: StatusTone }> = {
  available: { label: "Available", tone: "success" },
  busy: { label: "Busy", tone: "warning" },
  offline: { label: "Offline", tone: "danger" },
};

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAdmin();
  const workerId = params.id as string;
  const isEditMode = searchParams.get("edit") === "true";

  const canEdit = hasPermission(ADMIN_ROUTES.WORKERS, "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "" as WorkerRole | "",
    warehouseId: "",
    shiftStart: "08:00",
    shiftEnd: "17:00",
  });
  const workerQuery = useQuery({
    queryKey: ["admin-workers", "detail", workerId],
    queryFn: async () => {
      const [user, tasks] = await Promise.all([
        usersApi.getById(workerId),
        tasksApi.getAll(undefined, undefined, workerId),
      ]);

      const workerRoles = new Set(getAllWorkerRoles().map((role) => role.toLowerCase()));
      if (!workerRoles.has((user.role || "").toLowerCase())) {
        throw new Error("User is not a worker");
      }

      return { user, tasks };
    },
    enabled: !!workerId,
  });
  const warehousesQuery = useReferenceWarehouses();
  const invalidateWorker = useInvalidateAdminListAndDetail(
    ["admin-workers"],
    (id) => ["admin-workers", "detail", id]
  );

  const worker = useMemo<WorkerDetailDisplay | null>(() => {
    if (!workerQuery.data) {
      return null;
    }

    const { user, tasks } = workerQuery.data;
    const warehouseMap = new Map<string, string>();
    (warehousesQuery.data || []).forEach((warehouse) => {
      warehouseMap.set(warehouse.id, warehouse.name);
    });

    const inProgressTasks = tasks.filter((task) => task.status === "in_progress").length;
    const completedTasks = tasks.filter((task) => task.status === "completed").length;
    const availabilityStatus =
      user.status?.toLowerCase() !== "active"
        ? "offline"
        : inProgressTasks > 0
          ? "busy"
          : "available";

    const fullName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username;
    const warehouseName = user.warehouseId
      ? warehouseMap.get(user.warehouseId) || "Unknown"
      : "Unassigned";

    return {
      id: user.id,
      workerId: user.employeeId || user.id.slice(0, 6),
      name: fullName,
      email: user.email || "",
      phone: user.phone || "",
      role: (user.role.toLowerCase() as WorkerRole) || "picker",
      warehouseId: user.warehouseId || "",
      warehouseName,
      availabilityStatus,
      shiftStart: "08:00",
      shiftEnd: "17:00",
      tasksToday: tasks.length,
      totalTasksCompleted: completedTasks,
      avgTaskTime: 15.0,
      lastActive: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never",
      joinDate: "N/A",
      status: user.status || "inactive",
    };
  }, [warehousesQuery.data, workerQuery.data]);

  const warehouses = useMemo(
    () => (warehousesQuery.data || []).map((warehouse) => ({ id: warehouse.id, name: warehouse.name })),
    [warehousesQuery.data]
  );

  useEffect(() => {
    if (!worker) {
      return;
    }

    setFormData({
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      role: worker.role,
      warehouseId: worker.warehouseId,
      shiftStart: worker.shiftStart,
      shiftEnd: worker.shiftEnd,
    });
  }, [worker]);

  const isLoading =
    (workerQuery.isPending && !workerQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const error =
    workerQuery.error || warehousesQuery.error
      ? workerQuery.error instanceof Error
        ? workerQuery.error.message
        : "Failed to load worker"
      : null;

  const status = useMemo(() => {
    if (!worker) return null;
    return statusConfig[worker.availabilityStatus];
  }, [worker]);

  const handleSave = async () => {
    if (!worker) return;
    try {
      setIsSaving(true);

      const [firstName, ...rest] = formData.name.trim().split(" ");
      const lastName = rest.join(" ");

      await usersApi.update(worker.id, {
        email: formData.email.trim(),
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        role: formData.role,
        phone: formData.phone.trim() || undefined,
        warehouseId: formData.warehouseId || undefined,
      });

      showToast.success("Worker updated successfully");
      await invalidateWorker(worker.id);
      router.push(`/admin/workers/${worker.id}`);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to update worker");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !worker || !status) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>{error || "Worker not found"}</span>
          <Link href="/admin/workers" className="btn btn-sm">
            Back to Workers
          </Link>
        </div>
      </div>
    );
  }

  if (isEditMode && !canEdit) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>You don&apos;t have permission to edit workers</span>
          <Link href={`/admin/workers/${worker.id}`} className="btn btn-sm">
            View Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <Link href={`/admin/workers/${worker.id}?edit=true`}>
            <button className="btn btn-primary">
              <span className="material-symbols-outlined">edit</span>
              Edit Worker
            </button>
          </Link>
        )}
      </div>

      <div className="card bg-base-100 border border-base-300 p-6">
        {isEditMode ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
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
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as WorkerRole })
                  }
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
                  value={formData.warehouseId}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouseId: e.target.value })
                  }
                  required
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
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
                  onChange={(e) =>
                    setFormData({ ...formData, shiftStart: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, shiftEnd: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/admin/workers/${worker.id}`}>
                <button type="button" className="btn btn-ghost">
                  Cancel
                </button>
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                Save Changes
              </button>
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
              <p className="font-semibold">{worker.email || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Phone</label>
              <p className="font-semibold">{worker.phone || "-"}</p>
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
              <StatusChip label={status.label} tone={status.tone} showDot />
            </p>
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
