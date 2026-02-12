"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { inventoryApi } from "@/lib/api/inventory";
import { materialsApi } from "@/lib/api/materials";
import { qualityChecksApi, QualityCheck } from "@/lib/api/qualityChecks";
import { usersApi } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";

const resultConfig = {
  passed: { label: "Passed", class: "badge-success" },
  failed: { label: "Failed", class: "badge-error" },
  partial: { label: "Partial", class: "badge-warning" },
};

interface QualityCheckDetail {
  id: string;
  checkId: string;
  inboundOrderNumber: string;
  productName: string;
  sku: string;
  quantityChecked: number;
  quantityPassed: number;
  quantityFailed: number;
  result: "passed" | "failed" | "partial";
  checkedByName: string;
  checkDate: string;
  rejectionReason: string | null;
  approvalStatus: string;
  approvedByName: string | null;
  approvedAt: string | null;
}

function toDisplayCheck(
  check: QualityCheck,
  material?: { materialCode?: string; description?: string },
  checkerName?: string,
  approverName?: string
): QualityCheckDetail {
  const qtyChecked = parseInt(check.qtyReceived || "0", 10) || 0;
  const qtyPassed = parseInt(check.qtyPassed || "0", 10) || 0;
  const qtyFailed = parseInt(check.qtyRejected || "0", 10) || 0;
  const approvalStatus = (check.approvalStatus || "").toUpperCase();

  let result: "passed" | "failed" | "partial" = "partial";
  if (approvalStatus === "APPROVED") {
    result = "passed";
  } else if (approvalStatus === "REJECTED") {
    result = "failed";
  } else if (qtyFailed === 0 && qtyPassed > 0) {
    result = "passed";
  } else if (qtyPassed === 0 && qtyFailed > 0) {
    result = "failed";
  }

  return {
    id: check.id,
    checkId: `QC-${check.id.substring(0, 8).toUpperCase()}`,
    inboundOrderNumber: check.grnId
      ? `GRN-${check.grnId.substring(0, 8).toUpperCase()}`
      : "N/A",
    productName: material?.description || "Unknown",
    sku: material?.materialCode || check.materialId || "N/A",
    quantityChecked: qtyChecked,
    quantityPassed: qtyPassed,
    quantityFailed: qtyFailed,
    result,
    checkedByName: checkerName || "Unknown",
    checkDate: check.checkDate
      ? new Date(check.checkDate).toLocaleString()
      : "N/A",
    rejectionReason: check.rejectionReason || null,
    approvalStatus: check.approvalStatus || "PENDING",
    approvedByName: approverName || null,
    approvedAt: check.approvedAt ? new Date(check.approvedAt).toLocaleString() : null,
  };
}

export default function QualityCheckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, admin } = useAdmin();
  const checkId = params.id as string;
  const canApprove = hasPermission(ADMIN_ROUTES.QUALITY_CHECKS, "approve");

  const [check, setCheck] = useState<QualityCheckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [quarantineLocation, setQuarantineLocation] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const loadCheck = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiCheck = await qualityChecksApi.getById(checkId);
        const [material, checker, approver] = await Promise.all([
          apiCheck.materialId
            ? materialsApi.getById(apiCheck.materialId).catch(() => null)
            : Promise.resolve(null),
          apiCheck.checkedBy
            ? usersApi.getById(apiCheck.checkedBy).catch(() => null)
            : Promise.resolve(null),
          apiCheck.approvedBy
            ? usersApi.getById(apiCheck.approvedBy).catch(() => null)
            : Promise.resolve(null),
        ]);

        const checkerName = checker
          ? `${checker.firstName || ""} ${checker.lastName || ""}`.trim() ||
            checker.username ||
            checker.email ||
            "Unknown"
          : "Unknown";

        const approverName = approver
          ? `${approver.firstName || ""} ${approver.lastName || ""}`.trim() ||
            approver.username ||
            approver.email ||
            "Unknown"
          : undefined;

        setCheck(
          toDisplayCheck(
            apiCheck,
            material || undefined,
            checkerName,
            approverName
          )
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load quality check";
        setError(message);
        setCheck(null);
      } finally {
        setLoading(false);
      }
    };

    if (checkId) {
      loadCheck();
    }
  }, [checkId]);

  const result = useMemo(() => {
    if (!check) return null;
    return resultConfig[check.result];
  }, [check]);

  const handleReject = async () => {
    if (!check) return;
    if (!rejectReason.trim()) {
      showToast.warning("Please enter a rejection reason");
      return;
    }

    try {
      setActionLoading(true);
      await qualityChecksApi.reject(check.id, rejectReason.trim(), admin?.id);
      showToast.success("Quality check rejected");
      setShowRejectModal(false);
      router.push("/admin/quality-checks");
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to reject quality check"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!check) return;
    try {
      setActionLoading(true);
      await qualityChecksApi.approve(check.id, admin?.id);
      showToast.success("Quality check approved");
      router.push("/admin/quality-checks");
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to approve quality check"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuarantine = async () => {
    if (!check) return;
    if (!quarantineLocation.trim()) {
      showToast.warning("Please enter a location code");
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.quarantineBin(
        check.sku,
        quarantineLocation.trim().toUpperCase(),
        check.id
      );
      showToast.success(
        `Bin ${quarantineLocation.toUpperCase()} quarantined successfully`
      );
      setShowQuarantineModal(false);
      setQuarantineLocation("");
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Error quarantining bin"
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !check || !result) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>{error || "Quality check not found"}</span>
          <Link href="/admin/quality-checks" className="btn btn-sm">
            Back to Quality Checks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/quality-checks"
            className="text-primary hover:underline mb-2 inline-block"
          >
            ← Back to Quality Checks
          </Link>
          <h1 className="text-3xl font-bold text-base-content">{check.checkId}</h1>
          <p className="text-sm text-base-content/60 mt-1">Quality Check Details</p>
        </div>
        {canApprove && check.approvalStatus === "PENDING" && (
          <div className="flex gap-3">
            {check.quantityFailed > 0 && (
              <button
                className="btn btn-warning"
                onClick={() => setShowQuarantineModal(true)}
                title="Quarantine damaged items"
              >
                <span className="material-symbols-outlined">block</span>
                Quarantine
              </button>
            )}
            <button className="btn btn-error" onClick={() => setShowRejectModal(true)}>
              <span className="material-symbols-outlined">close</span>
              Reject
            </button>
            <button className="btn btn-success" onClick={handleApprove}>
              <span className="material-symbols-outlined">check</span>
              Approve
            </button>
          </div>
        )}
      </div>

      <div className="card bg-base-100 border border-base-300 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-base-content/60">Check ID</label>
            <p className="font-semibold text-lg">{check.checkId}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Result</label>
            <p>
              <span className={`badge ${result.class}`}>{result.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Inbound Order</label>
            <Link
              href={`/admin/orders/inbound?search=${check.inboundOrderNumber}`}
              className="font-semibold text-primary hover:underline"
            >
              {check.inboundOrderNumber}
            </Link>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Product</label>
            <p className="font-semibold">{check.productName}</p>
            <p className="text-sm text-base-content/60">SKU: {check.sku}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Quantity Checked</label>
            <p className="font-semibold">{check.quantityChecked}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Quantity Passed</label>
            <p className="font-semibold text-success">{check.quantityPassed}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Quantity Failed</label>
            <p className="font-semibold text-error">{check.quantityFailed}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Checked By</label>
            <p className="font-semibold">{check.checkedByName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Check Date</label>
            <p className="font-semibold">{check.checkDate}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Rejection Reason</label>
            <p className="font-semibold">{check.rejectionReason || "-"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Approval Status</label>
            <p className="font-semibold">{check.approvalStatus}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Approved By</label>
            <p className="font-semibold">{check.approvedByName || "-"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Approved At</label>
            <p className="font-semibold">{check.approvedAt || "-"}</p>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason("");
        }}
        title="Reject Quality Check"
      >
        <div className="space-y-4">
          <div className="alert alert-warning">
            <span className="material-symbols-outlined">warning</span>
            <span>Are you sure you want to reject quality check {check.checkId}?</span>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rejection Reason *</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter detailed reason for rejection..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason("");
              }}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button className="btn btn-error" onClick={handleReject} disabled={actionLoading}>
              Reject Quality Check
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showQuarantineModal}
        onClose={() => {
          setShowQuarantineModal(false);
          setQuarantineLocation("");
        }}
        title="Quarantine Bin"
      >
        <div className="space-y-4">
          <div className="alert alert-warning">
            <span className="material-symbols-outlined">warning</span>
            <span>
              Quarantining this bin prevents items from being picked. Use for damaged
              items.
            </span>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Location Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={quarantineLocation}
              onChange={(e) => setQuarantineLocation(e.target.value.toUpperCase())}
              placeholder="e.g., ST-01-004-03-A"
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Product</span>
            </label>
            <p className="font-semibold">{check.productName}</p>
            <p className="text-sm text-base-content/60">SKU: {check.sku}</p>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Failed Items</span>
            </label>
            <p className="text-error font-semibold">{check.quantityFailed} items</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowQuarantineModal(false);
                setQuarantineLocation("");
              }}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              className="btn btn-warning"
              onClick={handleQuarantine}
              disabled={actionLoading}
            >
              <span className="material-symbols-outlined">block</span>
              Quarantine Bin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
