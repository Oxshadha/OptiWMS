"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { anomaliesApi } from "@/lib/api/anomalies";
import { warehousesApi } from "@/lib/api/warehouses";
import { materialsApi } from "@/lib/api/materials";
import { usersApi } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "investigating" | "resolved" | "false_positive";
type Domain = "cycle_count" | "picking" | "other";

interface AnomalyDisplay {
  id: string;
  anomalyId: string;
  anomalyType: string;
  anomalyTypeLabel: string;
  domain: Domain;
  severity: Severity;
  description: string;
  warehouseName: string;
  relatedEntityType: string;
  relatedEntityId: string;
  detectedBy: "system" | "worker" | "manager";
  detectedAt: string;
  status: Status;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

const severityConfig: Record<Severity, { label: string; tone: StatusTone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "High", tone: "danger" },
  critical: { label: "Critical", tone: "danger" },
};

const statusConfig: Record<Status, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "danger" },
  investigating: { label: "Investigating", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  false_positive: { label: "False Positive", tone: "neutral" },
};

const detectedByConfig: Record<AnomalyDisplay["detectedBy"], { label: string; icon: string }> = {
  system: { label: "System", icon: "computer" },
  worker: { label: "Worker", icon: "person" },
  manager: { label: "Manager", icon: "admin_panel_settings" },
};

const normalizeType = (type?: string): string => (type || "UNKNOWN").toUpperCase();

const getAnomalyDomain = (type: string): Domain => {
  const normalized = normalizeType(type);
  if (normalized.includes("CYCLE_COUNT")) return "cycle_count";
  if (normalized.includes("PICKING")) return "picking";
  return "other";
};

const getTypeLabel = (type: string): string => type.toLowerCase().replace(/_/g, " ");

const toSeverity = (severity?: string): Severity => {
  const normalized = (severity || "").toUpperCase();
  if (normalized === "CRITICAL") return "critical";
  if (normalized === "HIGH") return "high";
  if (normalized === "MEDIUM") return "medium";
  return "low";
};

const toDisplayStatus = (status?: string): Status => {
  const normalized = (status || "").toUpperCase();
  if (normalized === "REVIEWED" || normalized === "INVESTIGATING") return "investigating";
  if (normalized === "RESOLVED") return "resolved";
  if (normalized === "FALSE_POSITIVE") return "false_positive";
  return "open";
};

const toApiStatus = (status: Status): string => {
  if (status === "open") return "DETECTED";
  if (status === "investigating") return "REVIEWED";
  if (status === "resolved") return "RESOLVED";
  return "FALSE_POSITIVE";
};

const formatDate = (value?: string | null): string => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toISOString().slice(0, 10);
};

export default function AnomaliesPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const canEdit = hasPermission(ADMIN_ROUTES.ANOMALIES, "edit");

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyDisplay | null>(null);
  const [targetStatus, setTargetStatus] = useState<Status>("resolved");

  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [domainFilter, setDomainFilter] = useState<"all" | Domain>("all");

  const [anomalies, setAnomalies] = useState<AnomalyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [anomaliesData, warehousesData, materialsData, usersData] = await Promise.all([
        anomaliesApi.getAll(),
        warehousesApi.getAll(),
        materialsApi.getAll(),
        usersApi.getAll(),
      ]);

      const warehousesMap = new Map<string, string>();
      warehousesData.forEach((wh) => warehousesMap.set(wh.id, wh.name));

      const materialsMap = new Map<string, string>();
      materialsData.forEach((m) => materialsMap.set(m.id, m.materialCode || m.description || m.id));

      const usersMap = new Map<string, string>();
      usersData.forEach((u) => {
        const displayName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || u.email || "Unknown";
        usersMap.set(u.id, displayName);
      });

      const displayAnomalies: AnomalyDisplay[] = anomaliesData.map((a) => {
        const domain = getAnomalyDomain(a.anomalyType);
        const warehouseName = a.warehouseId ? warehousesMap.get(a.warehouseId) || "Unknown" : "Unknown";
        const relatedEntityId = a.materialId ? materialsMap.get(a.materialId) || a.materialId : (a.locationId || "N/A");
        const detectedBy: AnomalyDisplay["detectedBy"] = domain === "picking" ? "worker" : "system";

        return {
          id: a.id,
          anomalyId: `ANOM-${a.id.substring(0, 8).toUpperCase()}`,
          anomalyType: normalizeType(a.anomalyType),
          anomalyTypeLabel: getTypeLabel(normalizeType(a.anomalyType)),
          domain,
          severity: toSeverity(a.severity),
          description: a.description || "No description",
          warehouseName,
          relatedEntityType: a.materialId ? "material" : (a.locationId ? "location" : "unknown"),
          relatedEntityId,
          detectedBy,
          detectedAt: a.createdAt || a.reviewedAt || "",
          status: toDisplayStatus(a.status),
          resolvedBy: a.reviewedBy ? usersMap.get(a.reviewedBy) || "Manager" : null,
          resolvedAt: a.reviewedAt || null,
        };
      });

      setAnomalies(displayAnomalies);
    } catch (err) {
      logger.error("Failed to load anomalies:", err);
      setError(err instanceof Error ? err.message : "Failed to load anomalies");
      setAnomalies([]);
      if (err instanceof Error && !err.message.includes("Not authenticated")) {
        showToast.error("Failed to load anomalies. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const anomaliesForWarehouse = isWarehouseManager && assignedWarehouseName
    ? anomalies.filter((a) => a.warehouseName === assignedWarehouseName)
    : anomalies;

  const summary = {
    totalAnomalies: anomaliesForWarehouse.length,
    cycleCount: anomaliesForWarehouse.filter((a) => a.domain === "cycle_count").length,
    picking: anomaliesForWarehouse.filter((a) => a.domain === "picking").length,
    open: anomaliesForWarehouse.filter((a) => a.status === "open" || a.status === "investigating").length,
  };

  const filteredAnomalies = anomaliesForWarehouse.filter((anomaly) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      anomaly.anomalyId.toLowerCase().includes(query) ||
      anomaly.description.toLowerCase().includes(query) ||
      anomaly.anomalyTypeLabel.toLowerCase().includes(query) ||
      anomaly.severity.toLowerCase().includes(query) ||
      anomaly.warehouseName.toLowerCase().includes(query) ||
      anomaly.relatedEntityType.toLowerCase().includes(query) ||
      anomaly.relatedEntityId.toLowerCase().includes(query) ||
      anomaly.status.toLowerCase().includes(query)
    );
    const matchesSeverity = severityFilter === "all" || anomaly.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || anomaly.status === statusFilter;
    const matchesDomain = domainFilter === "all" || anomaly.domain === domainFilter;
    return matchesSearch && matchesSeverity && matchesStatus && matchesDomain;
  });

  const handleStatusUpdate = async (anomaly: AnomalyDisplay, nextStatus: Status, notes: string) => {
    try {
      await anomaliesApi.resolve(anomaly.id, toApiStatus(nextStatus), admin?.id, notes);
      showToast.success(`Anomaly marked as ${statusConfig[nextStatus].label}`);
      await loadData();
    } catch (err) {
      logger.error("Failed to update anomaly status:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update anomaly status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && anomalies.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading anomalies: {error}</span>
      </div>
    );
  }

  const summaryCards = [
    { label: "Total Anomalies", value: summary.totalAnomalies, icon: "warning", color: "primary" as const },
    { label: "Cycle Count", value: summary.cycleCount, icon: "inventory_2", color: "warning" as const },
    { label: "Picking", value: summary.picking, icon: "shopping_cart", color: "error" as const },
    { label: "Open/Investigating", value: summary.open, icon: "schedule", color: "success" as const },
  ];

  const columns = [
    {
      key: "anomalyId",
      label: "Anomaly ID",
      render: (anomaly: AnomalyDisplay) => (
        <Link href={`/admin/anomalies/${anomaly.id}`} className="font-semibold text-primary hover:underline">
          {anomaly.anomalyId}
        </Link>
      ),
      sortable: true,
    },
    {
      key: "domain",
      label: "Domain",
      render: (anomaly: AnomalyDisplay) => (
        <StatusChip
          label={anomaly.domain === "cycle_count" ? "Cycle Count" : anomaly.domain === "picking" ? "Picking" : "Other"}
          tone="neutral"
        />
      ),
      sortable: true,
    },
    {
      key: "anomalyType",
      label: "Type",
      render: (anomaly: AnomalyDisplay) => (
        <StatusChip label={anomaly.anomalyTypeLabel} tone="neutral" className="capitalize" />
      ),
      sortable: true,
    },
    {
      key: "severity",
      label: "Severity",
      render: (anomaly: AnomalyDisplay) => {
        const severity = severityConfig[anomaly.severity];
        return <StatusChip label={severity.label} tone={severity.tone} showDot />;
      },
      sortable: true,
    },
    { key: "description", label: "Description", className: "max-w-md" },
    { key: "warehouseName", label: "Warehouse", sortable: true },
    {
      key: "relatedEntity",
      label: "Related Entity",
      render: (anomaly: AnomalyDisplay) => (
        <div className="text-sm">
          <div className="capitalize">{anomaly.relatedEntityType}</div>
          <div className="text-base-content/60">{anomaly.relatedEntityId}</div>
        </div>
      ),
    },
    {
      key: "detectedBy",
      label: "Detected By",
      render: (anomaly: AnomalyDisplay) => {
        const detector = detectedByConfig[anomaly.detectedBy];
        return (
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">{detector.icon}</span>
            <span className="text-xs">{detector.label}</span>
          </div>
        );
      },
      sortable: true,
    },
    {
      key: "detectedAt",
      label: "Detected At",
      render: (anomaly: AnomalyDisplay) => formatDate(anomaly.detectedAt),
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (anomaly: AnomalyDisplay) => {
        const status = statusConfig[anomaly.status];
        return <StatusChip label={status.label} tone={status.tone} showDot />;
      },
      sortable: true,
    },
  ];

  const renderActions = (anomaly: AnomalyDisplay) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-56 border border-base-300 z-10">
        <li>
          <Link href={`/admin/anomalies/${anomaly.id}`}>
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </Link>
        </li>
        {anomaly.status === "open" && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedAnomaly(anomaly);
                setTargetStatus("investigating");
                setShowResolveModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">manage_search</span>
              Mark as Investigating
            </button>
          </li>
        )}
        {(anomaly.status === "open" || anomaly.status === "investigating") && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedAnomaly(anomaly);
                setTargetStatus("resolved");
                setShowResolveModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Mark as Resolved
            </button>
          </li>
        )}
        {(anomaly.status === "open" || anomaly.status === "investigating") && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedAnomaly(anomaly);
                setTargetStatus("false_positive");
                setShowResolveModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">rule</span>
              Mark as False Positive
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Anomalies</h1>
          <p className="text-sm text-base-content/60 mt-1">Monitor cycle-count and operational anomalies</p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search anomalies..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-72 border border-base-300 z-10">
              <li className="menu-title">Domain</li>
              <li><button onClick={() => setDomainFilter("all")}>All Domains</button></li>
              <li><button onClick={() => setDomainFilter("cycle_count")}>Cycle Count</button></li>
              <li><button onClick={() => setDomainFilter("picking")}>Picking</button></li>
              <li><button onClick={() => setDomainFilter("other")}>Other</button></li>

              <li className="menu-title mt-2">Severity</li>
              <li><button onClick={() => setSeverityFilter("all")}>All Severity</button></li>
              <li><button onClick={() => setSeverityFilter("critical")}>Critical</button></li>
              <li><button onClick={() => setSeverityFilter("high")}>High</button></li>
              <li><button onClick={() => setSeverityFilter("medium")}>Medium</button></li>
              <li><button onClick={() => setSeverityFilter("low")}>Low</button></li>

              <li className="menu-title mt-2">Status</li>
              <li><button onClick={() => setStatusFilter("all")}>All Status</button></li>
              <li><button onClick={() => setStatusFilter("open")}>Open</button></li>
              <li><button onClick={() => setStatusFilter("investigating")}>Investigating</button></li>
              <li><button onClick={() => setStatusFilter("resolved")}>Resolved</button></li>
              <li><button onClick={() => setStatusFilter("false_positive")}>False Positive</button></li>
            </ul>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => void loadData()}>
            <span className="material-symbols-outlined">refresh</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="overflow-hidden">
        <DataTable
          data={filteredAnomalies}
          columns={columns}
          keyExtractor={(anomaly) => anomaly.id}
          onRowClick={(anomaly) => {
            setSelectedAnomaly(anomaly);
            setTargetStatus("resolved");
            setShowResolveModal(true);
          }}
          actions={renderActions}
          emptyMessage="No anomalies found"
          className="overflow-hidden"
        />
      </div>

      {selectedAnomaly && (
        <ResolveAnomalyModal
          isOpen={showResolveModal}
          onClose={() => {
            setShowResolveModal(false);
            setSelectedAnomaly(null);
          }}
          onResolved={async (notes) => {
            await handleStatusUpdate(selectedAnomaly, targetStatus, notes);
          }}
          anomaly={selectedAnomaly}
          targetStatus={targetStatus}
        />
      )}
    </div>
  );
}

function ResolveAnomalyModal({
  isOpen,
  onClose,
  onResolved,
  anomaly,
  targetStatus,
}: {
  isOpen: boolean;
  onClose: () => void;
  onResolved: (notes: string) => Promise<void>;
  anomaly: AnomalyDisplay;
  targetStatus: Status;
}) {
  const [formData, setFormData] = useState({
    resolutionNotes: "",
    actionsTaken: "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const notes = `${formData.actionsTaken}\n\nResolution Notes: ${formData.resolutionNotes}`.trim();
    await onResolved(notes);
    onClose();
    setFormData({ resolutionNotes: "", actionsTaken: "" });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={statusConfig[targetStatus].label} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card bg-base-200 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-base-content/60">Anomaly ID:</span>
            <span className="font-semibold">{anomaly.anomalyId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Domain:</span>
            <span className="capitalize">{anomaly.domain.replace("_", " ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Type:</span>
            <span className="capitalize">{anomaly.anomalyTypeLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Severity:</span>
            <span className={`badge ${severityConfig[anomaly.severity].class}`}>{severityConfig[anomaly.severity].label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Description:</span>
            <span className="text-right max-w-xs">{anomaly.description}</span>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Resolution Notes *</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={4}
            value={formData.resolutionNotes}
            onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
            placeholder="Describe the decision and outcome..."
            required
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Actions Taken</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.actionsTaken}
            onChange={(e) => setFormData({ ...formData, actionsTaken: e.target.value })}
            placeholder="What actions were taken?"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
