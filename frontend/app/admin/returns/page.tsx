"use client";

import { useState } from "react";
import clsx from "clsx";

interface ReturnItem {
  id: string;
  order: string;
  customer: string;
  item: string;
  sku: string;
  reason: string;
  qty: number;
  status:
    | "Pending Approval"
    | "Approved"
    | "Processing"
    | "Completed"
    | "Rejected";
  requestDate: string;
  approvedDate?: string;
  processedDate?: string;
}

const returns: ReturnItem[] = [
  {
    id: "RET-1001",
    order: "SO-1001",
    customer: "Acme Corp",
    item: "Wireless Earbuds",
    sku: "SKU-1001",
    reason: "Defective",
    qty: 2,
    status: "Pending Approval",
    requestDate: "2025-12-15",
  },
  {
    id: "RET-1002",
    order: "SO-1002",
    customer: "Bright Retail",
    item: "Smart Projector",
    sku: "SKU-1002",
    reason: "Customer Request",
    qty: 1,
    status: "Pending Approval",
    requestDate: "2025-12-15",
  },
  {
    id: "RET-1003",
    order: "SO-1003",
    customer: "Delta Mart",
    item: "Smart Mug",
    sku: "SKU-1003",
    reason: "Wrong Item",
    qty: 1,
    status: "Approved",
    requestDate: "2025-12-14",
    approvedDate: "2025-12-14",
  },
  {
    id: "RET-1004",
    order: "SO-1004",
    customer: "Echo Stores",
    item: "USB-C Cable",
    sku: "SKU-1004",
    reason: "Defective",
    qty: 3,
    status: "Processing",
    requestDate: "2025-12-13",
    approvedDate: "2025-12-13",
    processedDate: "2025-12-14",
  },
  {
    id: "RET-1005",
    order: "SO-1005",
    customer: "Falcon Inc",
    item: "Wireless Mouse",
    sku: "SKU-1005",
    reason: "Customer Request",
    qty: 1,
    status: "Completed",
    requestDate: "2025-12-12",
    approvedDate: "2025-12-12",
    processedDate: "2025-12-13",
  },
];

const statusClass = (s: ReturnItem["status"]) => {
  if (s === "Completed") return "badge-success";
  if (s === "Processing") return "badge-info";
  if (s === "Approved") return "badge-warning";
  if (s === "Pending Approval") return "badge-error";
  if (s === "Rejected") return "badge-outline";
  return "badge-outline";
};

const tabs = [
  "All Returns",
  "Pending Approval",
  "Approved",
  "Processing",
  "Completed",
];

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState("All Returns");
  const [returnsList, setReturnsList] = useState<ReturnItem[]>(returns);

  const filteredReturns =
    activeTab === "All Returns"
      ? returnsList
      : returnsList.filter((r) => r.status === activeTab);

  const handleApprove = (returnId: string) => {
    setReturnsList((prev) =>
      prev.map((r) =>
        r.id === returnId
          ? {
              ...r,
              status: "Approved" as const,
              approvedDate: new Date().toISOString().split("T")[0],
            }
          : r
      )
    );
  };

  const handleReject = (returnId: string) => {
    setReturnsList((prev) =>
      prev.map((r) =>
        r.id === returnId ? { ...r, status: "Rejected" as const } : r
      )
    );
  };

  const handleProcessReturn = (returnId: string) => {
    setReturnsList((prev) =>
      prev.map((r) =>
        r.id === returnId
          ? {
              ...r,
              status: "Processing" as const,
              processedDate: new Date().toISOString().split("T")[0],
            }
          : r
      )
    );
  };

  const handleRestock = (returnId: string) => {
    setReturnsList((prev) =>
      prev.map((r) =>
        r.id === returnId ? { ...r, status: "Completed" as const } : r
      )
    );
  };

  const pendingApproval = returnsList.filter(
    (r) => r.status === "Pending Approval"
  ).length;
  const approved = returnsList.filter((r) => r.status === "Approved").length;
  const processing = returnsList.filter(
    (r) => r.status === "Processing"
  ).length;
  const completed = returnsList.filter((r) => r.status === "Completed").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">
          Returns Management ({returnsList.length})
        </h1>
        <div className="flex gap-3">
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">swap_vert</span>
            <span>Sort by</span>
          </button>
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">filter_list</span>
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">
                Pending Approval
              </div>
              <div className="text-2xl font-bold text-error">
                {pendingApproval}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-error">
              pending_actions
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Approved</div>
              <div className="text-2xl font-bold text-warning">{approved}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">
              check_circle
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Processing</div>
              <div className="text-2xl font-bold text-info">{processing}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              sync
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Completed</div>
              <div className="text-2xl font-bold text-success">{completed}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">
              done_all
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-6 py-2 rounded-lg text-sm transition-all",
              activeTab === tab
                ? "bg-neutral text-neutral-content font-medium"
                : "text-base-content/60 hover:text-base-content"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Returns Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">Return ID</th>
                <th className="font-semibold text-base-content">Order ID</th>
                <th className="font-semibold text-base-content">Customer</th>
                <th className="font-semibold text-base-content">Item</th>
                <th className="font-semibold text-base-content">SKU</th>
                <th className="font-semibold text-base-content">Reason</th>
                <th className="font-semibold text-base-content">Qty</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">
                  Request Date
                </th>

                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.map((r) => (
                <tr key={r.id} className="hover:bg-base-200/50">
                  <td className="font-semibold text-primary">{r.id}</td>
                  <td className="text-base-content/70">{r.order}</td>
                  <td>{r.customer}</td>
                  <td>{r.item}</td>
                  <td className="text-base-content/70">{r.sku}</td>
                  <td className="text-base-content/70">{r.reason}</td>
                  <td>{r.qty}</td>
                  <td>
                    <span
                      className={`badge whitespace-nowrap ${statusClass(
                        r.status
                      )}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-base-content/70">{r.requestDate}</td>
                  <td className="whitespace-nowrap">
                    {" "}
                    {/* Prevents the cell from shrinking and forcing a wrap */}
                    <div className="flex items-center gap-2">
                      {" "}
                      {/* Removed flex-wrap to keep buttons in one line */}
                      {r.status === "Pending Approval" && (
                        <>
                          <button
                            onClick={() => handleApprove(r.id)}
                            className="btn btn-success btn-xs"
                            title="Approve Return"
                          >
                            <span className="material-symbols-outlined text-sm">
                              check
                            </span>
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            className="btn btn-error btn-xs"
                            title="Reject Return"
                          >
                            <span className="material-symbols-outlined text-sm">
                              close
                            </span>
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      {r.status === "Approved" && (
                        <button
                          onClick={() => handleProcessReturn(r.id)}
                          className="btn btn-primary btn-xs"
                          title="Process Return"
                        >
                          <span className="material-symbols-outlined text-sm">
                            play_arrow
                          </span>
                          <span>Process</span>
                        </button>
                      )}
                      {r.status === "Processing" && (
                        <button
                          onClick={() => handleRestock(r.id)}
                          className="btn btn-success btn-xs"
                          title="Restock Items"
                        >
                          <span className="material-symbols-outlined text-sm">
                            inventory_2
                          </span>
                          <span>Restock</span>
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-xs"
                        title="View Details"
                      >
                        <span className="material-symbols-outlined text-sm">
                          visibility
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredReturns.length === 0 && (
        <div className="card bg-base-100 border border-base-300 p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-base-content/30 mb-2">
            assignment_return
          </span>
          <p className="text-base-content/60">
            No returns found in this category.
          </p>
        </div>
      )}
    </div>
  );
}
