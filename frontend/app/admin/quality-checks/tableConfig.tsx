import Link from "next/link";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { qualityChecksApi } from "@/lib/api/qualityChecks";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { resultConfig, type QualityCheckDisplay } from "./types";

export function buildSummaryCards(summary: {
  totalChecksThisMonth: number;
  pendingApproval: number;
  passRate: number;
  rejectedItems: number;
}) {
  return [
    {
      label: "Total Checks This Month",
      value: summary.totalChecksThisMonth,
      icon: "verified",
      color: "primary" as const,
    },
    {
      label: "Pending Approval",
      value: summary.pendingApproval,
      icon: "schedule",
      color: "warning" as const,
    },
    {
      label: "Pass Rate",
      value: `${summary.passRate}%`,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Rejected Items",
      value: summary.rejectedItems,
      icon: "cancel",
      color: "error" as const,
    },
  ];
}

export function buildColumns(onOpenDetails: (check: QualityCheckDisplay) => void) {
  return [
    {
      key: "checkId",
      label: "Check ID",
      render: (check: QualityCheckDisplay) => (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails(check);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {check.checkId}
        </button>
      ),
      sortable: true,
    },
    {
      key: "inboundOrderNumber",
      label: "Inbound Order",
      render: (check: QualityCheckDisplay) => (
        <Link href={`/admin/orders/inbound/${check.inboundOrderNumber}`} className="text-primary hover:underline">
          {check.inboundOrderNumber}
        </Link>
      ),
      sortable: true,
    },
    {
      key: "productName",
      label: "Product",
      render: (check: QualityCheckDisplay) => (
        <div>
          <div className="font-medium">{check.productName}</div>
          <div className="text-xs text-base-content/60">{check.sku}</div>
        </div>
      ),
    },
    { key: "quantityChecked", label: "Qty Checked", sortable: true },
    {
      key: "quantityPassed",
      label: "Qty Passed",
      render: (check: QualityCheckDisplay) => <span className="text-success font-semibold">{check.quantityPassed}</span>,
      sortable: true,
    },
    {
      key: "quantityFailed",
      label: "Qty Failed",
      render: (check: QualityCheckDisplay) => <span className="text-error font-semibold">{check.quantityFailed}</span>,
      sortable: true,
    },
    {
      key: "result",
      label: "Result",
      render: (check: QualityCheckDisplay) => {
        const result = resultConfig[check.result];
        return <span className={`badge ${result.class}`}>{result.label}</span>;
      },
      sortable: true,
    },
    { key: "checkedByName", label: "Checked By", className: "text-base-content/70" },
    {
      key: "checkDate",
      label: "Check Date",
      render: (check: QualityCheckDisplay) => check.checkDate.split(" ")[0],
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "approvedByName",
      label: "Approved By",
      render: (check: QualityCheckDisplay) => check.approvedByName || "-",
      className: "text-base-content/70",
    },
  ];
}

export function buildRenderActions({
  canApprove,
  adminId,
  onRefresh,
  onOpenDetails,
  onOpenReject,
}: {
  canApprove: boolean;
  adminId?: string;
  onRefresh: () => Promise<void>;
  onOpenDetails: (check: QualityCheckDisplay) => void;
  onOpenReject: (check: QualityCheckDisplay) => void;
}) {
  return (check: QualityCheckDisplay) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <Link href={`/admin/quality-checks/${check.id}`}>
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </Link>
        </li>
        {!check.approvedByName && canApprove && (
          <>
            <li>
              <button
                onClick={async () => {
                  if (!confirm(`Approve quality check ${check.checkId}?`)) {
                    return;
                  }

                  try {
                    await qualityChecksApi.approve(check.id, adminId);
                    showToast.success("Quality check approved successfully!");
                    await onRefresh();
                  } catch (err) {
                    logger.error("Failed to approve quality check:", err);
                    showToast.error(err instanceof Error ? err.message : "Failed to approve quality check");
                  }
                }}
              >
                <span className="material-symbols-outlined text-sm">check</span>
                Approve Quality Check
              </button>
            </li>
            <li>
              <button className="text-error" onClick={() => onOpenReject(check)}>
                <span className="material-symbols-outlined text-sm">close</span>
                Reject Quality Check
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  );
}

export function canApproveRoute(hasPermission: (route: string, action?: string) => boolean): boolean {
  return hasPermission(ADMIN_ROUTES.QUALITY_CHECKS, "approve");
}
