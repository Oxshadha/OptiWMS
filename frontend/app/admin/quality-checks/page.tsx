"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";

// Mock data - will be replaced with API calls
const qualityChecks = [
  {
    id: "qc-1",
    checkId: "QC-2025-001",
    inboundOrderNumber: "PO-452368",
    productName: "Wireless Earbuds",
    sku: "SKU-1001",
    quantityChecked: 50,
    quantityPassed: 48,
    quantityFailed: 2,
    result: "partial",
    checkedByName: "John Doe",
    checkDate: "2025-12-15 10:30",
    approvedByName: null,
    approvalDate: null,
  },
  {
    id: "qc-2",
    checkId: "QC-2025-002",
    inboundOrderNumber: "PO-452369",
    productName: "Smart Projector",
    sku: "SKU-1002",
    quantityChecked: 30,
    quantityPassed: 30,
    quantityFailed: 0,
    result: "passed",
    checkedByName: "Jane Smith",
    checkDate: "2025-12-15 11:00",
    approvedByName: "Manager A",
    approvalDate: "2025-12-15 11:15",
  },
  {
    id: "qc-3",
    checkId: "QC-2025-003",
    inboundOrderNumber: "PO-452370",
    productName: "Remote Control",
    sku: "SKU-2001",
    quantityChecked: 100,
    quantityPassed: 95,
    quantityFailed: 5,
    result: "partial",
    checkedByName: "Mike Johnson",
    checkDate: "2025-12-15 09:00",
    approvedByName: null,
    approvalDate: null,
  },
];

const resultConfig = {
  passed: { label: "Passed", class: "badge-success" },
  failed: { label: "Failed", class: "badge-error" },
  partial: { label: "Partial", class: "badge-warning" },
};

export default function QualityChecksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<typeof qualityChecks[0] | null>(null);

  const summary = {
    totalChecksThisMonth: 145,
    pendingApproval: 8,
    passRate: 92.5,
    rejectedItems: 15,
  };

  const filteredChecks = qualityChecks.filter((check) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      check.checkId.toLowerCase().includes(query) ||
      check.inboundOrderNumber.toLowerCase().includes(query) ||
      check.productName.toLowerCase().includes(query) ||
      check.sku.toLowerCase().includes(query) ||
      check.quantityChecked.toString().includes(query) ||
      check.quantityPassed.toString().includes(query) ||
      check.quantityFailed.toString().includes(query) ||
      check.result.toLowerCase().includes(query) ||
      check.checkedByName.toLowerCase().includes(query) ||
      check.checkDate.toLowerCase().includes(query) ||
      (check.approvedByName && check.approvedByName.toLowerCase().includes(query)) ||
      (check.approvalDate && check.approvalDate.toLowerCase().includes(query))
    );
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && !check.approvedByName) ||
      (statusFilter === "approved" && check.approvedByName);
    return matchesSearch && matchesStatus;
  });

  const summaryCards = [
    {
      label: "Total Checks This Month",
      value: summary.totalChecksThisMonth,
      icon: "verified",
      color: "primary" as const,
    },
    {
      label: "Pending Approval",
      value: summary.pendingApproval,
      icon: "schedule",
      color: "warning" as const,
    },
    {
      label: "Pass Rate",
      value: `${summary.passRate}%`,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Rejected Items",
      value: summary.rejectedItems,
      icon: "cancel",
      color: "error" as const,
    },
  ];

  const columns = [
    {
      key: "checkId",
      label: "Check ID",
      render: (check: typeof qualityChecks[0]) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCheck(check);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {check.checkId}
        </button>
      ),
      sortable: true,
    },
    {
      key: "inboundOrderNumber",
      label: "Inbound Order",
      render: (check: typeof qualityChecks[0]) => (
        <Link
          href={`/admin/orders/inbound/${check.inboundOrderNumber}`}
          className="text-primary hover:underline"
        >
          {check.inboundOrderNumber}
        </Link>
      ),
      sortable: true,
    },
    {
      key: "productName",
      label: "Product",
      render: (check: typeof qualityChecks[0]) => (
        <div>
          <div className="font-medium">{check.productName}</div>
          <div className="text-xs text-base-content/60">{check.sku}</div>
        </div>
      ),
    },
    {
      key: "quantityChecked",
      label: "Qty Checked",
      sortable: true,
    },
    {
      key: "quantityPassed",
      label: "Qty Passed",
      render: (check: typeof qualityChecks[0]) => (
        <span className="text-success font-semibold">{check.quantityPassed}</span>
      ),
      sortable: true,
    },
    {
      key: "quantityFailed",
      label: "Qty Failed",
      render: (check: typeof qualityChecks[0]) => (
        <span className="text-error font-semibold">{check.quantityFailed}</span>
      ),
      sortable: true,
    },
    {
      key: "result",
      label: "Result",
      render: (check: typeof qualityChecks[0]) => {
        const result = resultConfig[check.result as keyof typeof resultConfig];
        return <span className={`badge ${result.class}`}>{result.label}</span>;
      },
      sortable: true,
    },
    {
      key: "checkedByName",
      label: "Checked By",
      className: "text-base-content/70",
    },
    {
      key: "checkDate",
      label: "Check Date",
      render: (check: typeof qualityChecks[0]) => check.checkDate.split(" ")[0],
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "approvedByName",
      label: "Approved By",
      render: (check: typeof qualityChecks[0]) => check.approvedByName || "-",
      className: "text-base-content/70",
    },
  ];

  const renderActions = (check: typeof qualityChecks[0]) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <Link href={`/admin/quality-checks/${check.id}`}>
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </Link>
        </li>
        {!check.approvedByName && (
          <>
            <li>
              <button
                onClick={() => {
                  if (confirm(`Approve quality check ${check.checkId}?`)) {
                    // TODO: API call to approve quality check
                    console.log("Approving quality check:", check.id);
                  }
                }}
              >
                <span className="material-symbols-outlined text-sm">check</span>
                Approve Quality Check
              </button>
            </li>
            <li>
              <button 
                className="text-error"
                onClick={() => {
                  if (confirm(`Reject quality check ${check.checkId}?`)) {
                    // TODO: API call to reject quality check
                    console.log("Rejecting quality check:", check.id);
                  }
                }}
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Reject Quality Check
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Quality Checks</h1>
          <p className="text-sm text-base-content/60 mt-1">Review and approve quality inspection results</p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search quality checks..."
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
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setStatusFilter("all")}>All</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("pending")}>Pending Approval</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("approved")}>Approved</button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Quality Checks Table */}
      <DataTable
        data={filteredChecks}
        columns={columns}
        keyExtractor={(check) => check.id}
        onRowClick={(check) => {
          setSelectedCheck(check);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No quality checks found"
      />

      {/* Quality Check Detail Modal */}
      {selectedCheck && (
        <QualityCheckDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCheck(null);
          }}
          check={selectedCheck}
        />
      )}
    </div>
  );
}

// Quality Check Detail Modal
function QualityCheckDetailModal({
  isOpen,
  onClose,
  check,
}: {
  isOpen: boolean;
  onClose: () => void;
  check: typeof qualityChecks[0];
}) {
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
              <span className={`badge ${resultConfig[check.result as keyof typeof resultConfig].class}`}>
                {resultConfig[check.result as keyof typeof resultConfig].label}
              </span>
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
          {!check.approvedByName && (
            <button className="btn btn-primary">
              Approve Quality Check
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

