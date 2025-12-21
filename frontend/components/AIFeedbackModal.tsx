"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { AIServiceId } from "@/lib/ai-services/registry";
import { aiFeedbackAPI } from "@/lib/ai-services/client";

interface AIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: AIServiceId;
  suggestionId: string;
  suggestionContext?: Record<string, any>;
  onFeedbackSubmitted?: () => void;
}

const REASON_CODES = {
  "too_heavy": "Too heavy for top shelf",
  "aisle_blocked": "Aisle blocked",
  "prefer_different_zone": "Prefer different zone",
  "capacity_issue": "Capacity issue",
  "safety_concern": "Safety concern",
  "operational_preference": "Operational preference",
  "other": "Other",
} as const;

type ReasonCode = keyof typeof REASON_CODES;

export function AIFeedbackModal({
  isOpen,
  onClose,
  serviceId,
  suggestionId,
  suggestionContext,
  onFeedbackSubmitted,
}: AIFeedbackModalProps) {
  const [action, setAction] = useState<"rejected" | "deferred" | "modified">("rejected");
  const [reasonCode, setReasonCode] = useState<ReasonCode | "">("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reasonCode || !reason.trim()) {
      alert("Please select a reason code and provide details");
      return;
    }

    setIsSubmitting(true);
    try {
      await aiFeedbackAPI.submitFeedback({
        serviceId,
        suggestionId,
        action,
        reason,
        reasonCode,
        context: suggestionContext || {},
      });

      alert("Thank you for your feedback! This will help improve AI suggestions.");
      onFeedbackSubmitted?.();
      handleClose();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Error submitting feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAction("rejected");
    setReasonCode("");
    setReason("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Provide Feedback on AI Suggestion">
      <div className="space-y-4">
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <span>
            Your feedback helps improve AI suggestions. Please tell us why you {action} this suggestion.
          </span>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Action Taken *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={action}
            onChange={(e) => setAction(e.target.value as "rejected" | "deferred" | "modified")}
          >
            <option value="rejected">Rejected</option>
            <option value="deferred">Deferred</option>
            <option value="modified">Modified</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Reason Code *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
          >
            <option value="">Select a reason...</option>
            {Object.entries(REASON_CODES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Additional Details *</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please provide additional context about why you took this action..."
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            className="btn btn-ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !reasonCode || !reason.trim()}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

