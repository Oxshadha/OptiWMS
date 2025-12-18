"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { DetailModal } from "@/components/DetailModal";

// Mock data - same as in parent page
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

export default function CycleCountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [count, setCount] = useState<typeof cycleCounts[0] | null>(null);

  useEffect(() => {
    const foundCount = cycleCounts.find((c) => c.id === params.id);
    if (foundCount) {
      setCount(foundCount);
    }
  }, [params.id]);

  if (!count) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cycle Count Not Found</h1>
          <button className="btn btn-primary" onClick={() => router.push("/admin/cycle-counts")}>
            Back to Cycle Counts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            className="btn btn-ghost btn-sm mb-2"
            onClick={() => router.push("/admin/cycle-counts")}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </button>
          <h1 className="text-3xl font-bold text-base-content">Cycle Count: {count.countNumber}</h1>
        </div>
      </div>

      <DetailModal
        isOpen={true}
        onClose={() => router.push("/admin/cycle-counts")}
        title={`Cycle Count: ${count.countNumber}`}
        size="lg"
      >
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
            <button className="btn btn-ghost" onClick={() => router.push("/admin/cycle-counts")}>
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
    </div>
  );
}

