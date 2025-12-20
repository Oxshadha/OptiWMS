"use client";

import { useState, useEffect } from "react";
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

// Mock data - will be replaced with API calls
const admins = [
  {
    id: "admin-1",
    name: "Henry Kaul",
    email: "henry.kaul@optiwms.com",
    role: "admin" as AdminRole,
    warehouseName: "All Warehouses",
    lastLogin: "2 hours ago",
    avatar: "/assets/avatars/Henry Kual.jpg",
    createdAt: "2024-01-15",
    status: "active",
  },
  {
    id: "admin-2",
    name: "John Manager",
    email: "john.manager@optiwms.com",
    role: "warehouse_manager" as AdminRole,
    warehouseName: "Warehouse 1",
    lastLogin: "5 minutes ago",
    avatar: "/assets/avatars/placeholder.svg",
    createdAt: "2024-03-20",
    status: "active",
  },
  {
    id: "admin-3",
    name: "Jane Supervisor",
    email: "jane.supervisor@optiwms.com",
    role: "warehouse_manager" as AdminRole,
    warehouseName: "Warehouse 2",
    lastLogin: "1 day ago",
    avatar: "/assets/avatars/placeholder.svg",
    createdAt: "2024-05-10",
    status: "active",
  },
];

const statusConfig = {
  active: { label: "Active", class: "badge-success" },
  inactive: { label: "Inactive", class: "badge-error" },
  suspended: { label: "Suspended", class: "badge-warning" },
};

export default function AdminsPage() {
  const { hasPermission, role } = useAdmin();
  const searchParams = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<(typeof admins)[0] | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(() => {
    const roleParam = searchParams.get("role");
    return roleParam || "all";
  });

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
    procurementManagers: admins.filter((a) => a.role === "procurement_manager")
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
      label: "Procurement Managers",
      value: summary.procurementManagers,
      icon: "shopping_cart",
      color: "warning" as const,
    },
  ];

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (admin: (typeof admins)[0]) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            <Image
              src={admin.avatar}
              alt={admin.name}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
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
      render: (admin: (typeof admins)[0]) => (
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

  const handleDelete = (admin: (typeof admins)[0]) => {
    setSelectedAdmin(admin);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedAdmin) {
      // TODO: API call to delete admin
      console.log("Deleting admin:", selectedAdmin.id);
      // Remove from list (in production, this would be handled by API response)
      setShowDeleteModal(false);
      setSelectedAdmin(null);
    }
  };

  const renderActions = (admin: (typeof admins)[0]) => (
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
                // TODO: Implement edit manager functionality
                console.log("Edit manager:", admin.id);
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
                <button onClick={() => setRoleFilter("procurement_manager")}>
                  Procurement Manager
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

      {/* Create Admin Modal */}
      <CreateAdminModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
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
  admin: (typeof admins)[0];
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
            <Image
              src={admin.avatar}
              alt={admin.name}
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
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
}: {
  isOpen: boolean;
  onClose: () => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create admin/warehouse manager
    console.log("Creating admin:", formData);
    onClose();
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
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Manager" size="lg">
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
            <option value="procurement_manager">Procurement Manager</option>
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
              <option value="wh-1">Warehouse 1</option>
              <option value="wh-2">Warehouse 2</option>
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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Manager
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
  admin: (typeof admins)[0];
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
