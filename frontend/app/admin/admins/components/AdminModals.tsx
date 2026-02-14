"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { AdminRole, getRoleDisplayName } from "@/lib/admin-roles";
import { usersApi } from "@/lib/api/users";
import { logger } from "@/lib/utils/logger";
import { AdminDisplay, statusConfig } from "../types";

export function AdminDetailModal({
  isOpen,
  onClose,
  admin,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  admin: AdminDisplay;
  onEdit?: () => void;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Manager: ${admin.name}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {admin.avatar ? (
              <Image src={admin.avatar} alt={admin.name} width={80} height={80} className="rounded-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-primary text-4xl">person</span>
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold">{admin.name}</h3>
            <p className="text-sm text-base-content/60">{admin.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Role</label>
            <p>
              <span className="badge badge-primary">{getRoleDisplayName(admin.role)}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${statusConfig[admin.status as keyof typeof statusConfig].class}`}>
                {statusConfig[admin.status as keyof typeof statusConfig].label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{admin.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Last Login</label>
            <p className="font-semibold">{admin.lastLogin}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Created At</label>
            <p className="font-semibold">{admin.createdAt}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={onEdit} disabled={!onEdit}>
            Edit Manager
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

export function EditAdminModal({
  isOpen,
  onClose,
  admin,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  admin: AdminDisplay;
  onSuccess?: () => void | Promise<void>;
}) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "warehouse_manager" as AdminRole,
    warehouseId: "",
    status: "active",
  });
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const parts = (admin.name || "").trim().split(/\s+/);
    setFormData({
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      email: admin.email || "",
      phone: "",
      role: admin.role || "warehouse_manager",
      warehouseId: admin.warehouseId || "",
      status: admin.status || "active",
    });
    setError("");
  }, [isOpen, admin]);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const { warehousesApi } = await import("@/lib/api/warehouses");
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData.map((w) => ({ id: w.id, name: w.name })));
      } catch (err) {
        logger.error("Failed to load warehouses:", err);
      }
    };
    if (isOpen) {
      void loadWarehouses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await usersApi.update(admin.id, {
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        role: formData.role,
        status: formData.status,
        warehouseId: formData.role === "admin" ? undefined : (formData.warehouseId || undefined),
      });
      onClose();
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update manager");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Manager: ${admin.name}`} size="lg">
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
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
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Role *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminRole })}
              required
            >
              <option value="admin">System Administrator</option>
              <option value="warehouse_manager">Warehouse Manager</option>
              <option value="inbound_coordinator">Inbound Coordinator</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Status *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {formData.role !== "admin" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.warehouseId}
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateAdminModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
}) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    role: "warehouse_manager" as AdminRole,
    warehouseId: "",
    avatar: null as File | null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const { warehousesApi } = await import("@/lib/api/warehouses");
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData.map((w) => ({ id: w.id, name: w.name })));
      } catch (error) {
        logger.error("Failed to load warehouses:", error);
      }
    };
    if (isOpen) {
      void loadWarehouses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const username = formData.email.split("@")[0] || formData.email;

      await usersApi.create({
        username: username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        warehouseId: formData.warehouseId || undefined,
        phone: formData.phone || undefined,
        status: "active",
      });

      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        role: "warehouse_manager" as AdminRole,
        warehouseId: "",
        avatar: null,
      });

      onClose();
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Manager" size="lg">
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
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
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Role *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminRole })}
            required
          >
            <option value="warehouse_manager">Warehouse Manager</option>
            <option value="inbound_coordinator">Inbound Coordinator</option>
          </select>
          <label className="label">
            <span className="label-text-alt text-info">Only System Administrators can create managers</span>
          </label>
        </div>

        {formData.role === "warehouse_manager" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.warehouseId}
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
              required={formData.role === "warehouse_manager"}
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Password *</span>
          </label>
          <input
            type="password"
            className="input input-bordered w-full"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Manager"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteAdminModal({
  isOpen,
  onClose,
  onConfirm,
  admin,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  admin: AdminDisplay;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Manager" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">Warning: This action cannot be undone!</h3>
            <div className="text-sm">
              You are about to delete <strong>{admin.name}</strong> ({admin.email}). This will permanently
              remove their access to the system.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Role:</strong> {getRoleDisplayName(admin.role)}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Warehouse:</strong> {admin.warehouseName}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Manager
          </button>
        </div>
      </div>
    </Modal>
  );
}
