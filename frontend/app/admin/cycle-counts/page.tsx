"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";

// Mock data - will be replaced with API calls
const cycleCounts = [
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
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState<typeof cycleCounts[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const summary = {
    scheduledThisMonth: 8,
    inProgress: 2,
    completedThisWeek: 5,
    discrepanciesFound: 15,
  };

  const filteredCounts = cycleCounts.filter((count) => {
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
      render: (count: typeof cycleCounts[0]) => (
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
      render: (count: typeof cycleCounts[0]) => count.sectionName || "Full Warehouse",
    },
    {
      key: "countType",
      label: "Count Type",
      render: (count: typeof cycleCounts[0]) => {
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
      render: (count: typeof cycleCounts[0]) => {
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
      render: (count: typeof cycleCounts[0]) => (
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
      render: (count: typeof cycleCounts[0]) => (
        <span className={count.discrepanciesFound > 0 ? "text-warning font-semibold" : ""}>
          {count.discrepanciesFound}
        </span>
      ),
      sortable: true,
    },
  ];

  const renderActions = (count: typeof cycleCounts[0]) => (
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
        {count.status === "scheduled" && (
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
        {count.status === "completed" && count.discrepanciesFound > 0 && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">warning</span>
              Review Discrepancies
            </button>
          </li>
        )}
        {count.status === "scheduled" && (
          <li>
            <button 
              className="text-error"
              onClick={() => {
                if (confirm(`Are you sure you want to cancel cycle count ${count.countNumber}?`)) {
                  // TODO: API call to cancel count
                  console.log("Cancelling count:", count.id);
                  alert("Cycle count cancelled successfully!");
                }
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
          <h1 className="text-3xl font-bold text-base-content">Cycle Counts</h1>
          <p className="text-sm text-base-content/60 mt-1">Schedule and manage inventory audits</p>
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
            </ul>
          </div>
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
  count: typeof cycleCounts[0];
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to schedule cycle count
    console.log("Scheduling cycle count:", formData);
    onClose();
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
          >
            <option value="">Select warehouse</option>
            <option value="wh-1">Warehouse 1</option>
            <option value="wh-2">Warehouse 2</option>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create ad-hoc count
    console.log("Creating ad-hoc count:", formData);
    onClose();
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
          >
            <option value="">Select warehouse</option>
            <option value="wh-1">Warehouse 1</option>
            <option value="wh-2">Warehouse 2</option>
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
  count: typeof cycleCounts[0];
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
