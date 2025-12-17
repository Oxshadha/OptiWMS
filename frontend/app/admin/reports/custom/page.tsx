"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const entities = [
  "Orders",
  "Shipments",
  "Inventory",
  "Customers",
  "Tasks",
  "Receipts",
];

const formats = ["CSV", "XLSX", "PDF"];

export default function CustomReportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Replace with real API call to generate/save custom report template
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmitting(false);
    router.push("/admin/reports");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Create Custom Report
          </h1>
          <p className="text-base-content/60 text-sm mt-1">
            Define the data source, filters, and output format for a reusable
            analytics report.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/admin/reports")}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Reports</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* Left: Configuration */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">
                Report Configuration
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text font-medium">Report Name</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="e.g. Weekly Picking Performance"
                    required
                  />
                </label>

                {/* Description */}
                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text font-medium">Description</span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered min-h-[70px]"
                    placeholder="Short description of what this report is used for"
                  />
                </label>

                {/* Entity */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Data Source</span>
                  </div>
                  <select className="select select-bordered" required>
                    <option value="">Choose entity</option>
                    {entities.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Format */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Format</span>
                  </div>
                  <select className="select select-bordered" required>
                    {formats.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Date range */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Date Range (from)
                    </span>
                  </div>
                  <input
                    type="date"
                    className="input input-bordered"
                    required
                  />
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Date Range (to)
                    </span>
                  </div>
                  <input
                    type="date"
                    className="input input-bordered"
                    required
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Filters & fields (placeholder logic) */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base-content">
                  Filters & Fields
                </h2>
                <button type="button" className="btn btn-sm btn-outline">
                  <span className="material-symbols-outlined text-sm">
                    tune
                  </span>
                  <span>Manage Fields</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Filter by Status
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder='e.g. "Completed", "Pending"'
                  />
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Filter by Location
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Warehouse, zone, or site"
                  />
                </label>

                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text font-medium">
                      Columns (comma-separated)
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="e.g. orderId, customerName, status, total"
                  />
                </label>
              </div>

              <div className="alert alert-info bg-info/5 border border-info/40 text-info">
                <span className="material-symbols-outlined">info</span>
                <span>
                  This is a UI-only builder. When your reporting API is ready,
                  wire these fields into your backend query builder.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Scheduling & review */}
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">
                Schedule & Delivery
              </h2>

              <div className="space-y-3 text-sm">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Schedule</span>
                  </div>
                  <select className="select select-bordered">
                    <option>Run on demand</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Email Recipients
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="user@company.com, ops@company.com"
                  />
                </label>
              </div>

              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Output Format</span>
                  <span className="font-medium">CSV (default)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Estimated Size</span>
                  <span className="font-medium">~200 KB</span>
                </div>
                <div className="flex justify-between border-t border-base-300 pt-2 mt-2">
                  <span className="font-semibold">Access</span>
                  <span className="font-semibold text-primary">Admin only</span>
                </div>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    required
                  />
                  <span className="label-text text-sm text-base-content/70">
                    I confirm this report configuration is correct.
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <span className="loading loading-spinner loading-sm" />
                  )}
                  <span>
                    {isSubmitting
                      ? "Saving Custom Report..."
                      : "Save Custom Report"}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => router.push("/admin/reports")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
