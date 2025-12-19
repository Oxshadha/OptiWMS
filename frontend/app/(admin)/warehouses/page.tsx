"use client";

import React, { useState, useEffect } from "react";
import clsx from "clsx";
import { Modal } from "@/components/Modal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";

// Mock sections data for visualization (will be replaced with inventory data later)
const mockSections = {
  A: { label: "A-Electronics", slots: 12, filled: [1, 2, 5, 6, 7, 12] },
  B: { label: "B-Appliances", slots: 12, filled: [1, 3, 7, 8, 9, 12] },
  C: { label: "C-Home Decor", slots: 12, filled: [2, 3, 5, 6, 7, 12] },
  D: { label: "D-Sports", slots: 12, filled: [1, 4, 5, 7, 10, 11] },
};

const slotNumbers = Array.from({ length: 12 }, (_, i) => i + 1);
const slotLabels: Record<string, string[]> = {
  A: slotNumbers.map((n) => `A${n}`),
  B: slotNumbers.map((n) => `B${n}`),
  C: slotNumbers.map((n) => `C${n}`),
  D: slotNumbers.map((n) => `D${n}`),
};

export default function WarehousesPage() {
  const { hasPermission } = useAdmin();
  const [selected, setSelected] = React.useState(warehouseList[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWarehouses();
  }, []);

  // Auto-select first warehouse if none selected
  useEffect(() => {
    if (!selected && warehouses.length > 0) {
      setSelected(warehouses[0]);
    }
  }, [warehouses, selected]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await warehousesApi.getAll();
      setWarehouses(data);
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load warehouses");
      console.error("Error loading warehouses:", err);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = hasPermission(ADMIN_ROUTES.WAREHOUSES, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.WAREHOUSES, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.WAREHOUSES, "delete");

  const sectionCards = Object.entries(selected.sections).map(([key, val]) => {
    const typedKey = key as keyof typeof slotLabels;
    return {
      key: typedKey,
      label: val.label,
      slots: slotLabels[typedKey],
      filledSet: new Set(val.filled),
      filledCount: val.filled.length,
    };
  });

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
        <span>Error: {error}</span>
        <button className="btn btn-sm" onClick={loadWarehouses}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-base-content">
          Warehouses ({warehouseList.length})
        </h1>
        <div className="flex gap-3">
          <button className="btn btn-sm btn-ghost">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
              />
            </svg>
            <span>Sort by</span>
          </button>
          <button className="btn btn-sm btn-ghost">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>Filter by (4)</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
          {warehouses.map((w) => (
            <button
              key={w.id}
              className={clsx(
                "px-6 py-2 rounded-lg text-sm transition-all",
                w.id === selected?.id
                  ? "bg-neutral text-neutral-content font-medium"
                  : "text-base-content/60 hover:text-base-content"
              )}
              onClick={() => setSelected(w)}
            >
              {w.name}
            </button>
          ))}
        </div>
        <button className="btn btn-sm btn-ghost btn-circle">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button className="btn btn-sm btn-ghost btn-circle">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        {canCreate && (
          <button
            className="btn btn-sm bg-neutral text-neutral-content btn-circle"
            onClick={() => setShowCreateModal(true)}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card bg-base-100 border border-base-300 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-base-content">
              Section Overview ({sectionCards.length})
            </h3>
            {(canEdit || canDelete) && (
              <div className="flex gap-3">
                {canEdit && (
                  <>
                    <button className="btn btn-sm btn-ghost text-error">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span>Add Request</span>
                    </button>
                    <button className="btn btn-sm btn-ghost">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      <span>Edit Section</span>
                    </button>
                  </>
                )}
                {canDelete && (
                  <button className="btn btn-sm btn-ghost text-error">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span>Delete Section</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {sectionCards.map((section, idx) => {
              // Assign colors based on section index
              const colorClasses = [
                "bg-success text-success-content", // A - Green
                "bg-warning text-warning-content", // B - Yellow
                "bg-info text-info-content", // C - Purple/Blue
                "bg-secondary text-secondary-content", // D - Pink
              ];
              const fillColor =
                colorClasses[idx % colorClasses.length] ||
                "bg-primary text-primary-content";

              return (
                <div
                  key={section.key}
                  className="border border-base-300 rounded-xl p-4"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-base-content">
                      {section.label}
                    </span>
                    <span className="text-sm text-base-content/60">
                      {section.filledCount}/{section.slots.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {section.slots.map((slot, slotIdx) => {
                      const isFilled = section.filledSet.has(slotIdx + 1);
                      return (
                        <div
                          key={slot}
                          className={clsx(
                            "aspect-square rounded-lg text-sm font-medium flex items-center justify-center",
                            isFilled
                              ? fillColor
                              : "bg-base-200 text-base-content/50"
                          )}
                        >
                          {slot}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        <div className="space-y-6">
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-lg font-bold text-base-content mb-4">Usage</h3>
            <div className="flex justify-center mb-4">
              <div className="relative w-32 h-32">
                <svg
                  className="w-32 h-32 transform -rotate-90"
                  viewBox="0 0 128 128"
                >
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-base-300"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-primary"
                    strokeDasharray={`${(selected.usage / 100) * 352} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-base-content">
                    {selected.usage}%
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-base-content">240</div>
                <div className="text-sm text-base-content/60">
                  Total Shelves
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-base-content">136</div>
                <div className="text-sm text-base-content/60">
                  Empty Shelves
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-base-content">84</div>
                <div className="text-sm text-base-content/60">Full Shelves</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-base-content">20</div>
                <div className="text-sm text-base-content/60">Newly Added</div>
              </div>
            </div>
          </div>
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-lg font-bold text-base-content mb-4">
              Inventory Overview
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <div className="text-xs text-success mb-1">26% ↑</div>
                <div className="text-2xl font-bold text-base-content">
                  4,236
                </div>
                <div className="text-sm text-base-content/60">
                  Orders Received
                </div>
              </div>
              <div className="text-center">
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                <div className="text-xs text-error mb-1">20% ↓</div>
                <div className="text-2xl font-bold text-base-content">
                  2,778
                </div>
                <div className="text-sm text-base-content/60">
                  Orders Shipped
                </div>
              </div>
              <div className="text-center">
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="text-xs text-error mb-1">8% ↓</div>
                <div className="text-2xl font-bold text-base-content">147</div>
                <div className="text-sm text-base-content/60">
                  Orders Returned
                </div>
              </div>
              <div className="text-center">
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <div className="text-xs text-success mb-1">6% ↑</div>
                <div className="text-2xl font-bold text-base-content">537</div>
                <div className="text-sm text-base-content/60">
                  Orders Canceled
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Warehouse Modal */}
      <CreateWarehouseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateWarehouse}
      />
    </div>
  );
}

// Create Warehouse Modal
function CreateWarehouseModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    city: "",
    address: "",
    country: "Sri Lanka",
    contactPerson: "",
    email: "",
    phone: "",
    status: "active",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onCreate(formData);
      setFormData({
        code: "",
        name: "",
        city: "",
        address: "",
        country: "Sri Lanka",
        contactPerson: "",
        email: "",
        phone: "",
        status: "active",
      });
    } catch (err) {
      // Error already handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Warehouse"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">City *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Country</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Address</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Capacity (shelves)</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            value={formData.capacity}
            onChange={(e) =>
              setFormData({ ...formData, capacity: e.target.value })
            }
          />
        </div>

        <div className="divider">Warehouse Manager</div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Contact Person</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.managerName}
            onChange={(e) =>
              setFormData({ ...formData, managerName: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.managerEmail}
              onChange={(e) =>
                setFormData({ ...formData, managerEmail: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Phone</span>
            </label>
            <input
              type="tel"
              className="input input-bordered w-full"
              value={formData.managerPhone}
              onChange={(e) =>
                setFormData({ ...formData, managerPhone: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="loading loading-spinner"></span> : "Create Warehouse"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
