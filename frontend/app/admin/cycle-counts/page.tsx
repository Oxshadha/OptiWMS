"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { operationsApi } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { usersApi } from "@/lib/api/users";
import { locationsApi } from "@/lib/api/locations";
import { showToast } from "@/lib/utils/toast";
import { CycleCountDisplay, countTypeConfig, statusConfig } from "./types";
import {
  CreateAdHocCountModal,
  CycleCountDetailModal,
  EditScheduleModal,
  ScheduleCycleCountModal,
} from "./components/CycleCountModals";
import {
  CancelCountModal,
  ReviewDiscrepanciesModal,
} from "./components/CycleCountActionModals";
import { logger } from "@/lib/utils/logger";

export default function CycleCountsPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const canCreate = hasPermission(ADMIN_ROUTES.CYCLE_COUNTS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.CYCLE_COUNTS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.CYCLE_COUNTS, "delete");
  
  // API state
  const [cycleCounts, setCycleCounts] = useState<CycleCountDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState<CycleCountDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewNotes, setReviewNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [countsData, warehousesData, usersData, locationsData] = await Promise.all([
        operationsApi.getCycleCounts(),
        warehousesApi.getAll(),
        usersApi.getAll(),
        locationsApi.getAll(),
      ]);

      const warehousesMap = new Map<string, string>();
      warehousesData.forEach((wh) => warehousesMap.set(wh.id, wh.name));
      const usersMap = new Map<string, string>();
      usersData.forEach((u) => {
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        usersMap.set(u.id, fullName || u.username || u.employeeId || u.id);
      });
      const warehouseLocationsMap = new Map<string, string[]>();
      locationsData.forEach((loc) => {
        if (!loc.warehouseId || !loc.locationCode) return;
        const current = warehouseLocationsMap.get(loc.warehouseId) || [];
        current.push(loc.locationCode);
        warehouseLocationsMap.set(loc.warehouseId, current);
      });

      const displayCounts: CycleCountDisplay[] = countsData.map((cc) => {
        const warehouseName = warehousesMap.get(cc.warehouseId) || "Unknown";
        let sectionName = cc.locationCode;
        if (cc.locationCode === "ALL") {
          sectionName = "Full Warehouse";
        } else if (cc.locationCode.startsWith("AREA:")) {
          sectionName = `Section ${cc.locationCode.replace("AREA:", "")}`;
        } else {
          const sectionMatch = cc.locationCode.match(/^([A-Z])-/);
          sectionName = sectionMatch
            ? `Section ${sectionMatch[1]} - ${cc.locationCode}`
            : cc.locationCode;
        }

        const assignedWorkers =
          cc.assignedWorkers?.map((id) => usersMap.get(id) || id) || [];
        const performedBy = cc.countedBy ? (usersMap.get(cc.countedBy) || cc.countedBy) : null;
        const allLocationCodes = warehouseLocationsMap.get(cc.warehouseId) || [];
        let totalLocations = 1;
        if (cc.locationCode === "ALL") {
          totalLocations = Math.max(allLocationCodes.length, 1);
        } else if (cc.locationCode.startsWith("AREA:")) {
          const area = cc.locationCode.replace("AREA:", "").trim().toUpperCase();
          totalLocations = Math.max(
            allLocationCodes.filter((code) => code.toUpperCase().startsWith(`${area}-`)).length,
            1
          );
        }
        const countedLocations = cc.status === "completed"
          ? totalLocations
          : (cc.countedAt ? 1 : 0);

        return {
          id: cc.id,
          countNumber: cc.countNumber,
          warehouseId: cc.warehouseId,
          warehouseName,
          sectionName,
          countType: cc.countNumber?.startsWith("ADH-")
            ? "ad_hoc"
            : cc.locationCode === "ALL"
              ? "full"
              : "scheduled",
          scheduledDate: cc.scheduledDate || "-",
          actualDate: cc.countedAt ? cc.countedAt.split("T")[0] : null,
          status: cc.status || "scheduled",
          assignedWorkers,
          assignedWorkerIds: cc.assignedWorkers || [],
          assignedBy: "System",
          assignedDate: cc.scheduledDate || "-",
          totalLocations,
          countedLocations,
          discrepanciesFound: cc.variance ? Math.abs(parseFloat(cc.variance)) : 0,
          performedBy,
        };
      });

      setCycleCounts(displayCounts);
    } catch (err) {
      logger.error("Failed to load cycle counts:", err);
      setError(err instanceof Error ? err.message : "Failed to load cycle counts");
      setCycleCounts([]);
      if (err instanceof Error && !err.message.includes("Not authenticated")) {
        showToast.error("Failed to load cycle counts. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleReload = () => {
      loadData();
    };
    window.addEventListener("reloadCycleCounts", handleReload);
    return () => window.removeEventListener("reloadCycleCounts", handleReload);
  }, []);

  // Filter cycle counts by warehouse for warehouse managers
  const cycleCountsForWarehouse = isWarehouseManager && assignedWarehouseName
    ? cycleCounts.filter((cc) => cc.warehouseName === assignedWarehouseName)
    : cycleCounts;

  const summary = {
    scheduledThisMonth: cycleCountsForWarehouse.filter((cc) => cc.status === "scheduled").length,
    inProgress: cycleCountsForWarehouse.filter((cc) => cc.status === "in_progress").length,
    completedThisWeek: cycleCountsForWarehouse.filter((cc) => cc.status === "completed").length,
    discrepanciesFound: cycleCountsForWarehouse.reduce((sum, cc) => sum + cc.discrepanciesFound, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && cycleCounts.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading cycle counts: {error}</span>
      </div>
    );
  }

  const filteredCounts = cycleCountsForWarehouse.filter((count) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      count.countNumber.toLowerCase().includes(query) ||
      count.warehouseName.toLowerCase().includes(query) ||
      count.sectionName.toLowerCase().includes(query) ||
      count.countType.toLowerCase().includes(query) ||
      count.status.toLowerCase().includes(query) ||
      count.assignedBy.toLowerCase().includes(query) ||
      count.assignedDate.toLowerCase().includes(query) ||
      count.totalLocations.toString().includes(query) ||
      count.countedLocations.toString().includes(query) ||
      count.discrepanciesFound.toString().includes(query) ||
      (count.scheduledDate && count.scheduledDate.toLowerCase().includes(query)) ||
      (count.actualDate && count.actualDate.toLowerCase().includes(query)) ||
      (count.performedBy && count.performedBy.toLowerCase().includes(query)) ||
      count.assignedWorkers.some(w => w.toLowerCase().includes(query))
    );
    const matchesStatus = statusFilter === "all" || count.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const summaryCards = [
    {
      label: "Scheduled This Month",
      value: summary.scheduledThisMonth,
      icon: "calendar_month",
      color: "primary" as const,
    },
    {
      label: "In Progress",
      value: summary.inProgress,
      icon: "sync",
      color: "info" as const,
    },
    {
      label: "Completed This Week",
      value: summary.completedThisWeek,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Discrepancies Found",
      value: summary.discrepanciesFound,
      icon: "warning",
      color: "warning" as const,
    },
  ];

  const columns = [
    {
      key: "countNumber",
      label: "Count Number",
      render: (count: CycleCountDisplay) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCount(count);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {count.countNumber}
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
      key: "sectionName",
      label: "Section",
      render: (count: CycleCountDisplay) => count.sectionName || "Full Warehouse",
    },
    {
      key: "countType",
      label: "Count Type",
      render: (count: CycleCountDisplay) => {
        const type = countTypeConfig[count.countType as keyof typeof countTypeConfig];
        return <span className={`badge text-xs whitespace-nowrap ${type.class}`}>{type.label}</span>;
      },
      sortable: true,
    },
    {
      key: "scheduledDate",
      label: "Scheduled Date",
      sortable: true,
    },
    {
      key: "actualDate",
      label: "Actual Date",
      render: (count: typeof cycleCounts[0]) => count.actualDate || "-",
      className: "text-base-content/70",
    },
    {
      key: "status",
      label: "Status",
      render: (count: CycleCountDisplay) => {
        const status =
          statusConfig[count.status as keyof typeof statusConfig] ||
          { label: count.status, class: "badge-outline" };
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (status.class === "badge-outline") {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {status.label}
            </span>
          );
        }
        return <span className={`badge text-xs whitespace-nowrap ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "progress",
      label: "Progress",
      render: (count: CycleCountDisplay) => (
        <div className="flex items-center gap-2">
          <span className="text-sm">{count.countedLocations}/{count.totalLocations}</span>
          <div className="w-16 bg-base-300 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full"
              style={{
                width: `${(count.countedLocations / count.totalLocations) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      ),
    },
    {
      key: "discrepanciesFound",
      label: "Discrepancies",
      render: (count: CycleCountDisplay) => (
        <span className={count.discrepanciesFound > 0 ? "text-warning font-semibold" : ""}>
          {count.discrepanciesFound}
        </span>
      ),
      sortable: true,
    },
  ];

  const renderActions = (count: CycleCountDisplay) => (
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
            onClick={() => {
              setSelectedCount(count);
              setShowDetailModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </button>
        </li>
        {count.status === "scheduled" && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedCount(count);
                setShowEditModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Schedule
            </button>
          </li>
        )}
        {count.status === "in_progress" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">person_add</span>
              Assign More Workers
            </button>
          </li>
        )}
        {count.status === "pending_approval" && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedCount(count);
                setShowReviewModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">fact_check</span>
              Manager Decision
            </button>
          </li>
        )}
        {count.status === "recount_required" && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedCount(count);
                setShowEditModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">groups</span>
              Assign Recount Worker
            </button>
          </li>
        )}
        {(count.status === "scheduled" || count.status === "in_progress") && canDelete && (
          <li>
            <button
              className="text-error"
              onClick={() => {
                setSelectedCount(count);
                setShowCancelModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              Cancel Count
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
            <h1 className="text-3xl font-bold text-base-content">Cycle Counts</h1>
            {isWarehouseManager && assignedWarehouseName && (
              <div className="badge badge-primary badge-lg">
                <span className="material-symbols-outlined text-sm mr-1">warehouse</span>
                {assignedWarehouseName}
              </div>
            )}
          </div>
          <p className="text-sm text-base-content/60 mt-1">
            {isWarehouseManager && assignedWarehouseName
              ? `Cycle counts for ${assignedWarehouseName}`
              : "Schedule and manage inventory audits"}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search cycle counts..."
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
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("scheduled")}>Scheduled</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("in_progress")}>In Progress</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("recount_required")}>Recount Required</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("pending_approval")}>Pending Approval</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("completed")}>Completed</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("cancelled")}>Cancelled</button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-sm btn-primary">
                <span className="material-symbols-outlined">add</span>
                <span>Create Count</span>
              </label>
              <ul
                tabIndex={0}
                className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-40 border border-base-300 z-10"
              >
                <li>
                  <button onClick={() => setShowScheduleModal(true)}>
                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                    Schedule Count
                  </button>
                </li>
                <li>
                  <button onClick={() => setShowAdHocModal(true)}>
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Create Ad-Hoc
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Cycle Counts Table */}
      <div className="overflow-hidden">
        <DataTable
          data={filteredCounts}
          columns={columns}
          keyExtractor={(count) => count.id}
          onRowClick={(count) => {
            setSelectedCount(count);
            setShowDetailModal(true);
          }}
          actions={renderActions}
          emptyMessage="No cycle counts found"
          className="overflow-hidden"
        />
      </div>

      {/* Schedule Cycle Count Modal */}
      <ScheduleCycleCountModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={loadData}
      />

      {/* Create Ad-Hoc Count Modal */}
      <CreateAdHocCountModal
        isOpen={showAdHocModal}
        onClose={() => setShowAdHocModal(false)}
        onSuccess={loadData}
      />

      {/* Cycle Count Detail Modal */}
      {selectedCount && (
        <CycleCountDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCount(null);
          }}
          count={selectedCount}
        />
      )}

      {/* Edit Schedule Modal */}
      {selectedCount && (
        <EditScheduleModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCount(null);
          }}
          count={selectedCount}
          onUpdated={loadData}
        />
      )}

      {/* Review Discrepancies Modal */}
      {selectedCount && (
        <ReviewDiscrepanciesModal
          adminId={admin?.id}
          selectedCount={selectedCount}
          isOpen={showReviewModal}
          reviewNotes={reviewNotes}
          onReviewNotesChange={setReviewNotes}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedCount(null);
            setReviewNotes("");
          }}
          onSuccess={loadData}
        />
      )}

      {/* Cancel Count Modal */}
      {selectedCount && (
        <CancelCountModal
          selectedCount={selectedCount}
          isOpen={showCancelModal}
          cancelReason={cancelReason}
          onCancelReasonChange={setCancelReason}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedCount(null);
            setCancelReason("");
          }}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
