"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import {
  AdminRole,
  getRoleDisplayName,
} from "@/lib/admin-roles";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { usersApi, User } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";
import { warehousesApi } from "@/lib/api/warehouses";
import { logger } from "@/lib/utils/logger";
import {
  AdminDetailModal,
  CreateAdminModal,
  DeleteAdminModal,
  EditAdminModal,
} from "./components/AdminModals";
import { AdminDisplay, statusConfig } from "./types";

export default function AdminsPage() {
  const { hasPermission } = useAdmin();
  const searchParams = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
          warehouseId: user.warehouseId,
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
                setShowEditModal(true);
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
          onEdit={() => {
            setShowDetailModal(false);
            setShowEditModal(true);
          }}
        />
      )}

      {/* Edit Admin Modal */}
      {selectedAdmin && (
        <EditAdminModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAdmin(null);
          }}
          admin={selectedAdmin}
          onSuccess={async () => {
            await loadAdmins();
            showToast.success("Manager updated successfully");
          }}
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
