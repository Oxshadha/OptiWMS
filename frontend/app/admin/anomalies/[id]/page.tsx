"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";

// Mock data - will be replaced with API calls
const anomalies = [
  {
    id: "anom-1",
    anomalyId: "ANOM-2025-001",
    anomalyType: "quantity_mismatch",
    severity: "high",
    description: "Inventory count discrepancy: Expected 50, Found 45 at location A1",
    warehouseName: "Warehouse 1",
    relatedEntityType: "product",
    relatedEntityId: "SKU-1001",
    detectedBy: "ai_service",
    detectedAt: "2025-12-15 10:30",
    status: "open",
    resolvedBy: null,
    resolvedAt: null,
    details: {
      location: "A-01-01",
      expectedQuantity: 50,
      actualQuantity: 45,
      difference: -5,
      productName: "Wireless Earbuds",
      sku: "SKU-1001",
    },
  },
  {
    id: "anom-2",
    anomalyId: "ANOM-2025-002",
    anomalyType: "location_error",
    severity: "medium",
    description: "Item scanned at wrong location during picking task",
    warehouseName: "Warehouse 1",
    relatedEntityType: "task",
    relatedEntityId: "TASK-452368",
    detectedBy: "system",
    detectedAt: "2025-12-15 09:15",
    status: "investigating",
    resolvedBy: null,
    resolvedAt: null,
    details: {
      taskNumber: "TASK-452368",
      expectedLocation: "A-01-01",
      scannedLocation: "A-01-02",
      workerName: "John Doe",
    },
  },
];

const severityConfig = {
  low: { label: "Low", class: "badge-outline" },
  medium: { label: "Medium", class: "badge-warning" },
  high: { label: "High", class: "badge-error" },
  critical: { label: "Critical", class: "badge-error" },
};

const statusConfig = {
  open: { label: "Open", class: "badge-error" },
  investigating: { label: "Investigating", class: "badge-warning" },
  resolved: { label: "Resolved", class: "badge-success" },
  false_positive: { label: "False Positive", class: "badge-outline" },
};

const detectedByConfig = {
  system: { label: "System", icon: "computer" },
  ai_service: { label: "AI Service", icon: "psychology" },
  worker: { label: "Worker", icon: "person" },
  manager: { label: "Manager", icon: "admin_panel_settings" },
};

export default function AnomalyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAdmin();
  const anomalyId = params.id as string;
  const anomaly = anomalies.find((a) => a.id === anomalyId);
  const canEdit = hasPermission(ADMIN_ROUTES.ANOMALIES, "edit");

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  if (!anomaly) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Anomaly not found</span>
          <Link href="/admin/anomalies" className="btn btn-sm">
            Back to Anomalies
          </Link>
        </div>
      </div>
    );
  }

  const severity = severityConfig[anomaly.severity as keyof typeof severityConfig];
  const status = statusConfig[anomaly.status as keyof typeof statusConfig];
  const detector = detectedByConfig[anomaly.detectedBy as keyof typeof detectedByConfig];

  const handleResolve = () => {
    // TODO: API call to resolve anomaly
    console.log("Resolving anomaly:", anomalyId, resolutionNotes);
    alert("Anomaly resolved successfully!");
    router.push("/admin/anomalies");
  };

  const handleMarkInvestigating = () => {
    // TODO: API call to mark as investigating
    console.log("Marking anomaly as investigating:", anomalyId);
    alert("Anomaly marked as investigating!");
    router.push("/admin/anomalies");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/anomalies" className="text-primary hover:underline mb-2 inline-block">
            ← Back to Anomalies
          </Link>
          <h1 className="text-3xl font-bold text-base-content">{anomaly.anomalyId}</h1>
          <p className="text-sm text-base-content/60 mt-1">Anomaly Details</p>
        </div>
        {canEdit && (
          <div className="flex gap-3">
            {anomaly.status === "open" && (
              <button className="btn btn-warning" onClick={handleMarkInvestigating}>
                <span className="material-symbols-outlined">check</span>
                Mark as Investigating
              </button>
            )}
            {anomaly.status === "investigating" && (
              <button className="btn btn-primary" onClick={() => setShowResolveModal(true)}>
                <span className="material-symbols-outlined">check_circle</span>
                Resolve Anomaly
              </button>
            )}
          </div>
        )}
      </div>

      {/* Anomaly Information */}
      <div className="card bg-base-100 border border-base-300 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-base-content/60">Anomaly ID</label>
            <p className="font-semibold text-lg">{anomaly.anomalyId}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p className="font-semibold capitalize">{anomaly.anomalyType.replace("_", " ")}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Severity</label>
            <p>
              <span className={`badge ${severity.class}`}>{severity.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${status.class}`}>{status.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{anomaly.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Detected By</label>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">{detector.icon}</span>
              <span>{detector.label}</span>
            </div>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Detected At</label>
            <p className="font-semibold">{anomaly.detectedAt}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Related Entity</label>
            <div>
              <span className="capitalize">{anomaly.relatedEntityType}</span>
              <Link
                href={`/admin/${anomaly.relatedEntityType === "product" ? "products" : anomaly.relatedEntityType === "task" ? "tasks" : "workers"}?search=${anomaly.relatedEntityId}`}
                className="ml-2 text-primary hover:underline"
              >
                {anomaly.relatedEntityId}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-base-300">
          <label className="text-sm text-base-content/60">Description</label>
          <p className="mt-2">{anomaly.description}</p>
        </div>

        {/* Anomaly Details */}
        {anomaly.details && (
          <div className="mt-6 pt-6 border-t border-base-300">
            <h3 className="font-semibold mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(anomaly.details).map(([key, value]) => (
                <div key={key}>
                  <label className="text-sm text-base-content/60 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                  <p className="font-semibold">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {anomaly.resolvedBy && (
          <div className="mt-6 pt-6 border-t border-base-300">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Resolved By</label>
                <p className="font-semibold">{anomaly.resolvedBy}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Resolved At</label>
                <p className="font-semibold">{anomaly.resolvedAt}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => {
          setShowResolveModal(false);
          setResolutionNotes("");
        }}
        title="Resolve Anomaly"
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Resolution Notes *</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={4}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Enter resolution details..."
              required
            />
          </div>
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Mark as False Positive</span>
              <input type="checkbox" className="checkbox" />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowResolveModal(false);
                setResolutionNotes("");
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleResolve}>
              Resolve Anomaly
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

