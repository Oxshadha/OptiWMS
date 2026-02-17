"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip } from "@/components/StatusChip";
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
import { usersApi } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";
import { WorkerDisplay, statusConfig } from "../types";
import { logger } from "@/lib/utils/logger";

// Worker Detail Modal Component
export function WorkerDetailModal({
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
              <StatusChip
                label={statusConfig[worker.availabilityStatus as keyof typeof statusConfig].label}
                tone={statusConfig[worker.availabilityStatus as keyof typeof statusConfig].tone}
                showDot
              />
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
export function CreateWorkerModal({
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
        logger.error("[CreateWorkerModal] Failed to load warehouses:", err);
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
      logger.error("Failed to create worker:", err);
      
      // Try to extract error message from API response
      let errorMessage = "Failed to create worker. Please try again.";
      
      if (err?.response) {
        // Handle fetch API error response
        try {
          const errorData = await err.response.json();
          errorMessage = errorData?.message || errorData?.detail || errorData?.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `API Error: ${err.response.status} - ${err.response.statusText || errorMessage}`;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      logger.error("Error details:", {
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
export function EditWorkerModal({
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
          logger.warn("[EditWorkerModal] Could not load user details:", err);
        }
      } catch (err) {
        logger.error("[EditWorkerModal] Failed to load warehouses:", err);
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
      logger.error("[EditWorkerModal] Failed to update worker:", err);
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
export function DeleteWorkerModal({
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
