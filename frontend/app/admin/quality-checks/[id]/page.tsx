"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { inventoryApi } from "@/lib/api/inventory";

// Mock data - will be replaced with API calls
const qualityChecks = [
  {
    id: "qc-1",
    checkId: "QC-2025-001",
    inboundOrderNumber: "PO-452368",
    productName: "Wireless Earbuds",
    sku: "SKU-1001",
    quantityChecked: 50,
    quantityPassed: 48,
    quantityFailed: 2,
    result: "partial",
    checkedByName: "John Doe",
    checkDate: "2025-12-15 10:30",
    approvedByName: null,
    approvalDate: null,
    failedItems: [
      { itemNumber: 1, reason: "Packaging damaged" },
      { itemNumber: 2, reason: "Missing accessories" },
    ],
  },
  {
    id: "qc-2",
    checkId: "QC-2025-002",
    inboundOrderNumber: "PO-452369",
    productName: "Smart Projector",
    sku: "SKU-1002",
    quantityChecked: 30,
    quantityPassed: 30,
    quantityFailed: 0,
    result: "passed",
    checkedByName: "Jane Smith",
    checkDate: "2025-12-15 11:00",
    approvedByName: "Manager A",
    approvalDate: "2025-12-15 11:15",
    failedItems: [],
  },
];

const resultConfig = {
  passed: { label: "Passed", class: "badge-success" },
  failed: { label: "Failed", class: "badge-error" },
  partial: { label: "Partial", class: "badge-warning" },
};

export default function QualityCheckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAdmin();
  const checkId = params.id as string;
  const check = qualityChecks.find((c) => c.id === checkId);
  const canApprove = hasPermission(ADMIN_ROUTES.QUALITY_CHECKS, "approve");

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [quarantineLocation, setQuarantineLocation] = useState("");

  if (!check) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Quality check not found</span>
          <Link href="/admin/quality-checks" className="btn btn-sm">
            Back to Quality Checks
          </Link>
        </div>
      </div>
    );
  }

  const result = resultConfig[check.result as keyof typeof resultConfig];

  const handleApprove = () => {
    // TODO: API call to approve quality check
    console.log("Approving quality check:", checkId);
    alert("Quality check approved successfully!");
    router.push("/admin/quality-checks");
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert("Please enter a rejection reason");
      return;
    }
    // TODO: API call to reject quality check
    console.log("Rejecting quality check:", checkId, rejectReason);
    alert("Quality check rejected successfully!");
    router.push("/admin/quality-checks");
  };

  const handleQuarantine = async () => {
    if (!quarantineLocation.trim()) {
      alert("Please enter a location code");
      return;
    }
    try {
      // TODO: Replace with actual API call
      // await inventoryApi.quarantineBin(check.sku, quarantineLocation, checkId);
      console.log("Quarantining bin:", quarantineLocation, "for QC:", checkId);
      alert(`Bin ${quarantineLocation} quarantined successfully. Items will not be available for picking.`);
      setShowQuarantineModal(false);
      setQuarantineLocation("");
    } catch (error) {
      console.error("Error quarantining bin:", error);
      alert("Error quarantining bin. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/quality-checks" className="text-primary hover:underline mb-2 inline-block">
            ← Back to Quality Checks
          </Link>
          <h1 className="text-3xl font-bold text-base-content">{check.checkId}</h1>
          <p className="text-sm text-base-content/60 mt-1">Quality Check Details</p>
        </div>
        {canApprove && !check.approvedByName && (
          <div className="flex gap-3">
            {check.failedItems && check.failedItems.length > 0 && (
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

      {/* Quality Check Information */}
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
            <label className="text-sm text-base-content/60">Approved By</label>
            <p className="font-semibold">{check.approvedByName || "Pending"}</p>
          </div>
          {check.approvalDate && (
            <div>
              <label className="text-sm text-base-content/60">Approval Date</label>
              <p className="font-semibold">{check.approvalDate}</p>
            </div>
          )}
        </div>

        {/* Failed Items */}
        {check.failedItems && check.failedItems.length > 0 && (
          <div className="mt-6 pt-6 border-t border-base-300">
            <h3 className="font-semibold mb-4">Failed Items</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Item Number</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {check.failedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.itemNumber}</td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
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
            <span>
              Are you sure you want to reject quality check {check.checkId}?
            </span>
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
            >
              Cancel
            </button>
            <button className="btn btn-error" onClick={handleReject}>
              Reject Quality Check
            </button>
          </div>
        </div>
      </Modal>

      {/* Quarantine Modal */}
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
              Quarantining this bin will prevent items from being picked. Use this for damaged items identified by Vehicle Inspector.
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
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                Enter the bin location code where damaged items are stored
              </span>
            </label>
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
            >
              Cancel
            </button>
            <button className="btn btn-warning" onClick={handleQuarantine}>
              <span className="material-symbols-outlined">block</span>
              Quarantine Bin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

