"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { operationsApi } from "@/lib/api/operations";
import {
  useReferenceLocations,
  useReferenceUsers,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";

const countTypeConfig = {
  scheduled: { label: "Scheduled" },
  ad_hoc: { label: "Ad-Hoc" },
  full: { label: "Full" },
};

const statusConfig = {
  scheduled: { label: "Scheduled" },
  in_progress: { label: "In Progress" },
  pending_approval: { label: "Pending Approval" },
  recount_required: { label: "Recount Required" },
  completed: { label: "Completed" },
  cancelled: { label: "Cancelled" },
};

function getCycleCountStatusTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (
    status === "in_progress" ||
    status === "pending_approval" ||
    status === "recount_required"
  ) {
    return "info";
  }
  return "warning";
}

export default function CycleCountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cycleCountId = params.id as string;

  const countQuery = useQuery({
    queryKey: ["admin-cycle-counts", "detail", cycleCountId],
    queryFn: () => operationsApi.getCycleCountById(cycleCountId),
    enabled: !!cycleCountId,
  });
  const warehousesQuery = useReferenceWarehouses();
  const usersQuery = useReferenceUsers();
  const locationsQuery = useReferenceLocations();

  const loading =
    (countQuery.isPending && !countQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data) ||
    (usersQuery.isPending && !usersQuery.data) ||
    (locationsQuery.isPending && !locationsQuery.data);

  const count = useMemo(() => {
    if (!countQuery.data) {
      return null;
    }

    const warehouseName =
      (warehousesQuery.data || []).find(
        (warehouse) => warehouse.id === countQuery.data?.warehouseId
      )?.name || "Unknown";

    const usersMap = new Map<string, string>();
    (usersQuery.data || []).forEach((user) => {
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      usersMap.set(user.id, fullName || user.username || user.employeeId || user.id);
    });

    const allLocationCodes = (locationsQuery.data || [])
      .filter((location) => location.warehouseId === countQuery.data?.warehouseId)
      .map((location) => location.locationCode)
      .filter(Boolean) as string[];

    let sectionName = countQuery.data.locationCode;
    if (countQuery.data.locationCode === "ALL") {
      sectionName = "Full Warehouse";
    } else if (countQuery.data.locationCode.startsWith("AREA:")) {
      sectionName = `Section ${countQuery.data.locationCode.replace("AREA:", "")}`;
    }

    let totalLocations = 1;
    if (countQuery.data.locationCode === "ALL") {
      totalLocations = Math.max(allLocationCodes.length, 1);
    } else if (countQuery.data.locationCode.startsWith("AREA:")) {
      const area = countQuery.data.locationCode.replace("AREA:", "").trim().toUpperCase();
      totalLocations = Math.max(
        allLocationCodes.filter((code) => code.toUpperCase().startsWith(`${area}-`)).length,
        1
      );
    }

    const countedLocations =
      countQuery.data.status === "completed"
        ? totalLocations
        : countQuery.data.countedAt
          ? 1
          : 0;

    return {
      id: countQuery.data.id,
      countNumber: countQuery.data.countNumber,
      warehouseName,
      sectionName,
      countType: countQuery.data.countNumber?.startsWith("ADH-")
        ? "ad_hoc"
        : countQuery.data.locationCode === "ALL"
          ? "full"
          : "scheduled",
      scheduledDate: countQuery.data.scheduledDate || "N/A",
      actualDate: countQuery.data.countedAt
        ? countQuery.data.countedAt.split("T")[0]
        : null,
      status: countQuery.data.status || "scheduled",
      assignedWorkers:
        countQuery.data.assignedWorkers?.map((id) => usersMap.get(id) || id) || [],
      performedBy: countQuery.data.countedBy
        ? usersMap.get(countQuery.data.countedBy) || countQuery.data.countedBy
        : null,
      totalLocations,
      countedLocations,
      discrepanciesFound: countQuery.data.variance
        ? Math.abs(parseFloat(countQuery.data.variance))
        : 0,
      expectedQuantity: countQuery.data.expectedQuantity || null,
      countedQuantity: countQuery.data.countedQuantity || null,
      variance: countQuery.data.variance || null,
      approvalRequired: countQuery.data.approvalRequired || false,
      approvalNotes: countQuery.data.approvalNotes || null,
    };
  }, [countQuery.data, locationsQuery.data, usersQuery.data, warehousesQuery.data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

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

  const countType =
    countTypeConfig[count.countType as keyof typeof countTypeConfig] || {
      label: count.countType,
    };
  const status =
    statusConfig[count.status as keyof typeof statusConfig] || {
      label: count.status,
    };

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
          <h1 className="text-3xl font-bold text-base-content">
            Cycle Count: {count.countNumber}
          </h1>
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
              <p className="font-semibold">{count.sectionName}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Count Type</label>
              <p>
                <StatusChip label={countType.label} tone="neutral" />
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
                <StatusChip
                  label={status.label}
                  tone={getCycleCountStatusTone(count.status)}
                  showDot
                />
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Progress</label>
              <p className="font-semibold">
                {count.countedLocations}/{count.totalLocations}
              </p>
            </div>
          </div>

          <div className="divider">Assignment Details</div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-base-content/60">Assigned Workers</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {count.assignedWorkers.length > 0 ? (
                  count.assignedWorkers.map((worker, index) => (
                    <StatusChip key={index} label={worker} tone="neutral" />
                  ))
                ) : (
                  <span className="text-base-content/60">No workers assigned</span>
                )}
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
              <label className="text-sm text-base-content/60">Expected Quantity</label>
              <p className="font-semibold">{count.expectedQuantity || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Counted Quantity</label>
              <p className="font-semibold">{count.countedQuantity || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Variance</label>
              <p className="font-semibold">{count.variance || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Discrepancies Found</label>
              <p
                className={`font-semibold ${
                  count.discrepanciesFound > 0 ? "text-warning" : ""
                }`}
              >
                {count.discrepanciesFound}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Approval Required</label>
              <p className="font-semibold">{count.approvalRequired ? "Yes" : "No"}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Approval Notes</label>
              <p className="font-semibold">{count.approvalNotes || "N/A"}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button className="btn btn-ghost" onClick={() => router.push("/admin/cycle-counts")}>
              Close
            </button>
          </div>
        </div>
      </DetailModal>
    </div>
  );
}
