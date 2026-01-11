"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { operationsApi, CycleCount as ApiCycleCount } from "@/lib/api/operations";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";

interface CycleCountDisplay {
  id: string;
  countNumber: string;
  warehouseName: string;
  sectionName: string;
  countType: "scheduled" | "ad_hoc" | "full";
  scheduledDate: string;
  actualDate: string | null;
  status: string;
  assignedWorkers: string[];
  assignedBy: string;
  assignedDate: string;
  totalLocations: number;
  countedLocations: number;
  discrepanciesFound: number;
  performedBy: string | null;
}

// Mock data - will be replaced with API calls
const mockCycleCounts: CycleCountDisplay[] = [
  {
    id: "cc-1",
    countNumber: "CC-2025-001",
    warehouseName: "Warehouse 1",
    sectionName: "Section A - Electronics",
    countType: "scheduled",
    scheduledDate: "2025-12-20",
    actualDate: null,
    status: "scheduled",
    assignedWorkers: ["John Doe", "Jane Smith"],
    assignedBy: "Manager A",
    assignedDate: "2025-12-15 09:00",
    totalLocations: 120,
    countedLocations: 0,
    discrepanciesFound: 0,
    performedBy: null,
  },
  {
    id: "cc-2",
    countNumber: "CC-2025-002",
    warehouseName: "Warehouse 1",
    sectionName: "Full Warehouse",
    countType: "full",
    scheduledDate: "2025-12-18",
    actualDate: "2025-12-18",
    status: "completed",
    assignedWorkers: ["Mike Johnson", "Sarah Lee"],
    assignedBy: "Manager B",
    assignedDate: "2025-12-17 10:00",
    totalLocations: 480,
    countedLocations: 480,
    discrepanciesFound: 12,
    performedBy: "Mike Johnson, Sarah Lee",
  },
  {
    id: "cc-3",
    countNumber: "CC-2025-003",
    warehouseName: "Warehouse 2",
    sectionName: "Section B - Appliances",
    countType: "ad_hoc",
    scheduledDate: "2025-12-15",
    actualDate: "2025-12-15",
    status: "in_progress",
    assignedWorkers: ["John Doe"],
    assignedBy: "Manager C",
    assignedDate: "2025-12-14 14:00",
    totalLocations: 80,
    countedLocations: 45,
    discrepanciesFound: 3,
    performedBy: "John Doe",
  },
];

const countTypeConfig = {
  scheduled: { label: "Scheduled", class: "badge-info" },
  ad_hoc: { label: "Ad-Hoc", class: "badge-warning" },
  full: { label: "Full", class: "badge-primary" },
};

const statusConfig = {
  scheduled: { label: "Scheduled", class: "badge-outline" },
  in_progress: { label: "In Progress", class: "badge-primary" },
  completed: { label: "Completed", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};

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

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [countsData, warehousesData] = await Promise.all([
          operationsApi.getCycleCounts(),
          warehousesApi.getAll(),
        ]);

        // Build warehouses map
        const warehousesMap = new Map<string, string>();
        warehousesData.forEach(wh => warehousesMap.set(wh.id, wh.name));

        // Transform API data to display format
        // Note: API returns simpler structure, so we'll map what's available
        const displayCounts: CycleCountDisplay[] = countsData.map((cc) => {
          const warehouseName = warehousesMap.get(cc.warehouseId) || "Unknown";
          
          // Extract section from location code (e.g., "A-01-01" -> "Section A")
          const sectionMatch = cc.locationCode.match(/^([A-Z])-/);
          const sectionName = sectionMatch 
            ? `Section ${sectionMatch[1]} - ${cc.locationCode}`
            : cc.locationCode;

          return {
            id: cc.id,
            countNumber: cc.countNumber,
            warehouseName,
            sectionName,
            countType: "ad_hoc" as const, // Default, API doesn't provide this
            scheduledDate: new Date().toISOString().split("T")[0], // Default
            actualDate: null,
            status: cc.status || "scheduled",
            assignedWorkers: [], // TODO: Get from tasks when available
            assignedBy: "System", // Default
            assignedDate: new Date().toISOString(),
            totalLocations: 1, // Default, API doesn't provide this
            countedLocations: 0, // Default
            discrepanciesFound: cc.expectedQuantity && cc.countedQuantity
              ? Math.abs(parseInt(cc.expectedQuantity) - parseInt(cc.countedQuantity))
              : 0,
            performedBy: null,
          };
        });

        setCycleCounts(displayCounts);
      } catch (err) {
        console.error("Failed to load cycle counts:", err);
        setError(err instanceof Error ? err.message : "Failed to load cycle counts");
        setCycleCounts([]);
        if (err instanceof Error && !err.message.includes("Not authenticated")) {
          showToast.error("Failed to load cycle counts. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter cycle counts by warehouse for warehouse managers
  const cycleCountsForWarehouse = isWarehouseManager && assignedWarehouseName
    ? cycleCounts.filter((cc) => cc.warehouseName === assignedWarehouseName)
    : cycleCounts;
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState<CycleCountDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (type.class === "badge-outline" || !type.class) {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {type.label}
            </span>
          );
        }
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
      />

      {/* Create Ad-Hoc Count Modal */}
      <CreateAdHocCountModal
        isOpen={showAdHocModal}
        onClose={() => setShowAdHocModal(false)}
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
                placeholder="Add notes about discrepancies..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedCount(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!selectedCount) return;
                  
                  try {
                    const notes = (document.querySelector('textarea[placeholder*="notes"]') as HTMLTextAreaElement)?.value || "";
                    await operationsApi.reviewCycleCount(selectedCount.id, notes);
                    showToast.success("Discrepancies reviewed successfully");
                    setShowReviewModal(false);
                    setSelectedCount(null);
                    // Reload data
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('reloadCycleCounts'));
                    }
                  } catch (err) {
                    console.error("Failed to review discrepancies:", err);
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
                }}
              >
                Keep Count
              </button>
              <button
                className="btn btn-error"
                onClick={async () => {
                  if (!selectedCount) return;
                  
                  const reasonInput = document.querySelector('textarea[placeholder*="cancellation"]') as HTMLTextAreaElement;
                  const reason = reasonInput?.value?.trim();
                  
                  if (!reason) {
                    showToast.error("Please provide a cancellation reason");
                    return;
                  }
                  
                  try {
                    await operationsApi.cancelCycleCount(selectedCount.id, reason);
                    showToast.success("Cycle count cancelled successfully");
                    setShowCancelModal(false);
                    setSelectedCount(null);
                    // Reload data
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('reloadCycleCounts'));
                    }
                  } catch (err) {
                    console.error("Failed to cancel cycle count:", err);
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

// Cycle Count Detail Modal
function CycleCountDetailModal({
  isOpen,
  onClose,
  count,
}: {
  isOpen: boolean;
  onClose: () => void;
  count: CycleCountDisplay;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Cycle Count: ${count.countNumber}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Count Number</label>
            <p className="font-semibold">{count.countNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{count.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Section</label>
            <p className="font-semibold">{count.sectionName || "Full Warehouse"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Count Type</label>
            <p>
              <span className={`badge ${countTypeConfig[count.countType as keyof typeof countTypeConfig].class}`}>
                {countTypeConfig[count.countType as keyof typeof countTypeConfig].label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Scheduled Date</label>
            <p className="font-semibold">{count.scheduledDate}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Actual Date</label>
            <p className="font-semibold">{count.actualDate || "Not started"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              {statusConfig[count.status as keyof typeof statusConfig].class === "badge-outline" ? (
                <span 
                  className="badge text-xs whitespace-nowrap" 
                  style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                >
                  {statusConfig[count.status as keyof typeof statusConfig].label}
                </span>
              ) : (
                <span className={`badge ${statusConfig[count.status as keyof typeof statusConfig].class}`}>
                  {statusConfig[count.status as keyof typeof statusConfig].label}
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Progress</label>
            <p className="font-semibold">{count.countedLocations}/{count.totalLocations}</p>
          </div>
        </div>

        <div className="divider">Assignment Details</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Assigned By</label>
            <p className="font-semibold">{count.assignedBy || "System"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Assigned Date</label>
            <p className="font-semibold">{count.assignedDate || "N/A"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Assigned Workers</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {count.assignedWorkers.map((worker, idx) => (
                <span key={idx} className="badge badge-primary badge-sm">{worker}</span>
              ))}
            </div>
          </div>
          {count.performedBy && (
            <div>
              <label className="text-sm text-base-content/60">Performed By</label>
              <p className="font-semibold">{count.performedBy}</p>
            </div>
          )}
        </div>

        <div className="divider">Count Results</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Total Locations</label>
            <p className="font-semibold">{count.totalLocations}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Counted Locations</label>
            <p className="font-semibold">{count.countedLocations}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Discrepancies Found</label>
            <p className={`font-semibold ${count.discrepanciesFound > 0 ? "text-warning" : ""}`}>
              {count.discrepanciesFound}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {count.status === "completed" && count.discrepanciesFound > 0 && (
            <button className="btn btn-primary">
              Review Discrepancies
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

// Schedule Cycle Count Modal
function ScheduleCycleCountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    warehouseId: "",
    countType: "full",
    sectionId: "",
    scheduledDate: "",
    assignmentMethod: "automatic",
    workers: [] as string[],
    recurrence: "none",
    notes: "",
  });

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
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // For now, we'll create a cycle count entry
      // Note: The API structure might need adjustment based on backend
      // This is a simplified version - you may need to create multiple cycle counts for full warehouse
      if (formData.countType === "full") {
        // For full warehouse, you might need to create counts for all locations
        // For now, we'll show a message that this needs backend support
        showToast.error("Full warehouse cycle count requires backend support for bulk creation");
        return;
      }
      
      // For section-based counts, create a single entry
      // Note: You'll need locationCode and materialId - these should come from the section
      // This is a placeholder - adjust based on your actual data structure
      await operationsApi.createCycleCount({
        warehouseId: formData.warehouseId,
        locationCode: formData.sectionId || "A-01-01", // Default location
        materialId: "", // This might need to be handled differently
        expectedQuantity: "0", // Will be set when actual count happens
      });
      
      showToast.success("Cycle count scheduled successfully");
      onClose();
      // Reset form
      setFormData({
        warehouseId: "",
        countType: "full",
        sectionId: "",
        scheduledDate: "",
        assignmentMethod: "automatic",
        workers: [],
        recurrence: "none",
        notes: "",
      });
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadCycleCounts'));
      }
    } catch (err) {
      console.error("Failed to schedule cycle count:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to schedule cycle count");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Cycle Count" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.warehouseId}
            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
            required
            disabled={isLoadingWarehouses}
          >
            <option value="">{isLoadingWarehouses ? "Loading warehouses..." : "Select warehouse"}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Count Type *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="full"
                checked={formData.countType === "full"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Full Warehouse</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="section"
                checked={formData.countType === "section"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Specific Section</span>
            </label>
          </div>
        </div>

        {formData.countType === "section" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Section *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.sectionId}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              required={formData.countType === "section"}
            >
              <option value="">Select section</option>
              <option value="section-a">Section A - Electronics</option>
              <option value="section-b">Section B - Appliances</option>
              <option value="section-c">Section C - Home Decor</option>
            </select>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Scheduled Date *</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            required
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Worker Assignment *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="automatic"
                checked={formData.assignmentMethod === "automatic"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Automatic</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="manual"
                checked={formData.assignmentMethod === "manual"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Manual</span>
            </label>
          </div>
        </div>

        {formData.assignmentMethod === "manual" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Select Workers *</span>
            </label>
            <div className="space-y-2">
              {["John Doe", "Jane Smith", "Mike Johnson", "Sarah Lee"].map((worker) => (
                <label key={worker} className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.workers.includes(worker)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, workers: [...formData.workers, worker] });
                      } else {
                        setFormData({
                          ...formData,
                          workers: formData.workers.filter((w) => w !== worker),
                        });
                      }
                    }}
                  />
                  <span className="label-text">{worker}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Recurrence</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.recurrence}
            onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Notes</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Schedule Count
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Ad-Hoc Count Modal
function CreateAdHocCountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    warehouseId: "",
    countType: "section",
    sectionId: "",
    startNow: false,
    assignmentMethod: "automatic",
    workers: [] as string[],
    notes: "",
  });

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
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create ad-hoc cycle count
      await operationsApi.createCycleCount({
        warehouseId: formData.warehouseId,
        locationCode: formData.sectionId || "A-01-01", // Default location
        materialId: "", // This might need to be handled differently
        expectedQuantity: "0", // Will be set when actual count happens
      });
      
      showToast.success("Ad-hoc cycle count created successfully");
      onClose();
      // Reset form
      setFormData({
        warehouseId: "",
        countType: "section",
        sectionId: "",
        startNow: false,
        assignmentMethod: "automatic",
        workers: [],
        notes: "",
      });
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadCycleCounts'));
      }
    } catch (err) {
      console.error("Failed to create ad-hoc cycle count:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create ad-hoc cycle count");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Ad-Hoc Cycle Count" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.warehouseId}
            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
            required
            disabled={isLoadingWarehouses}
          >
            <option value="">{isLoadingWarehouses ? "Loading warehouses..." : "Select warehouse"}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Count Type *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="full"
                checked={formData.countType === "full"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Full Warehouse</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="countType"
                className="radio radio-primary"
                value="section"
                checked={formData.countType === "section"}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
              />
              <span className="label-text">Specific Section</span>
            </label>
          </div>
        </div>

        {formData.countType === "section" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Section *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.sectionId}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              required={formData.countType === "section"}
            >
              <option value="">Select section</option>
              <option value="section-a">Section A - Electronics</option>
              <option value="section-b">Section B - Appliances</option>
              <option value="section-c">Section C - Home Decor</option>
            </select>
          </div>
        )}

        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={formData.startNow}
              onChange={(e) => setFormData({ ...formData, startNow: e.target.checked })}
            />
            <span className="label-text">Start Now</span>
          </label>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Worker Assignment *</span>
          </label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="automatic"
                checked={formData.assignmentMethod === "automatic"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Automatic</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="assignmentMethod"
                className="radio radio-primary"
                value="manual"
                checked={formData.assignmentMethod === "manual"}
                onChange={(e) => setFormData({ ...formData, assignmentMethod: e.target.value })}
              />
              <span className="label-text">Manual</span>
            </label>
          </div>
        </div>

        {formData.assignmentMethod === "manual" && (
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Select Workers *</span>
            </label>
            <div className="space-y-2">
              {["John Doe", "Jane Smith", "Mike Johnson", "Sarah Lee"].map((worker) => (
                <label key={worker} className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.workers.includes(worker)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, workers: [...formData.workers, worker] });
                      } else {
                        setFormData({
                          ...formData,
                          workers: formData.workers.filter((w) => w !== worker),
                        });
                      }
                    }}
                  />
                  <span className="label-text">{worker}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Notes</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Count
          </button>
        </div>
      </form>
    </Modal>
  );
}


// Edit Schedule Modal
function EditScheduleModal({
  isOpen,
  onClose,
  count,
}: {
  isOpen: boolean;
  onClose: () => void;
  count: CycleCountDisplay;
}) {
  const [formData, setFormData] = useState({
    scheduledDate: count.scheduledDate || "",
    assignedWorkers: [...count.assignedWorkers],
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update schedule
    console.log("Updating schedule:", formData);
    alert("Schedule updated successfully!");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Schedule: ${count.countNumber}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Scheduled Date *</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Assigned Workers</span>
          </label>
          <div className="space-y-2">
            {["John Doe", "Jane Smith", "Mike Johnson", "Sarah Lee"].map((worker) => (
              <label key={worker} className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={formData.assignedWorkers.includes(worker)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, assignedWorkers: [...formData.assignedWorkers, worker] });
                    } else {
                      setFormData({
                        ...formData,
                        assignedWorkers: formData.assignedWorkers.filter((w) => w !== worker),
                      });
                    }
                  }}
                />
                <span className="label-text">{worker}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Notes</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Schedule
          </button>
        </div>
      </form>
    </Modal>
  );
}
