"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip } from "@/components/StatusChip";
import { WorkerRole, getRoleDisplayName } from "@/lib/worker-roles";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { usersApi } from "@/lib/api/users";
import {
  useInvalidateAdminList,
  usePagedAdminQuery,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { WorkerDisplay, statusConfig } from "./types";
import {
  CreateWorkerModal,
  DeleteWorkerModal,
  EditWorkerModal,
  WorkerDetailModal,
} from "./components/WorkerModals";
import { logger } from "@/lib/utils/logger";

export default function WorkersPage() {
  const { hasPermission, role, admin } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const assignedWarehouseId = admin?.warehouseId;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerDisplay | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const workersQuery = usePagedAdminQuery({
    queryKey: [
      "admin-workers",
      currentPage,
      itemsPerPage,
      statusFilter,
      searchQuery,
      isWarehouseManager ? assignedWarehouseId : "all",
    ],
    queryFn: async () => {
      const userStatus =
        statusFilter === "all"
          ? undefined
          : statusFilter === "offline"
            ? "inactive"
            : "active";

      const usersPage = await usersApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "createdAt",
        sortDir: "desc",
        role: "worker",
        warehouseId: isWarehouseManager ? assignedWarehouseId : undefined,
        status: userStatus,
        q: searchQuery.trim() || undefined,
      });

      const taskCounts = await usersApi.getWorkerTaskSummary(usersPage.data.map((u) => u.id));

      return {
        page: usersPage,
        taskCounts,
      };
    },
  });
  const warehousesQuery = useReferenceWarehouses();
  const reload = useInvalidateAdminList(["admin-workers"]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const workers = useMemo<WorkerDisplay[]>(() => {
    if (!workersQuery.data) return [];

    const warehousesMap = new Map<string, string>();
    (warehousesQuery.data || []).forEach((w) => {
      warehousesMap.set(w.id, w.name);
    });

    const totalTaskCounts = new Map<string, number>();
    const completedTaskCounts = new Map<string, number>();
    workersQuery.data.taskCounts.forEach((entry) => {
      totalTaskCounts.set(entry.workerId, entry.total);
      completedTaskCounts.set(entry.workerId, entry.completed);
    });

    const displayWorkers: WorkerDisplay[] = workersQuery.data.page.data.map((u) => {
      const warehouseName = u.warehouseId
        ? warehousesMap.get(u.warehouseId) || "Unknown"
        : "Unassigned";
      const tasksToday = totalTaskCounts.get(u.id) || 0;
      const totalCompleted = completedTaskCounts.get(u.id) || 0;
      const workerRole: WorkerRole = (u.role?.toLowerCase() || "picker") as WorkerRole;

      let availabilityStatus: WorkerDisplay["availabilityStatus"] = "available";
      if (u.status !== "active") {
        availabilityStatus = "offline";
      } else if (tasksToday > 0) {
        availabilityStatus = "busy";
      }

      return {
        id: u.id,
        workerId: u.employeeId || u.id.slice(0, 6),
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username,
        warehouseName,
        availabilityStatus,
        tasksToday,
        totalTasksCompleted: totalCompleted,
        lastActive: u.lastLoginAt || "Never",
        avatar: u.avatarUrl || "/assets/avatars/placeholder.svg",
        role: workerRole,
      };
    });

    return statusFilter === "all"
      ? displayWorkers
      : displayWorkers.filter((worker) => worker.availabilityStatus === statusFilter);
  }, [statusFilter, warehousesQuery.data, workersQuery.data]);

  const isLoading =
    (workersQuery.isPending && !workersQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const isFetching = workersQuery.isFetching;
  const error =
    workersQuery.error || warehousesQuery.error
      ? workersQuery.error instanceof Error
        ? workersQuery.error.message
        : "Failed to load workers"
      : null;
  const totalItems = workersQuery.data?.page.totalElements ?? 0;
  const totalPages = Math.max(workersQuery.data?.page.totalPages ?? 1, 1);

  const canCreate = hasPermission(ADMIN_ROUTES.WORKERS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.WORKERS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.WORKERS, "delete");

  const summary = {
    totalWorkers: totalItems,
    activeNow: workers.filter(
      (w) => w.availabilityStatus === "available" || w.availabilityStatus === "busy"
    ).length,
    offline: workers.filter((w) => w.availabilityStatus === "offline").length,
    tasksCompletedToday: workers.reduce((sum, w) => sum + w.tasksToday, 0),
  };

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
      label: "Tasks",
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
        if (!worker.role) return <span className="text-base-content/50">-</span>;
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
        const status = statusConfig[worker.availabilityStatus];
        return <StatusChip label={status.label} tone={status.tone} showDot />;
      },
      sortable: true,
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
            <span className="material-symbols-outlined text-sm">visibility</span>
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-base-content">Workers</h1>
            {isWarehouseManager && assignedWarehouseName && (
              <div className="badge badge-primary badge-lg">
                <span className="material-symbols-outlined text-sm mr-1">
                  warehouse
                </span>
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
          {isFetching && (
            <div className="flex items-center text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              Updating...
            </div>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void reload()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="form-control">
            <input
              type="text"
              placeholder="Search workers..."
              className="input input-bordered input-sm w-64"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                >
                  All Status
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setStatusFilter("available");
                    setCurrentPage(1);
                  }}
                >
                  Available
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setStatusFilter("busy");
                    setCurrentPage(1);
                  }}
                >
                  Busy
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setStatusFilter("offline");
                    setCurrentPage(1);
                  }}
                >
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

      <SummaryCards cards={summaryCards} />

      {error && (
        <div className="alert alert-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="btn btn-xs btn-ghost ml-auto" onClick={() => void reload()}>
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
        <>
          <DataTable
            data={workers}
            columns={columns}
            keyExtractor={(worker) => worker.id}
            onRowClick={(worker) => {
              setSelectedWorker(worker);
              setShowDetailModal(true);
            }}
            actions={renderActions}
            emptyMessage="No workers found"
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalItems}
            showItemsPerPage
            onItemsPerPageChange={(next) => {
              setItemsPerPage(next);
              setCurrentPage(1);
            }}
          />
        </>
      )}

      <CreateWorkerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={reload}
      />

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

      {selectedWorker && (
        <EditWorkerModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedWorker(null);
          }}
          onUpdated={reload}
          worker={selectedWorker}
        />
      )}

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
              await reload();
            } catch (err) {
              logger.error("Failed to delete worker:", err);
              showToast.error(
                err instanceof Error ? err.message : "Failed to delete worker"
              );
            }
          }}
          worker={selectedWorker}
        />
      )}
    </div>
  );
}
