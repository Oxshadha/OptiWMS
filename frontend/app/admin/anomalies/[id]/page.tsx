"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { anomaliesApi, Anomaly } from "@/lib/api/anomalies";
import { materialsApi } from "@/lib/api/materials";
import { usersApi } from "@/lib/api/users";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";

const severityConfig: Record<string, { label: string; tone: StatusTone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "High", tone: "danger" },
  critical: { label: "Critical", tone: "danger" },
};

const statusConfig: Record<string, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "danger" },
  investigating: { label: "Investigating", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  false_positive: { label: "False Positive", tone: "neutral" },
};

interface AnomalyDisplay {
  id: string;
  anomalyId: string;
  anomalyType: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  warehouseName: string;
  relatedEntityType: string;
  relatedEntityId: string;
  detectedBy: string;
  detectedAt: string;
  status: "open" | "investigating" | "resolved" | "false_positive";
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

function mapSeverity(value?: string): "low" | "medium" | "high" | "critical" {
  const normalized = (value || "").toUpperCase();
  if (normalized === "CRITICAL") return "critical";
  if (normalized === "HIGH") return "high";
  if (normalized === "MEDIUM") return "medium";
  return "low";
}

function mapStatus(
  value?: string
): "open" | "investigating" | "resolved" | "false_positive" {
  const normalized = (value || "").toUpperCase();
  if (normalized === "RESOLVED") return "resolved";
  if (normalized === "REVIEWED") return "investigating";
  if (normalized === "FALSE_POSITIVE") return "false_positive";
  return "open";
}

function toDisplayAnomaly(
  anomaly: Anomaly,
  warehouseName?: string,
  materialCode?: string,
  reviewerName?: string
): AnomalyDisplay {
  const status = mapStatus(anomaly.status);
  return {
    id: anomaly.id,
    anomalyId: `ANOM-${anomaly.id.substring(0, 8).toUpperCase()}`,
    anomalyType: anomaly.anomalyType || "unknown",
    severity: mapSeverity(anomaly.severity),
    description: anomaly.description || "No description",
    warehouseName: warehouseName || "Unknown",
    relatedEntityType: anomaly.materialId
      ? "product"
      : anomaly.locationId
        ? "location"
        : "unknown",
    relatedEntityId: materialCode || anomaly.locationId || "N/A",
    detectedBy: reviewerName || "System",
    detectedAt: anomaly.reviewedAt
      ? new Date(anomaly.reviewedAt).toLocaleString()
      : "N/A",
    status,
    resolvedBy: status === "resolved" || status === "false_positive" ? reviewerName || "System" : null,
    resolvedAt:
      status === "resolved" || status === "false_positive"
        ? anomaly.reviewedAt
          ? new Date(anomaly.reviewedAt).toLocaleString()
          : null
        : null,
    resolutionNotes: anomaly.resolutionNotes || null,
  };
}

export default function AnomalyDetailPage() {
  const params = useParams();
  const { hasPermission, admin } = useAdmin();
  const anomalyId = params.id as string;
  const canEdit = hasPermission(ADMIN_ROUTES.ANOMALIES, "edit");

  const [anomaly, setAnomaly] = useState<AnomalyDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [markAsFalsePositive, setMarkAsFalsePositive] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiAnomaly = await anomaliesApi.getById(anomalyId);
      const [warehouse, material, reviewer] = await Promise.all([
        apiAnomaly.warehouseId
          ? warehousesApi.getById(apiAnomaly.warehouseId).catch(() => null)
          : Promise.resolve(null),
        apiAnomaly.materialId
          ? materialsApi.getById(apiAnomaly.materialId).catch(() => null)
          : Promise.resolve(null),
        apiAnomaly.reviewedBy
          ? usersApi.getById(apiAnomaly.reviewedBy).catch(() => null)
          : Promise.resolve(null),
      ]);

      const reviewerName = reviewer
        ? `${reviewer.firstName || ""} ${reviewer.lastName || ""}`.trim() ||
          reviewer.username ||
          reviewer.email ||
          "System"
        : "System";

      setAnomaly(
        toDisplayAnomaly(
          apiAnomaly,
          warehouse?.name,
          material?.materialCode,
          reviewerName
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load anomaly";
      setError(message);
      setAnomaly(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (anomalyId) {
      loadData();
    }
  }, [anomalyId]);

  const severity = useMemo(() => {
    if (!anomaly) return null;
    return severityConfig[anomaly.severity];
  }, [anomaly]);

  const status = useMemo(() => {
    if (!anomaly) return null;
    return statusConfig[anomaly.status];
  }, [anomaly]);

  const updateStatus = async (nextStatus: string, notes?: string) => {
    try {
      setActionLoading(true);
      await anomaliesApi.resolve(anomalyId, nextStatus, admin?.id, notes);
      showToast.success("Anomaly status updated");
      await loadData();
      if (nextStatus === "RESOLVED" || nextStatus === "FALSE_POSITIVE") {
        setShowResolveModal(false);
        setResolutionNotes("");
        setMarkAsFalsePositive(false);
      }
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to update anomaly status"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      showToast.warning("Please enter resolution notes");
      return;
    }
    await updateStatus(
      markAsFalsePositive ? "FALSE_POSITIVE" : "RESOLVED",
      resolutionNotes.trim()
    );
  };

  const handleMarkInvestigating = async () => {
    await updateStatus("REVIEWED");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !anomaly || !severity || !status) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>{error || "Anomaly not found"}</span>
          <Link href="/admin/anomalies" className="btn btn-sm">
            Back to Anomalies
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
            href="/admin/anomalies"
            className="text-primary hover:underline mb-2 inline-block"
          >
            ← Back to Anomalies
          </Link>
          <h1 className="text-3xl font-bold text-base-content">{anomaly.anomalyId}</h1>
          <p className="text-sm text-base-content/60 mt-1">Anomaly Details</p>
        </div>
        {canEdit && (
          <div className="flex gap-3">
            {anomaly.status === "open" && (
              <button
                className="btn btn-warning"
                onClick={handleMarkInvestigating}
                disabled={actionLoading}
              >
                <span className="material-symbols-outlined">check</span>
                Mark as Investigating
              </button>
            )}
            {anomaly.status === "investigating" && (
              <button
                className="btn btn-primary"
                onClick={() => setShowResolveModal(true)}
              >
                <span className="material-symbols-outlined">check_circle</span>
                Resolve Anomaly
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card bg-base-100 border border-base-300 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-base-content/60">Anomaly ID</label>
            <p className="font-semibold text-lg">{anomaly.anomalyId}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p className="font-semibold capitalize">
              {anomaly.anomalyType.replace("_", " ")}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Severity</label>
            <p>
              <StatusChip label={severity.label} tone={severity.tone} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip label={status.label} tone={status.tone} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{anomaly.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Detected By</label>
            <p className="font-semibold">{anomaly.detectedBy}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Detected At</label>
            <p className="font-semibold">{anomaly.detectedAt}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Related Entity</label>
            <div>
              <span className="capitalize">{anomaly.relatedEntityType}</span>
              <span className="ml-2 text-primary">{anomaly.relatedEntityId}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-base-300">
          <label className="text-sm text-base-content/60">Description</label>
          <p className="mt-2">{anomaly.description}</p>
        </div>

        {(anomaly.resolvedBy || anomaly.resolutionNotes) && (
          <div className="mt-6 pt-6 border-t border-base-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Resolved By</label>
                <p className="font-semibold">{anomaly.resolvedBy || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Resolved At</label>
                <p className="font-semibold">{anomaly.resolvedAt || "-"}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-base-content/60">Resolution Notes</label>
                <p className="font-semibold">{anomaly.resolutionNotes || "-"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showResolveModal}
        onClose={() => {
          setShowResolveModal(false);
          setResolutionNotes("");
          setMarkAsFalsePositive(false);
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
              <input
                type="checkbox"
                className="checkbox"
                checked={markAsFalsePositive}
                onChange={(e) => setMarkAsFalsePositive(e.target.checked)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowResolveModal(false);
                setResolutionNotes("");
                setMarkAsFalsePositive(false);
              }}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleResolve}
              disabled={actionLoading}
            >
              Resolve Anomaly
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
