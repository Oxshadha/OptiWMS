"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/lib/auth/AuthContext";
import { notificationsApi } from "@/lib/api/notifications";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

export default function HelpPage() {
  const { user } = useAuth();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    category: "general",
    subject: "",
    details: "",
  });

  const openSupportModal = (requestedPriority: "normal" | "urgent") => {
    setPriority(requestedPriority);
    setShowSupportModal(true);
  };

  const resetForm = () => {
    setFormData({
      category: "general",
      subject: "",
      details: "",
    });
    setPriority("normal");
  };

  const handleSubmitSupportRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast.error("You must be signed in to submit a support request");
      return;
    }

    try {
      setSubmitting(true);
      await notificationsApi.create({
        audienceRoles: "admin,warehouse_manager,inbound_coordinator",
        title: `Support Request: ${formData.subject.trim()}`,
        message: [
          `${formData.details.trim()}`,
          "",
          `Requester: ${user.name || user.username}`,
          `Role: ${user.role || "unknown"}`,
          `Category: ${formData.category}`,
          `Priority: ${priority}`,
        ].join("\n"),
        notificationType: "support",
        actionUrl: "/admin/help",
        metadata: JSON.stringify({
          requesterId: user.userId,
          requesterName: user.name || user.username,
          requesterEmail: user.email,
          requesterRole: user.role,
          category: formData.category,
          priority,
        }),
      });
      showToast.success("Support request submitted to the admin support queue");
      setShowSupportModal(false);
      resetForm();
    } catch (error) {
      logger.error("[HelpPage] Failed to submit support request:", error);
      showToast.error(
        error instanceof Error ? error.message : "Failed to submit support request"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Help Center</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Getting Started</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• How to create a warehouse</li>
            <li>• Setting up your first order</li>
            <li>• Managing inventory</li>
            <li>• User roles and permissions</li>
          </ul>
        </div>
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Workflows</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• Receiving process</li>
            <li>• Putaway operations</li>
            <li>• Picking and packing</li>
            <li>• Shipping procedures</li>
          </ul>
        </div>
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Reports & Analytics</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• Generating reports</li>
            <li>• Understanding KPIs</li>
            <li>• Exporting data</li>
            <li>• Custom dashboards</li>
          </ul>
        </div>
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Troubleshooting</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• Common issues</li>
            <li>• Error messages</li>
            <li>• Performance tips</li>
            <li>• Contact support</li>
          </ul>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-6">
        <h2 className="text-lg font-semibold mb-3">Contact Support</h2>
        <p className="text-sm text-base-content/70 mb-4">
          Submit a tracked support request directly into the internal admin support queue.
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => openSupportModal("normal")}>
            Submit Support Request
          </button>
          <button className="btn btn-outline" onClick={() => openSupportModal("urgent")}>
            Urgent Support Request
          </button>
        </div>
      </div>

      <Modal
        isOpen={showSupportModal}
        onClose={() => {
          if (!submitting) {
            setShowSupportModal(false);
            resetForm();
          }
        }}
        title={priority === "urgent" ? "Urgent Support Request" : "Support Request"}
        size="lg"
      >
        <form onSubmit={handleSubmitSupportRequest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Category</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                disabled={submitting}
              >
                <option value="general">General</option>
                <option value="workflow">Workflow Issue</option>
                <option value="reports">Reports / Analytics</option>
                <option value="data">Data Problem</option>
                <option value="performance">Performance</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Priority</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={priority === "urgent" ? "Urgent" : "Normal"}
                disabled
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Subject</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Describe the issue</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={5}
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="rounded-lg bg-base-200 p-4 text-sm text-base-content/70">
            This request is persisted through the internal notification system so it can be tracked by administrators.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowSupportModal(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
