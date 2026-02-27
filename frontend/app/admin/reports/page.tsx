"use client";

import { useState, useEffect, useMemo } from "react";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { StatusChip } from "@/components/StatusChip";
import { reportsApi, Report } from "@/lib/api/reports";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

const reportTypes = ["All", "inbound", "outbound", "inventory", "sales", "analytics", "customer", "audit"];
const reportTemplates = [
  { type: "inventory", name: "Inventory Snapshot", description: "Stock by location, quantity, and reorder controls." },
  { type: "inbound", name: "Inbound Operations", description: "Receiving and putaway progress for inbound orders." },
  { type: "outbound", name: "Outbound Operations", description: "Pick-pack-ship performance and shipment readiness." },
  { type: "sales", name: "Sales Fulfillment", description: "Outbound order value and delivery completion status." },
  { type: "customer", name: "Customer Service", description: "Customer order lifecycle and open-order visibility." },
  { type: "analytics", name: "WMS Analytics Summary", description: "KPI summary with chart for key warehouse metrics." },
  { type: "audit", name: "Audit and Compliance", description: "Cycle count and anomaly logs for audit evidence." },
];

// Map report types to icons
  const getReportIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    inbound: "download",
    outbound: "upload",
    inventory: "inventory",
    sales: "payments",
    analytics: "warehouse",
    customer: "group",
    audit: "fact_check",
  };
  return iconMap[type.toLowerCase()] || "description";
};

// Format file size
const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format date
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "Not generated";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const type = activeType !== "All" ? activeType : undefined;
      const data = await reportsApi.getAllReports(type);
      setReports(data);
    } catch (err) {
      logger.error("Failed to fetch reports:", err);
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeType]);

  const latestReportByType = useMemo(() => {
    const map = new Map<string, Report>();
    const sorted = [...reports].sort((a, b) => {
      const aTime = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
      const bTime = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
      return bTime - aTime;
    });
    sorted.forEach((r) => {
      if (!map.has(r.reportType.toLowerCase())) {
        map.set(r.reportType.toLowerCase(), r);
      }
    });
    return map;
  }, [reports]);

  const filteredTemplates = reportTemplates.filter((t) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesType = activeType === "All" || t.type.toLowerCase() === activeType.toLowerCase();
    const matchesSearch = !query || (
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.type.toLowerCase().includes(query)
    );
    return matchesType && matchesSearch;
  });

  const triggerBrowserDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (reportType: string, format: "pdf" | "csv") => {
    try {
      const response = await reportsApi.exportReport({ reportType, format });
      triggerBrowserDownload(response.blob, response.fileName);
      showToast.success(`${reportType} report exported as ${format.toUpperCase()}`);
      await fetchReports();
    } catch (err) {
      logger.error("Failed to export report:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to export report");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading reports: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">Reports ({reports.length})</h1>
        <div className="flex gap-3">
          <button 
            className="btn btn-sm btn-ghost"
            onClick={() => setShowScheduleModal(true)}
          >
            <span className="material-symbols-outlined">schedule</span>
            <span>Schedule Report</span>
          </button>
          <button 
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Create Custom Report</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="material-symbols-outlined text-base-content/60">search</span>
            <input
              type="text"
              className="grow"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
          {reportTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                activeType === type
                  ? "bg-neutral text-neutral-content font-medium"
                  : "text-base-content/60 hover:text-base-content"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => {
          const latest = latestReportByType.get(template.type);
          return (
          <div 
            key={template.type} 
            className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:border-primary transition-colors cursor-pointer"
            onClick={() => {
              setSelectedReport(latest || {
                id: template.type,
                reportName: template.name,
                reportType: template.type,
                description: template.description,
                reportConfig: null,
                generatedAt: null,
                fileSizeBytes: null,
                filePath: null,
                createdBy: null,
              });
              setShowDetailModal(true);
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">
                  {getReportIcon(template.type)}
                </span>
              </div>
              <StatusChip label={template.type} tone="neutral" className="capitalize" />
            </div>
            <h3 className="text-lg font-bold text-base-content mb-2">{template.name}</h3>
            <p className="text-sm text-base-content/60 mb-4">{template.description}</p>
            <div className="flex items-center justify-between pt-4 border-t border-base-200">
              <div className="text-xs text-base-content/50">
                <div>Last size: {formatFileSize(latest?.fileSizeBytes ?? null)}</div>
                <div>Last generated: {formatDate(latest?.generatedAt ?? null)}</div>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(template.type, "pdf");
                  }}
                >
                  <span className="material-symbols-outlined">download</span>
                  <span>PDF</span>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(template.type, "csv");
                  }}
                >
                  <span className="material-symbols-outlined">table_view</span>
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">description</span>
          <h3 className="text-lg font-semibold text-base-content mb-2">No reports found</h3>
          <p className="text-sm text-base-content/60">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReport(null);
          }}
          report={selectedReport}
          onDownload={handleExport}
        />
      )}

      {/* Schedule Report Modal */}
      <ScheduleReportModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onScheduled={fetchReports}
      />

      {/* Create Custom Report Modal */}
      <CreateCustomReportModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchReports}
      />
    </div>
  );
}

// Report Detail Modal
function ReportDetailModal({
  isOpen,
  onClose,
  report,
  onDownload,
}: {
  isOpen: boolean;
  onClose: () => void;
  report: Report;
  onDownload: (reportType: string, format: "pdf" | "csv") => Promise<void>;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Report: ${report.reportName}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Report Name</label>
            <p className="font-semibold">{report.reportName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p>
              <StatusChip label={report.reportType} tone="neutral" className="capitalize" />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Description</label>
            <p className="font-semibold">{report.description || "No description"}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Size</label>
            <p className="font-semibold">{formatFileSize(report.fileSizeBytes)}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Last Generated</label>
            <p className="font-semibold">{formatDate(report.generatedAt)}</p>
          </div>
          {report.filePath && (
            <div>
              <label className="text-sm text-base-content/60">File Path</label>
              <p className="font-semibold text-xs break-all">{report.filePath}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => onDownload(report.reportType, "pdf")}
          >
            <span className="material-symbols-outlined">download</span>
            Export PDF
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => onDownload(report.reportType, "csv")}
          >
            <span className="material-symbols-outlined">table_view</span>
            Export CSV
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

// Schedule Report Modal
function ScheduleReportModal({
  isOpen,
  onClose,
  onScheduled,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    reportType: "",
    frequency: "daily" as "daily" | "weekly" | "monthly",
    time: "09:00",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await reportsApi.scheduleReport({
        reportType: formData.reportType,
        frequency: formData.frequency,
        scheduledTime: `${formData.time}:00`,
        emailRecipients: formData.email.split(',').map(e => e.trim()).filter(e => e),
        isActive: true,
      });
      showToast.success("Report scheduled successfully");
      await onScheduled();
      onClose();
      setFormData({
        reportType: "",
        frequency: "daily",
        time: "09:00",
        email: "",
      });
    } catch (err) {
      logger.error("Failed to schedule report:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to schedule report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Report" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Report Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.reportType}
            onChange={(e) => setFormData({ ...formData, reportType: e.target.value })}
            required
          >
            <option value="">Select report type</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="inventory">Inventory</option>
            <option value="sales">Sales</option>
            <option value="analytics">Analytics</option>
            <option value="customer">Customer</option>
            <option value="audit">Audit</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Frequency *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.frequency}
            onChange={(e) =>
              setFormData({
                ...formData,
                frequency: e.target.value as "daily" | "weekly" | "monthly",
              })
            }
            required
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Time *</span>
          </label>
          <input
            type="time"
            className="input input-bordered w-full"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Email Recipients *</span>
            <span className="label-text-alt">Separate multiple emails with commas</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email1@example.com, email2@example.com"
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Scheduling...
              </>
            ) : (
              "Schedule Report"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Custom Report Modal
function CreateCustomReportModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    fields: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const reportConfig = JSON.stringify({
        fields: formData.fields,
      });
      await reportsApi.createCustomReport({
        reportName: formData.name,
        reportType: formData.type,
        description: formData.description || undefined,
        reportConfig: reportConfig,
      });
      showToast.success("Custom report created successfully");
      await onCreated();
      onClose();
      setFormData({
        name: "",
        description: "",
        type: "",
        fields: [],
      });
    } catch (err) {
      logger.error("Failed to create custom report:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create custom report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Custom Report" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Report Name *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe what this report contains..."
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Report Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            required
          >
            <option value="">Select type</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="inventory">Inventory</option>
            <option value="sales">Sales</option>
            <option value="analytics">Analytics</option>
            <option value="customer">Customer</option>
            <option value="audit">Audit</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Include Fields</span>
          </label>
          <div className="space-y-2">
            {["Date Range", "SKU", "Location", "Quantity", "Status", "Worker", "Customer"].map((field) => (
              <label key={field} className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={formData.fields.includes(field)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, fields: [...formData.fields, field] });
                    } else {
                      setFormData({ ...formData, fields: formData.fields.filter(f => f !== field) });
                    }
                  }}
                />
                <span className="label-text">{field}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Report"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
