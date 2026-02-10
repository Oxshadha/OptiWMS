"use client";

import { Modal } from "@/components/Modal";
import { showToast } from "@/lib/utils/toast";
import { operationsApi } from "@/lib/api/operations";
import { logger } from "@/lib/utils/logger";
import { CycleCountDisplay } from "../types";

export function ReviewDiscrepanciesModal({
  selectedCount,
  isOpen,
  reviewNotes,
  onReviewNotesChange,
  onClose,
  onSuccess,
}: {
  selectedCount: CycleCountDisplay;
  isOpen: boolean;
  reviewNotes: string;
  onReviewNotesChange: (value: string) => void;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Review Discrepancies: ${selectedCount.countNumber}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <span>Found {selectedCount.discrepanciesFound} discrepancies in this cycle count.</span>
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
            onChange={(e) => onReviewNotesChange(e.target.value)}
            placeholder="Add notes about discrepancies..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await operationsApi.reviewCycleCount(
                  selectedCount.id,
                  reviewNotes.trim() || undefined
                );
                showToast.success("Discrepancies reviewed successfully");
                onClose();
                await onSuccess();
              } catch (err) {
                logger.error("Failed to review discrepancies:", err);
                showToast.error(
                  err instanceof Error ? err.message : "Failed to review discrepancies"
                );
              }
            }}
          >
            Review & Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CancelCountModal({
  selectedCount,
  isOpen,
  cancelReason,
  onCancelReasonChange,
  onClose,
  onSuccess,
}: {
  selectedCount: CycleCountDisplay;
  isOpen: boolean;
  cancelReason: string;
  onCancelReasonChange: (value: string) => void;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Cycle Count">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <span>
            Are you sure you want to cancel cycle count {selectedCount.countNumber}? This action cannot
            be undone.
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
            onChange={(e) => onCancelReasonChange(e.target.value)}
            placeholder="Enter reason for cancellation"
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Keep Count
          </button>
          <button
            className="btn btn-error"
            onClick={async () => {
              const reason = cancelReason.trim();
              if (!reason) {
                showToast.error("Please provide a cancellation reason");
                return;
              }

              try {
                await operationsApi.cancelCycleCount(selectedCount.id, reason);
                showToast.success("Cycle count cancelled successfully");
                onClose();
                await onSuccess();
              } catch (err) {
                logger.error("Failed to cancel cycle count:", err);
                showToast.error(
                  err instanceof Error ? err.message : "Failed to cancel cycle count"
                );
              }
            }}
          >
            Cancel Count
          </button>
        </div>
      </div>
    </Modal>
  );
}
