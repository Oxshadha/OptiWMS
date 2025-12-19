"use client";

import React, { useState, useEffect } from "react";
import clsx from "clsx";
import { Modal } from "@/components/Modal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";

// Type definition for sections
type SectionData = {
  label: string;
  slots: number;
  filled: number[];
};

type SectionsData = Record<string, SectionData>;

// Initial sections data for visualization (will be replaced with inventory data later)
// Different sections for different warehouses
const getInitialSectionsForWarehouse = (warehouseId: string): SectionsData => {
  // Warehouse 1 sections
  if (
    warehouseId.includes("1") ||
    warehouseId.toLowerCase().includes("warehouse 1")
  ) {
    return {
      A: { label: "A-Electronics", slots: 12, filled: [1, 2, 5, 6, 7, 12] },
      B: { label: "B-Appliances", slots: 12, filled: [1, 3, 7, 8, 9, 12] },
      C: { label: "C-Home Decor", slots: 12, filled: [2, 3, 5, 6, 7, 12] },
      D: { label: "D-Sports", slots: 12, filled: [1, 4, 5, 7, 10, 11] },
    };
  }
  // Warehouse 2 sections (different sections)
  return {
    E: { label: "E-Furniture", slots: 12, filled: [2, 3, 6, 8, 9, 11] },
    F: { label: "F-Textiles", slots: 12, filled: [1, 4, 5, 7, 10, 12] },
    G: { label: "G-Tools", slots: 12, filled: [1, 2, 5, 8, 9, 11] },
    H: { label: "H-Automotive", slots: 12, filled: [3, 4, 6, 7, 10, 12] },
  };
};

const slotNumbers = Array.from({ length: 12 }, (_, i) => i + 1);
const slotLabels: Record<string, string[]> = {
  A: slotNumbers.map((n) => `A${n}`),
  B: slotNumbers.map((n) => `B${n}`),
  C: slotNumbers.map((n) => `C${n}`),
  D: slotNumbers.map((n) => `D${n}`),
  E: slotNumbers.map((n) => `E${n}`),
  F: slotNumbers.map((n) => `F${n}`),
  G: slotNumbers.map((n) => `G${n}`),
  H: slotNumbers.map((n) => `H${n}`),
};

export default function WarehousesPage() {
  const { hasPermission, admin, role } = useAdmin();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selected, setSelected] = React.useState<Warehouse | null>(null);

  // For warehouse managers, filter to only their assigned warehouse
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const assignedWarehouseName = admin?.warehouseName;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [showEditSectionModal, setShowEditSectionModal] = useState(false);
  const [showDeleteSectionModal, setShowDeleteSectionModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [filterBy, setFilterBy] = useState<string[]>([]);
  const [warehouseIndex, setWarehouseIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Store sections per warehouse ID
  const [sectionsByWarehouse, setSectionsByWarehouse] = useState<
    Record<string, SectionsData>
  >({});

  useEffect(() => {
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first warehouse if none selected (only for non-warehouse managers)
  useEffect(() => {
    if (!isWarehouseManager && !selected && warehouses.length > 0) {
      console.log("Auto-selecting first warehouse for admin:", warehouses[0]);
      setSelected(warehouses[0]);
      setWarehouseIndex(0);
    }
  }, [warehouses, selected, isWarehouseManager]);

  // Update warehouse index when selected changes
  useEffect(() => {
    if (selected) {
      const index = warehouses.findIndex((w) => w.id === selected.id);
      if (index >= 0) {
        setWarehouseIndex(index);
      }
    }
  }, [selected, warehouses]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      let data: Warehouse[] = [];

      try {
        data = await warehousesApi.getAll();
        console.log("Loaded warehouses from API:", data.length);
        console.log("Current role:", role);
        console.log("Is warehouse manager:", isWarehouseManager);
        console.log("Warehouses data:", data);
      } catch (apiError) {
        console.error("API Error loading warehouses:", apiError);
        // If API fails, show mock warehouses for both warehouse managers and system admins
        // This handles cases where backend is not running
        if (isWarehouseManager && assignedWarehouseName) {
          // Create a mock warehouse for the assigned warehouse
          data = [
            {
              id:
                assignedWarehouseId ||
                `mock-${assignedWarehouseName
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`,
              code: assignedWarehouseName.substring(0, 3).toUpperCase(),
              name: assignedWarehouseName,
              status: "active",
            },
          ];
          console.log("Using mock warehouse for warehouse manager:", data);
        } else {
          // For system admins, show all mock warehouses (same as default seed data)
          data = [
            {
              id: "mock-wh-001",
              code: "WH-001",
              name: "Colombo Main Warehouse",
              city: "Colombo",
              country: "Sri Lanka",
              status: "active",
            },
            {
              id: "mock-wh-002",
              code: "WH-002",
              name: "Kandy Distribution Center",
              city: "Kandy",
              country: "Sri Lanka",
              status: "active",
            },
            {
              id: "mock-wh-003",
              code: "WH-003",
              name: "Galle Warehouse",
              city: "Galle",
              country: "Sri Lanka",
              status: "active",
            },
          ];
          console.log("Using mock warehouses for system admin:", data.length);
        }
      }

      // For warehouse managers, filter to only their assigned warehouse
      // System admins should see ALL warehouses (no filtering)
      if (
        isWarehouseManager &&
        (assignedWarehouseId || assignedWarehouseName) &&
        data.length > 0
      ) {
        const filteredData = data.filter((w) => {
          // Match by ID, name, or code
          const matchesId =
            assignedWarehouseId &&
            (w.id === assignedWarehouseId ||
              w.id.toLowerCase().includes(assignedWarehouseId.toLowerCase()));
          const matchesName =
            assignedWarehouseName &&
            (w.name === assignedWarehouseName ||
              w.name
                .toLowerCase()
                .includes(assignedWarehouseName.toLowerCase()) ||
              assignedWarehouseName
                .toLowerCase()
                .includes(w.name.toLowerCase()));
          const matchesCode =
            assignedWarehouseId &&
            (w.code.toLowerCase().includes(assignedWarehouseId.toLowerCase()) ||
              assignedWarehouseId.toLowerCase().includes(w.code.toLowerCase()));
          return matchesId || matchesName || matchesCode;
        });

        // If filtering results in empty array, show all warehouses (fallback)
        // This handles cases where warehouse names/IDs don't match exactly
        if (filteredData.length > 0) {
          data = filteredData;
          console.log(
            "Filtered warehouses for warehouse manager:",
            data.length
          );
        } else {
          console.warn(
            "No warehouses matched filter criteria. Showing all warehouses as fallback."
          );
          console.log("Assigned warehouse:", {
            assignedWarehouseId,
            assignedWarehouseName,
          });
          console.log(
            "Available warehouses:",
            data.map((w) => ({ id: w.id, name: w.name, code: w.code }))
          );
          // Keep all warehouses if filter doesn't match - better UX than showing nothing
        }
      } else if (role === "admin") {
        // System admins should see ALL warehouses - no filtering
        console.log("System admin - showing all warehouses:", data.length);
      }

      setWarehouses(data);

      // Initialize sections for each warehouse if not already initialized
      const updatedSections: Record<string, SectionsData> = {
        ...sectionsByWarehouse,
      };
      data.forEach((warehouse) => {
        if (!updatedSections[warehouse.id]) {
          updatedSections[warehouse.id] = getInitialSectionsForWarehouse(
            warehouse.id
          );
        }
      });
      setSectionsByWarehouse(updatedSections);

      // Auto-select assigned warehouse for warehouse managers
      if (
        isWarehouseManager &&
        (assignedWarehouseId || assignedWarehouseName) &&
        data.length > 0
      ) {
        // Try to find exact match first
        let assignedWarehouse = data.find(
          (w) =>
            w.id === assignedWarehouseId || w.name === assignedWarehouseName
        );

        // If no exact match, try partial matches
        if (!assignedWarehouse && assignedWarehouseName) {
          assignedWarehouse = data.find(
            (w) =>
              w.name
                .toLowerCase()
                .includes(assignedWarehouseName.toLowerCase()) ||
              assignedWarehouseName.toLowerCase().includes(w.name.toLowerCase())
          );
        }

        if (assignedWarehouse) {
          setSelected(assignedWarehouse);
          setWarehouseIndex(0);
        } else if (data.length > 0) {
          // Fallback to first warehouse if no match found
          setSelected(data[0]);
          setWarehouseIndex(0);
        }
      } else if (data.length > 0) {
        // For admins or if no warehouse manager assignment, select first warehouse
        console.log(
          "Selecting first warehouse for admin/non-manager:",
          data[0]
        );
        setSelected(data[0]);
        setWarehouseIndex(0);
      } else {
        console.log("No warehouses to select. Data length:", data.length);
      }
    } catch (err) {
      // Errors are handled in the inner try-catch with mock data fallback
      // This outer catch is for unexpected errors
      console.error("Unexpected error loading warehouses:", err);
      // If we get here, something unexpected happened - show empty state
      if (warehouses.length === 0) {
        setWarehouses([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWarehouse = async (
    warehouseData: Omit<Warehouse, "id">
  ) => {
    try {
      const newWarehouse = await warehousesApi.create(warehouseData);
      setWarehouses([...warehouses, newWarehouse]);

      // Initialize sections for the new warehouse
      setSectionsByWarehouse((prev) => ({
        ...prev,
        [newWarehouse.id]: getInitialSectionsForWarehouse(newWarehouse.id),
      }));

      setSelected(newWarehouse);
      setShowCreateModal(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create warehouse"
      );
      console.error("Error creating warehouse:", err);
      throw err;
    }
  };

  const canCreate = hasPermission(ADMIN_ROUTES.WAREHOUSES, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.WAREHOUSES, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.WAREHOUSES, "delete");

  // Get sections for the selected warehouse
  const currentWarehouseSections = selected
    ? sectionsByWarehouse[selected.id] ||
      getInitialSectionsForWarehouse(selected.id)
    : null;

  // Initialize sections for selected warehouse if not already initialized
  useEffect(() => {
    if (selected && !sectionsByWarehouse[selected.id]) {
      setSectionsByWarehouse((prev) => ({
        ...prev,
        [selected.id]: getInitialSectionsForWarehouse(selected.id),
      }));
    }
  }, [selected, sectionsByWarehouse]);

  // Mock data for sections (will be replaced with actual API data later)
  const sectionCards = currentWarehouseSections
    ? Object.entries(currentWarehouseSections).map(([key, val]) => {
        const typedKey = key;
        const sectionData = val as SectionData;
        return {
          key: typedKey,
          label: sectionData.label,
          slots:
            slotLabels[typedKey] || slotNumbers.map((n) => `${typedKey}${n}`),
          filledSet: new Set(sectionData.filled),
          filledCount: sectionData.filled.length,
        };
      })
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-base-content">Warehouses</h1>
        </div>
        <div className="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="font-bold">Connection Error</h3>
            <div className="text-sm">{error}</div>
            <div className="text-xs mt-2 opacity-75">
              Make sure the backend server is running on port 8080.
            </div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={loadWarehouses}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show empty state only if loading is complete and no warehouses exist
  if (!loading && warehouses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-base-content">
            Warehouses (0)
          </h1>
        </div>
        <div className="alert alert-info">
          <span>No warehouses available. Create one to get started.</span>
          {canCreate && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Create Warehouse
            </button>
          )}
        </div>
      </div>
    );
  }

  // If we have warehouses but no selection, show loading while useEffect selects one
  // This should be rare as useEffect and loadWarehouses should handle selection
  if (!selected && warehouses.length > 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Mock usage percentage (will be replaced with actual API data later)
  const usage = 65;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-base-content">
          Warehouses ({warehouses.length})
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
        {isWarehouseManager && assignedWarehouseName ? (
          <div className="flex items-center gap-3">
            <div className="badge badge-primary badge-lg px-4 py-3">
              <span className="material-symbols-outlined text-sm mr-2">
                warehouse
              </span>
              {assignedWarehouseName}
            </div>
            <span className="text-sm text-base-content/60">
              You are assigned to this warehouse
            </span>
          </div>
        ) : (
          <>
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
            <button
              className="btn btn-sm btn-ghost btn-circle"
              onClick={() => {
                if (warehouseIndex > 0) {
                  setWarehouseIndex(warehouseIndex - 1);
                  setSelected(warehouses[warehouseIndex - 1]);
                }
              }}
              disabled={warehouseIndex === 0}
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              className="btn btn-sm btn-ghost btn-circle"
              onClick={() => {
                if (warehouseIndex < warehouses.length - 1) {
                  setWarehouseIndex(warehouseIndex + 1);
                  setSelected(warehouses[warehouseIndex + 1]);
                }
              }}
              disabled={warehouseIndex >= warehouses.length - 1}
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
          </>
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
                    <button
                      className="btn btn-sm btn-ghost text-error"
                      onClick={() => setShowAddRequestModal(true)}
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
                      <span>Add Request</span>
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setSelectedSection(null);
                        setShowEditSectionModal(true);
                      }}
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      <span>Edit Section</span>
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    className="btn btn-sm btn-ghost text-error"
                    onClick={() => {
                      setSelectedSection(null);
                      setShowDeleteSectionModal(true);
                    }}
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
                    strokeDasharray={`${(usage / 100) * 352} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-base-content">
                    {usage}%
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
      </div>

      {/* Create Warehouse Modal */}
      <CreateWarehouseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateWarehouse}
      />

      {/* Add Request Modal */}
      <Modal
        isOpen={showAddRequestModal}
        onClose={() => setShowAddRequestModal(false)}
        title="Add Section Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-base-content/60">
            This feature allows you to request a new section for the warehouse.
          </p>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Section Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Enter section name"
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Reason</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              placeholder="Explain why this section is needed"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => setShowAddRequestModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                // TODO: API call to submit request
                console.log("Submitting section request");
                setShowAddRequestModal(false);
              }}
            >
              Submit Request
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Section Modal */}
      <Modal
        isOpen={showEditSectionModal}
        onClose={() => {
          setShowEditSectionModal(false);
          setSelectedSection(null);
        }}
        title="Edit Section"
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Section Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              defaultValue={selectedSection || ""}
              placeholder="Enter section name"
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Description</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              placeholder="Section description"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowEditSectionModal(false);
                setSelectedSection(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                // TODO: API call to update section
                console.log("Updating section:", selectedSection);
                setShowEditSectionModal(false);
                setSelectedSection(null);
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Section Modal */}
      <Modal
        isOpen={showDeleteSectionModal}
        onClose={() => {
          setShowDeleteSectionModal(false);
          setSelectedSection(null);
        }}
        title="Delete Section"
      >
        <div className="space-y-4">
          <div className="alert alert-warning">
            <span className="material-symbols-outlined">warning</span>
            <span>
              Are you sure you want to delete this section? This action cannot
              be undone.
            </span>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                Select Section to Delete *
              </span>
            </label>
            <select
              className="select select-bordered w-full"
              value={selectedSection || ""}
              onChange={(e) => setSelectedSection(e.target.value)}
              required
            >
              <option value="">Select a section...</option>
              {sectionCards.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.label} ({section.filledCount}/{section.slots.length}{" "}
                  filled)
                </option>
              ))}
            </select>
          </div>
          {selectedSection && (
            <div className="alert alert-info">
              <span className="material-symbols-outlined">info</span>
              <span>
                You are about to delete section "
                {sectionCards.find((s) => s.key === selectedSection)?.label}".
                This will remove all slots and inventory data for this section.
              </span>
            </div>
          )}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                Confirm Section Name
              </span>
              <span className="label-text-alt">
                Type the section name to confirm deletion
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder={
                selectedSection
                  ? sectionCards.find((s) => s.key === selectedSection)?.label
                  : "Select a section first"
              }
              disabled={!selectedSection}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowDeleteSectionModal(false);
                setSelectedSection(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-error"
              disabled={!selectedSection}
              onClick={() => {
                if (!selectedSection) {
                  alert("Please select a section to delete");
                  return;
                }
                // TODO: API call to delete section
                const sectionLabel = sectionCards.find(
                  (s) => s.key === selectedSection
                )?.label;
                console.log("Deleting section:", selectedSection, sectionLabel);

                // Remove section from current warehouse's sections only
                if (selected) {
                  const currentSections =
                    sectionsByWarehouse[selected.id] ||
                    getInitialSectionsForWarehouse(selected.id);
                  const updatedSections = { ...currentSections };
                  delete updatedSections[selectedSection];
                  setSectionsByWarehouse((prev) => ({
                    ...prev,
                    [selected.id]: updatedSections,
                  }));
                }

                alert(
                  `Section "${sectionLabel}" has been deleted successfully!`
                );
                setShowDeleteSectionModal(false);
                setSelectedSection(null);
              }}
            >
              Delete Section
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Create Warehouse Modal
function CreateWarehouseModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (warehouse: Omit<Warehouse, "id">) => Promise<void>;
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
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
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
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
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

        <div className="divider">Contact Information</div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Contact Person</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.contactPerson}
            onChange={(e) =>
              setFormData({ ...formData, contactPerson: e.target.value })
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
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
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
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "Create Warehouse"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
