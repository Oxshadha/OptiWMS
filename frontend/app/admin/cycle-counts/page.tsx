"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { operationsApi } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";
import { CycleCountDisplay, countTypeConfig, statusConfig } from "./types";
import {
  CreateAdHocCountModal,
  CycleCountDetailModal,
  EditScheduleModal,
  ScheduleCycleCountModal,
} from "./components/CycleCountModals";
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
      const [countsData, warehousesData] = await Promise.all([
        operationsApi.getCycleCounts(),
        warehousesApi.getAll(),
      ]);

      const warehousesMap = new Map<string, string>();
      warehousesData.forEach((wh) => warehousesMap.set(wh.id, wh.name));

      const displayCounts: CycleCountDisplay[] = countsData.map((cc) => {
        const warehouseName = warehousesMap.get(cc.warehouseId) || "Unknown";
        const sectionMatch = cc.locationCode.match(/^([A-Z])-/);
        const sectionName = sectionMatch
          ? `Section ${sectionMatch[1]} - ${cc.locationCode}`
          : cc.locationCode;

        return {
          id: cc.id,
          countNumber: cc.countNumber,
          warehouseName,
          sectionName,
          countType: cc.locationCode === "ALL" ? "full" : "ad_hoc",
          scheduledDate: new Date().toISOString().split("T")[0],
          actualDate: cc.status === "completed" ? new Date().toISOString().split("T")[0] : null,
          status: cc.status || "scheduled",
          assignedWorkers: [],
          assignedBy: "System",
          assignedDate: new Date().toISOString(),
          totalLocations: 1,
          countedLocations: cc.status === "completed" ? 1 : 0,
          discrepanciesFound: cc.variance ? Math.abs(parseFloat(cc.variance)) : 0,
          performedBy: null,
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
        const status = statusConfig[count.status as keyof typeof statusConfig];
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
        {count.status === "completed" && count.discrepanciesFound > 0 && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedCount(count);
                setShowReviewModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">warning</span>
              Review Discrepancies
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
        <Modal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedCount(null);
          }}
          title={`Review Discrepancies: ${selectedCount.countNumber}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="alert alert-info">
              <span className="material-symbols-outlined">info</span>
              <span>
                Found {selectedCount.discrepanciesFound} discrepancies in this cycle count.
              </span>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Discrepancy Details</span>
              </label>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Expected</th>
                      <th>Found</th>
                      <th>Difference</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">A-01-01</td>
                      <td>50</td>
                      <td>45</td>
                      <td className="text-error">-5</td>
                      <td>
                        <select className="select select-bordered select-sm">
                          <option>Adjust Inventory</option>
                          <option>Investigate</option>
                          <option>Ignore</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Notes</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about discrepancies..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedCount(null);
                  setReviewNotes("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!selectedCount) return;
                  
                  try {
                    await operationsApi.reviewCycleCount(selectedCount.id, reviewNotes.trim() || undefined);
                    showToast.success("Discrepancies reviewed successfully");
                    setShowReviewModal(false);
                    setSelectedCount(null);
                    setReviewNotes("");
                    await loadData();
                  } catch (err) {
                    logger.error("Failed to review discrepancies:", err);
                    showToast.error(err instanceof Error ? err.message : "Failed to review discrepancies");
                  }
                }}
              >
                Review & Approve
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Count Modal */}
      {selectedCount && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedCount(null);
          }}
          title="Cancel Cycle Count"
        >
          <div className="space-y-4">
            <div className="alert alert-warning">
              <span className="material-symbols-outlined">warning</span>
              <span>
                Are you sure you want to cancel cycle count {selectedCount.countNumber}? This action cannot be undone.
              </span>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Cancellation Reason *</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedCount(null);
                  setCancelReason("");
                }}
              >
                Keep Count
              </button>
              <button
                className="btn btn-error"
                onClick={async () => {
                  if (!selectedCount) return;
                  const reason = cancelReason.trim();
                  
                  if (!reason) {
                    showToast.error("Please provide a cancellation reason");
                    return;
                  }
                  
                  try {
                    await operationsApi.cancelCycleCount(selectedCount.id, reason);
                    showToast.success("Cycle count cancelled successfully");
                    setShowCancelModal(false);
                    setSelectedCount(null);
                    setCancelReason("");
                    await loadData();
                  } catch (err) {
                    logger.error("Failed to cancel cycle count:", err);
                    showToast.error(err instanceof Error ? err.message : "Failed to cancel cycle count");
                  }
                }}
              >
                Cancel Count
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
