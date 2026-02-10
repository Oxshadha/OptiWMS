"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import {
  AdminRole,
  getAllAdminRoles,
  ROLE_DISPLAY_NAMES,
  getRoleDisplayName,
} from "@/lib/admin-roles";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { usersApi, User } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";
import { warehousesApi } from "@/lib/api/warehouses";
import { logger } from "@/lib/utils/logger";

interface AdminDisplay {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  warehouseName: string;
  lastLogin: string;
  avatar?: string;
  createdAt: string;
  status: string;
}

const statusConfig = {
  active: { label: "Active", class: "badge-success" },
  inactive: { label: "Inactive", class: "badge-error" },
  suspended: { label: "Suspended", class: "badge-warning" },
};

export default function AdminsPage() {
  const { hasPermission } = useAdmin();
  const searchParams = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [admins, setAdmins] = useState<AdminDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(() => {
    const roleParam = searchParams.get("role");
    return roleParam || "all";
  });

  // Load admins function - extracted so it can be called after creating a new admin
  const loadAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all users with admin roles
      const adminRoles = ["admin", "warehouse_manager", "inbound_coordinator"];
      const [roleUsers, warehouses] = await Promise.all([
        Promise.all(adminRoles.map((adminRole) => usersApi.getAll(adminRole))),
        warehousesApi.getAll(),
      ]);
      const dedupedUsers: User[] = Array.from(
        new Map(roleUsers.flat().map((u) => [u.id, u])).values()
      );
      const warehouseMap = new Map<string, string>();
      warehouses.forEach((wh) => warehouseMap.set(wh.id, wh.name));

      const adminsWithWarehouses: AdminDisplay[] = dedupedUsers.map((user) => {
        const warehouseName = user.warehouseId
          ? warehouseMap.get(user.warehouseId) || "Unknown Warehouse"
          : "All Warehouses";
        const lastLogin = user.lastLoginAt
          ? new Date(user.lastLoginAt).toLocaleString()
          : "Never";

        return {
          id: user.id,
          name:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            user.username ||
            "Unknown",
          email: user.email || "",
          role: (user.role as AdminRole) || "warehouse_manager",
          warehouseName,
          lastLogin,
          avatar: user.avatarUrl,
          createdAt: "-",
          status: user.status || "active",
        };
      });
      
      setAdmins(adminsWithWarehouses);
    } catch (error) {
      logger.error("Error loading admins:", error);
      setError(error instanceof Error ? error.message : "Failed to load managers");
      setAdmins([]);
      showToast.error("Failed to load managers");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load admins from API on mount
  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam) {
      setRoleFilter(roleParam);
    }
  }, [searchParams]);

  const canCreate = hasPermission(ADMIN_ROUTES.ADMINS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.ADMINS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.ADMINS, "delete");

  const summary = {
    totalAdmins: admins.length,
    activeAdmins: admins.filter((a) => a.status === "active").length,
    warehouseManagers: admins.filter((a) => a.role === "warehouse_manager")
      .length,
    inboundCoordinators: admins.filter((a) => a.role === "inbound_coordinator")
      .length,
    systemAdmins: admins.filter((a) => a.role === "admin").length,
  };

  const filteredAdmins = admins.filter((admin) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      admin.name.toLowerCase().includes(query) ||
      admin.email.toLowerCase().includes(query) ||
      admin.warehouseName.toLowerCase().includes(query) ||
      admin.role.toLowerCase().includes(query) ||
      admin.status.toLowerCase().includes(query);
    const matchesRole = roleFilter === "all" || admin.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const summaryCards = [
    {
      label: "Total Managers",
      value: summary.totalAdmins,
      icon: "admin_panel_settings",
      color: "primary" as const,
    },
    {
      label: "Active Managers",
      value: summary.activeAdmins,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Warehouse Managers",
      value: summary.warehouseManagers,
      icon: "warehouse",
      color: "info" as const,
    },
    {
      label: "Inbound Coordinators",
      value: summary.inboundCoordinators,
      icon: "local_shipping",
      color: "warning" as const,
    },
  ];

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (admin: AdminDisplay) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {admin.avatar ? (
              <Image
                src={admin.avatar}
                alt={admin.name}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-primary">person</span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAdmin(admin);
              setShowDetailModal(true);
            }}
            className="font-semibold text-primary hover:underline text-left"
          >
            {admin.name}
          </button>
        </div>
      ),
      sortable: true,
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
    },
    {
      key: "role",
      label: "Role",
      render: (admin: AdminDisplay) => (
        <div className="inline-block max-w-full">
          <span className=" whitespace-normal break-words block w-fit">
            {getRoleDisplayName(admin.role)}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "warehouseName",
      label: "Warehouse",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (admin: (typeof admins)[0]) => {
        const status = statusConfig[admin.status as keyof typeof statusConfig];
        return <span className={`badge ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "lastLogin",
      label: "Last Login",
      className: "text-base-content/70",
    },
    {
      key: "createdAt",
      label: "Created",
      className: "text-base-content/70",
      sortable: true,
    },
  ];

  const handleDelete = (admin: AdminDisplay) => {
    setSelectedAdmin(admin);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (selectedAdmin) {
      try {
        await usersApi.delete(selectedAdmin.id);
        showToast.success("Admin deleted successfully");
        setShowDeleteModal(false);
        setSelectedAdmin(null);
        await loadAdmins();
      } catch (err) {
        logger.error("Failed to delete admin:", err);
        showToast.error(err instanceof Error ? err.message : "Failed to delete admin");
      }
    }
  };

  const renderActions = (admin: AdminDisplay) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAdmin(admin);
              setShowDetailModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            View Details
          </button>
        </li>
        {canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedAdmin(admin);
                setShowDetailModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Manager
            </button>
          </li>
        )}
        {canDelete && admin.role !== "admin" && (
          <li>
            <button
              className="text-error"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(admin);
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete Admin
            </button>
          </li>
        )}
        {canDelete && admin.role === "admin" && (
          <li>
            <button className="text-error" disabled>
              <span className="material-symbols-outlined text-sm">block</span>
              Cannot Delete System Admin
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
          <h1 className="text-3xl font-bold text-base-content">Managers</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage warehouse managers and procurement managers
          </p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search admins..."
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
                <button onClick={() => setRoleFilter("all")}>All Roles</button>
              </li>
              <li>
                <button onClick={() => setRoleFilter("admin")}>
                  System Admin
                </button>
              </li>
              <li>
                <button onClick={() => setRoleFilter("warehouse_manager")}>
                  Warehouse Manager
                </button>
              </li>
              <li>
                <button onClick={() => setRoleFilter("inbound_coordinator")}>
                  Inbound Coordinator
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
              <span>Add Manager</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Admins Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : error ? (
        <div className="alert alert-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="btn btn-sm" onClick={loadAdmins}>
            Retry
          </button>
        </div>
      ) : (
        <DataTable
        data={filteredAdmins}
        columns={columns}
        keyExtractor={(admin) => admin.id}
        onRowClick={(admin) => {
          setSelectedAdmin(admin);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No managers found"
      />
      )}

      {/* Create Admin Modal */}
      <CreateAdminModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadAdmins}
      />

      {/* Admin Detail Modal */}
      {selectedAdmin && (
        <AdminDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAdmin(null);
          }}
          admin={selectedAdmin}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedAdmin && (
        <DeleteAdminModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedAdmin(null);
          }}
          onConfirm={confirmDelete}
          admin={selectedAdmin}
        />
      )}
    </div>
  );
}

// Admin Detail Modal
function AdminDetailModal({
  isOpen,
  onClose,
  admin,
}: {
  isOpen: boolean;
  onClose: () => void;
  admin: AdminDisplay;
}) {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manager: ${admin.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {admin.avatar ? (
              <Image
                src={admin.avatar}
                alt={admin.name}
                width={80}
                height={80}
                className="rounded-full object-cover"
              />
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
              <span className="badge badge-primary">
                {getRoleDisplayName(admin.role)}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span
                className={`badge ${
                  statusConfig[admin.status as keyof typeof statusConfig].class
                }`}
              >
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
          <button className="btn btn-primary">Edit Manager</button>
        </div>
      </div>
    </DetailModal>
  );
}

// Create Admin Modal
function CreateAdminModal({
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
        setWarehouses(warehousesData.map(w => ({ id: w.id, name: w.name })));
      } catch (error) {
        logger.error("Failed to load warehouses:", error);
      }
    };
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Generate username from email or use email as username
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

      // Reset form
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
      
      // Close modal
      onClose();
      
      // Reload admins list (instead of full page reload)
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

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Role *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.role}
            onChange={(e) =>
              setFormData({ ...formData, role: e.target.value as AdminRole })
            }
            required
          >
            <option value="warehouse_manager">Warehouse Manager</option>
            <option value="inbound_coordinator">Inbound Coordinator</option>
          </select>
          <label className="label">
            <span className="label-text-alt text-info">
              Only System Administrators can create managers
            </span>
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
              onChange={(e) =>
                setFormData({ ...formData, warehouseId: e.target.value })
              }
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

// Delete Admin Modal
function DeleteAdminModal({
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
            <h3 className="font-bold">
              Warning: This action cannot be undone!
            </h3>
            <div className="text-sm">
              You are about to delete <strong>{admin.name}</strong> (
              {admin.email}). This will permanently remove their access to the
              system.
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
