import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { qualityChecksApi } from "@/lib/api/qualityChecks";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { resultConfig, type QualityCheckDisplay } from "../types";

interface QualityCheckDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  check: QualityCheckDisplay;
  adminId?: string;
  onRefresh: () => Promise<void>;
  canApprove: boolean;
  onReject: () => void;
}

export function QualityCheckDetailModal({
  isOpen,
  onClose,
  check,
  adminId,
  onRefresh,
  canApprove,
  onReject,
}: QualityCheckDetailModalProps) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Quality Check: ${check.checkId}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Check ID</label>
            <p className="font-semibold">{check.checkId}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Inbound Order</label>
            <p className="font-semibold">{check.inboundOrderNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Product</label>
            <p className="font-semibold">{check.productName}</p>
            <p className="text-xs text-base-content/60">{check.sku}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Result</label>
            <p>
              <span className={`badge ${resultConfig[check.result].class}`}>{resultConfig[check.result].label}</span>
            </p>
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

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {!check.approvedByName && canApprove && (
            <>
              <button className="btn btn-error" onClick={onReject}>
                Reject
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await qualityChecksApi.approve(check.id, adminId);
                    showToast.success("Quality check approved successfully");
                    await onRefresh();
                    onClose();
                  } catch (err) {
                    logger.error("Failed to approve quality check:", err);
                    showToast.error(err instanceof Error ? err.message : "Failed to approve quality check");
                  }
                }}
              >
                Approve Quality Check
              </button>
            </>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

interface RejectQualityCheckModalProps {
  isOpen: boolean;
  check: QualityCheckDisplay | null;
  rejectReason: string;
  adminId?: string;
  onChangeRejectReason: (value: string) => void;
  onClose: () => void;
  onRejected: () => Promise<void>;
}

export function RejectQualityCheckModal({
  isOpen,
  check,
  rejectReason,
  adminId,
  onChangeRejectReason,
  onClose,
  onRejected,
}: RejectQualityCheckModalProps) {
  if (!check) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Quality Check">
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
            onChange={(e) => onChangeRejectReason(e.target.value)}
            placeholder="Enter detailed reason for rejection..."
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-error"
            onClick={async () => {
              if (!rejectReason.trim()) {
                showToast.warning("Please enter a rejection reason");
                return;
              }

              try {
                await qualityChecksApi.reject(check.id, rejectReason, adminId);
                showToast.success("Quality check rejected successfully");
                await onRejected();
              } catch (err) {
                logger.error("Failed to reject quality check:", err);
                showToast.error(err instanceof Error ? err.message : "Failed to reject quality check");
              }
            }}
          >
            Reject Quality Check
          </button>
        </div>
      </div>
    </Modal>
  );
}
