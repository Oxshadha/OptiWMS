"use client";

import { useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";

const reports = [
  { 
    id: 1,
    name: "Daily Inbound", 
    desc: "Receipts, putaway, QC", 
    size: "180 KB",
    type: "Inbound",
    lastGenerated: "2025-12-15 10:30 AM",
    icon: "download"
  },
  { 
    id: 2,
    name: "Daily Outbound", 
    desc: "Orders, picks, shipments", 
    size: "220 KB",
    type: "Outbound",
    lastGenerated: "2025-12-15 11:15 AM",
    icon: "upload"
  },
  { 
    id: 3,
    name: "Inventory Snapshot", 
    desc: "Stock by location and SKU", 
    size: "310 KB",
    type: "Inventory",
    lastGenerated: "2025-12-15 09:00 AM",
    icon: "inventory"
  },
  { 
    id: 4,
    name: "Sales Report", 
    desc: "Revenue, orders, customers", 
    size: "450 KB",
    type: "Sales",
    lastGenerated: "2025-12-14 05:00 PM",
    icon: "payments"
  },
  { 
    id: 5,
    name: "Warehouse Utilization", 
    desc: "Space usage and efficiency", 
    size: "125 KB",
    type: "Analytics",
    lastGenerated: "2025-12-15 08:00 AM",
    icon: "warehouse"
  },
  { 
    id: 6,
    name: "Customer Activity", 
    desc: "Orders, returns, engagement", 
    size: "280 KB",
    type: "Customer",
    lastGenerated: "2025-12-14 04:30 PM",
    icon: "group"
  },
];

const reportTypes = ["All", "Inbound", "Outbound", "Inventory", "Sales", "Analytics", "Customer"];

export default function ReportsPage() {
  const [activeType, setActiveType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<typeof reports[0] | null>(null);

  const filteredReports = reports.filter(r => {
    const query = searchQuery.trim().toLowerCase();
    const matchesType = activeType === "All" || r.type === activeType;
    const matchesSearch = !query || (
      r.name.toLowerCase().includes(query) ||
      r.desc.toLowerCase().includes(query) ||
      r.type.toLowerCase().includes(query) ||
      r.size.toLowerCase().includes(query) ||
      r.lastGenerated.toLowerCase().includes(query) ||
      r.icon.toLowerCase().includes(query)
    );
    return matchesType && matchesSearch;
  });

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
        {filteredReports.map((r) => (
          <div 
            key={r.id} 
            className="card bg-base-100 border border-base-300 rounded-xl p-6 hover:border-primary transition-colors cursor-pointer"
            onClick={() => {
              setSelectedReport(r);
              setShowDetailModal(true);
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">{r.icon}</span>
              </div>
              <span 
                className="badge text-xs whitespace-nowrap" 
                style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
              >
                {r.type}
              </span>
            </div>
            <h3 className="text-lg font-bold text-base-content mb-2">{r.name}</h3>
            <p className="text-sm text-base-content/60 mb-4">{r.desc}</p>
            <div className="flex items-center justify-between pt-4 border-t border-base-200">
              <div className="text-xs text-base-content/50">
                <div>Size: {r.size}</div>
                <div>Last: {r.lastGenerated}</div>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Download report - replace with actual API call
                    console.log("Download report:", r.id);
                    // Simulate download
                    const link = document.createElement('a');
                    link.href = '#'; // Replace with actual report URL
                    link.download = `${r.name.replace(/\s+/g, '_')}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    alert(`Downloading ${r.name}...`);
                  }}
                >
                  <span className="material-symbols-outlined">download</span>
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
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
        />
      )}

      {/* Schedule Report Modal */}
      <ScheduleReportModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
      />

      {/* Create Custom Report Modal */}
      <CreateCustomReportModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}

// Report Detail Modal
function ReportDetailModal({
  isOpen,
  onClose,
  report,
}: {
  isOpen: boolean;
  onClose: () => void;
  report: typeof reports[0];
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Report: ${report.name}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Report Name</label>
            <p className="font-semibold">{report.name}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p>
              <span 
                className="badge text-xs whitespace-nowrap" 
                style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
              >
                {report.type}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Description</label>
            <p className="font-semibold">{report.desc}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Size</label>
            <p className="font-semibold">{report.size}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Last Generated</label>
            <p className="font-semibold">{report.lastGenerated}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => {
              // TODO: Download report - replace with actual API call
              console.log("Download report:", report.id);
              const link = document.createElement('a');
              link.href = '#'; // Replace with actual report URL
              link.download = `${report.name.replace(/\s+/g, '_')}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              alert(`Downloading ${report.name}...`);
            }}
          >
            <span className="material-symbols-outlined">download</span>
            Download Report
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

// Schedule Report Modal
function ScheduleReportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    reportType: "",
    frequency: "daily",
    time: "09:00",
    email: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to schedule report
    console.log("Scheduling report:", formData);
    alert("Report scheduled successfully!");
    onClose();
    setFormData({
      reportType: "",
      frequency: "daily",
      time: "09:00",
      email: "",
    });
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
            <option value="Daily Inbound">Daily Inbound</option>
            <option value="Daily Outbound">Daily Outbound</option>
            <option value="Inventory Snapshot">Inventory Snapshot</option>
            <option value="Sales Report">Sales Report</option>
            <option value="Warehouse Utilization">Warehouse Utilization</option>
            <option value="Customer Activity">Customer Activity</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Frequency *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
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
          </label>
          <input
            type="email"
            className="input input-bordered w-full"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@example.com"
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Schedule Report
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Custom Report Modal
function CreateCustomReportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    fields: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create custom report
    console.log("Creating custom report:", formData);
    alert("Custom report created successfully!");
    onClose();
    setFormData({
      name: "",
      description: "",
      type: "",
      fields: [],
    });
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
            <option value="Inbound">Inbound</option>
            <option value="Outbound">Outbound</option>
            <option value="Inventory">Inventory</option>
            <option value="Sales">Sales</option>
            <option value="Analytics">Analytics</option>
            <option value="Customer">Customer</option>
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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Report
          </button>
        </div>
      </form>
    </Modal>
  );
}
