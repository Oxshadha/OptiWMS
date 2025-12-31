"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { anomaliesApi, Anomaly as ApiAnomaly } from "@/lib/api/anomalies";
import { warehousesApi } from "@/lib/api/warehouses";
import { materialsApi } from "@/lib/api/materials";
import { usersApi } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";
import { useAdmin } from "@/contexts/AdminContext";

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
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

// Mock data - will be replaced with API calls
const mockAnomalies: AnomalyDisplay[] = [
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
  },
  {
    id: "anom-3",
    anomalyId: "ANOM-2025-003",
    anomalyType: "expiry_alert",
    severity: "low",
    description: "Product batch expiring within 7 days",
    warehouseName: "Warehouse 2",
    relatedEntityType: "product",
    relatedEntityId: "SKU-2001",
    detectedBy: "system",
    detectedAt: "2025-12-14 14:20",
    status: "resolved",
    resolvedBy: "Manager A",
    resolvedAt: "2025-12-14 15:00",
  },
  {
    id: "anom-4",
    anomalyId: "ANOM-2025-004",
    anomalyType: "unauthorized_access",
    severity: "critical",
    description: "Worker accessed restricted location without authorization",
    warehouseName: "Warehouse 1",
    relatedEntityType: "worker",
    relatedEntityId: "worker-3",
    detectedBy: "ai_service",
    detectedAt: "2025-12-15 08:45",
    status: "open",
    resolvedBy: null,
    resolvedAt: null,
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

export default function AnomaliesPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const canEdit = hasPermission(ADMIN_ROUTES.ANOMALIES, "edit");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // API state
  const [anomalies, setAnomalies] = useState<AnomalyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [anomaliesData, warehousesData, materialsData, usersData] = await Promise.all([
          anomaliesApi.getAll(),
          warehousesApi.getAll(),
          materialsApi.getAll(),
          usersApi.getAll(),
        ]);

        // Build maps
        const warehousesMap = new Map<string, string>();
        warehousesData.forEach(wh => warehousesMap.set(wh.id, wh.name));
        
        const materialsMap = new Map<string, string>();
        materialsData.forEach(m => materialsMap.set(m.id, m.sku || m.code));
        
        const usersMap = new Map<string, string>();
        usersData.forEach(u => usersMap.set(u.id, u.name || u.email || "Unknown"));

        // Transform API data to display format
        const displayAnomalies: AnomalyDisplay[] = anomaliesData.map((a) => {
          const warehouseName = a.warehouseId ? warehousesMap.get(a.warehouseId) || "Unknown" : "Unknown";
          const relatedEntityId = a.materialId ? materialsMap.get(a.materialId) || a.materialId : (a.locationId || "N/A");
          
          // Map severity from API to display format
          let severity: "low" | "medium" | "high" | "critical" = "low";
          const apiSeverity = (a.severity || "").toUpperCase();
          if (apiSeverity === "CRITICAL") severity = "critical";
          else if (apiSeverity === "HIGH") severity = "high";
          else if (apiSeverity === "MEDIUM") severity = "medium";
          else severity = "low";

          // Map status from API to display format
          let displayStatus = a.status || "open";
          if (displayStatus === "DETECTED") displayStatus = "open";
          else if (displayStatus === "RESOLVED") displayStatus = "resolved";
          else if (displayStatus === "REVIEWED") displayStatus = "investigating";

          return {
            id: a.id,
            anomalyId: `ANOM-${a.id.substring(0, 8).toUpperCase()}`,
            anomalyType: a.anomalyType || "unknown",
            severity,
            description: a.description || "No description",
            warehouseName,
            relatedEntityType: a.materialId ? "product" : (a.locationId ? "location" : "unknown"),
            relatedEntityId,
            detectedBy: a.reviewedBy ? usersMap.get(a.reviewedBy) || "System" : "AI Service",
            detectedAt: a.reviewedAt || new Date().toISOString(),
            status: displayStatus,
            resolvedBy: a.reviewedBy ? usersMap.get(a.reviewedBy) : null,
            resolvedAt: a.reviewedAt || null,
          };
        });

        setAnomalies(displayAnomalies);
      } catch (err) {
        console.error("Failed to load anomalies:", err);
        setError(err instanceof Error ? err.message : "Failed to load anomalies");
        setAnomalies([]);
        if (err instanceof Error && !err.message.includes("Not authenticated")) {
          showToast.error("Failed to load anomalies. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadData();
  }, []);

  // Listen for reload events
  useEffect(() => {
    const handleReload = () => {
      loadData();
    };
    window.addEventListener('reloadAnomalies', handleReload);
    return () => {
      window.removeEventListener('reloadAnomalies', handleReload);
    };
  }, []);

  // Filter anomalies by warehouse for warehouse managers
  const anomaliesForWarehouse = isWarehouseManager && assignedWarehouseName
    ? anomalies.filter((a) => a.warehouseName === assignedWarehouseName)
    : anomalies;

  const summary = {
    totalAnomalies: anomaliesForWarehouse.length,
    critical: anomaliesForWarehouse.filter((a) => a.severity === "critical").length,
    open: anomaliesForWarehouse.filter((a) => a.status === "open").length,
    resolvedToday: anomaliesForWarehouse.filter((a) => a.status === "resolved").length,
  };

  const filteredAnomalies = anomaliesForWarehouse.filter((anomaly) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      anomaly.anomalyId.toLowerCase().includes(query) ||
      anomaly.description.toLowerCase().includes(query) ||
      anomaly.anomalyType.toLowerCase().includes(query) ||
      anomaly.severity.toLowerCase().includes(query) ||
      anomaly.warehouseName.toLowerCase().includes(query) ||
      anomaly.relatedEntityType.toLowerCase().includes(query) ||
      anomaly.relatedEntityId.toLowerCase().includes(query) ||
      anomaly.detectedBy.toLowerCase().includes(query) ||
      anomaly.detectedAt.toLowerCase().includes(query) ||
      anomaly.status.toLowerCase().includes(query) ||
      (anomaly.resolvedBy && anomaly.resolvedBy.toLowerCase().includes(query)) ||
      (anomaly.resolvedAt && anomaly.resolvedAt.toLowerCase().includes(query))
    );
    const matchesSeverity = severityFilter === "all" || anomaly.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || anomaly.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

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
    {
      label: "Total Anomalies",
      value: summary.totalAnomalies,
      icon: "warning",
      color: "primary" as const,
    },
    {
      label: "Critical",
      value: summary.critical,
      icon: "error",
      color: "error" as const,
    },
    {
      label: "Open",
      value: summary.open,
      icon: "schedule",
      color: "warning" as const,
    },
    {
      label: "Resolved Today",
      value: summary.resolvedToday,
      icon: "check_circle",
      color: "success" as const,
    },
  ];

  const columns = [
    {
      key: "anomalyId",
      label: "Anomaly ID",
      render: (anomaly: AnomalyDisplay) => (
        <Link
          href={`/admin/anomalies/${anomaly.id}`}
          className="font-semibold text-primary hover:underline"
        >
          {anomaly.anomalyId}
        </Link>
      ),
      sortable: true,
    },
    {
      key: "anomalyType",
      label: "Type",
      render: (anomaly: AnomalyDisplay) => (
        <span className="badge badge-outline capitalize text-xs whitespace-nowrap" style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}>
          {anomaly.anomalyType.replace("_", " ")}
        </span>
      ),
      sortable: true,
    },
    {
      key: "severity",
      label: "Severity",
      render: (anomaly: typeof anomalies[0]) => {
        const severity = severityConfig[anomaly.severity as keyof typeof severityConfig];
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (severity.class === "badge-outline") {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {severity.label}
            </span>
          );
        }
        return <span className={`badge ${severity.class}`}>{severity.label}</span>;
      },
      sortable: true,
    },
    {
      key: "description",
      label: "Description",
      className: "max-w-md",
    },
    {
      key: "warehouseName",
      label: "Warehouse",
      sortable: true,
    },
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
      render: (anomaly: typeof anomalies[0]) => {
        const detector = detectedByConfig[anomaly.detectedBy as keyof typeof detectedByConfig];
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
      render: (anomaly: typeof anomalies[0]) => anomaly.detectedAt.split(" ")[0],
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (anomaly: typeof anomalies[0]) => {
        const status = statusConfig[anomaly.status as keyof typeof statusConfig];
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (status.class === "badge-outline") {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {status.label}
            </span>
          );
        }
        return <span className={`badge text-xs whitespace-nowrap ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
  ];

  const renderActions = (anomaly: typeof anomalies[0]) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
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
                setShowResolveModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">check</span>
              Mark as Investigating
            </button>
          </li>
        )}
        {anomaly.status === "investigating" && canEdit && (
          <li>
            <button
              onClick={() => {
                setSelectedAnomaly(anomaly);
                setShowResolveModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Mark as Resolved
            </button>
          </li>
        )}
        <li>
          <button>
            <span className="material-symbols-outlined text-sm">close</span>
            Mark as False Positive
          </button>
        </li>
      </ul>
    </div>
  );

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Anomalies</h1>
          <p className="text-sm text-base-content/60 mt-1">Monitor and resolve system anomalies</p>
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
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-64 border border-base-300 z-10"
            >
              <li className="menu-title">Severity</li>
              <li>
                <button onClick={() => setSeverityFilter("all")}>All Severity</button>
              </li>
              <li>
                <button onClick={() => setSeverityFilter("critical")}>Critical</button>
              </li>
              <li>
                <button onClick={() => setSeverityFilter("high")}>High</button>
              </li>
              <li>
                <button onClick={() => setSeverityFilter("medium")}>Medium</button>
              </li>
              <li>
                <button onClick={() => setSeverityFilter("low")}>Low</button>
              </li>
              <li className="menu-title mt-2">Status</li>
              <li>
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("open")}>Open</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("investigating")}>Investigating</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("resolved")}>Resolved</button>
              </li>
            </ul>
          </div>
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">refresh</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Anomalies Table */}
      <div className="overflow-hidden">
        <DataTable
          data={filteredAnomalies}
          columns={columns}
          keyExtractor={(anomaly) => anomaly.id}
          onRowClick={(anomaly) => {
            // Open detail modal instead of navigation
            setSelectedAnomaly(anomaly);
            setShowResolveModal(true);
          }}
          actions={renderActions}
          emptyMessage="No anomalies found"
          className="overflow-hidden"
        />
      </div>

      {/* Resolve Anomaly Modal */}
      {selectedAnomaly && (
        <ResolveAnomalyModal
          isOpen={showResolveModal}
          onClose={() => {
            setShowResolveModal(false);
            setSelectedAnomaly(null);
          }}
          anomaly={selectedAnomaly}
        />
      )}
    </div>
  );
}

// Resolve Anomaly Modal
function ResolveAnomalyModal({
  isOpen,
  onClose,
  anomaly,
}: {
  isOpen: boolean;
  onClose: () => void;
  anomaly: AnomalyDisplay;
}) {
  const [formData, setFormData] = useState({
    resolutionNotes: "",
    actionsTaken: "",
  });

  const severityConfigLocal = severityConfig;

  const { admin } = useAdmin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const resolutionText = `${formData.actionsTaken}\n\nResolution Notes: ${formData.resolutionNotes}`.trim();
      await anomaliesApi.resolve(
        anomaly.id,
        "resolved",
        admin?.id,
        resolutionText
      );
      showToast.success("Anomaly resolved successfully");
      onClose();
      setFormData({ resolutionNotes: "", actionsTaken: "" });
      // Reload data - trigger reload in parent
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadAnomalies'));
      }
    } catch (err) {
      console.error("Failed to resolve anomaly:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to resolve anomaly");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resolve Anomaly" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card bg-base-200 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-base-content/60">Anomaly ID:</span>
            <span className="font-semibold">{anomaly.anomalyId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Type:</span>
            <span className="capitalize">{anomaly.anomalyType.replace("_", " ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Severity:</span>
            {(() => {
              const severity = severityConfigLocal[anomaly.severity as keyof typeof severityConfigLocal];
              if (severity.class === "badge-outline") {
                return (
                  <span 
                    className="badge text-xs whitespace-nowrap" 
                    style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                  >
                    {severity.label}
                  </span>
                );
              }
              return <span className={`badge ${severity.class}`}>{severity.label}</span>;
            })()}
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
            placeholder="Describe how this anomaly was resolved..."
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
            placeholder="What actions were taken to resolve this issue?"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Mark as Resolved
          </button>
        </div>
      </form>
    </Modal>
  );
}

