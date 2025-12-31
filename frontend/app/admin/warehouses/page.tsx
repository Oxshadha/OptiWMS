"use client";

import { useState, useEffect } from "react";
import { WarehouseLayoutVisualization } from "@/components/WarehouseLayout";
import { RackElevationView } from "@/components/RackElevationView";
import { RackEditModal } from "@/components/RackEditModal";
import { getWarehouseLayout } from "@/lib/utils/warehouse-layout-generator";
import { convertLocationHierarchyToLayout, convertLocationsToLayout } from "@/lib/utils/location-to-layout";
import { RackUnit, LocationBin, WarehouseLayout } from "@/lib/types/warehouse-layout";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { locationsApi, Location } from "@/lib/api/locations";
import { useAdmin } from "@/contexts/AdminContext";
import { LocationCreateModal } from "@/components/LocationCreateModal";
import { LocationEditModal } from "@/components/LocationEditModal";

export default function WarehousesPage() {
  const { admin, role } = useAdmin();
  const isSystemAdmin = role === "admin";
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const assignedWarehouseId = admin?.warehouseId;

  const [selectedRack, setSelectedRack] = useState<RackUnit | null>(null);
  const [selectedBin, setSelectedBin] = useState<LocationBin | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    null
  );
  const [layout, setLayout] = useState<WarehouseLayout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRack, setEditingRack] = useState<RackUnit | null>(null);
  const [showCreateLocationModal, setShowCreateLocationModal] = useState(false);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showVelocity, setShowVelocity] = useState(false);

  // Load warehouses on mount
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await warehousesApi.getAll();
        setWarehouses(data);

        // Set initial warehouse based on role
        let initialWarehouseId: string | null = null;
        if (isWarehouseManager && assignedWarehouseId) {
          initialWarehouseId = assignedWarehouseId;
        } else if (isSystemAdmin && data.length > 0) {
          initialWarehouseId = data[0].id;
        } else if (data.length > 0) {
          initialWarehouseId = data[0].id;
        }

        if (initialWarehouseId) {
          setSelectedWarehouseId(initialWarehouseId);
          await loadWarehouseLayout(initialWarehouseId);
        }
      } catch (error) {
        console.error("Failed to load warehouses:", error);
        setError("Failed to load warehouses. Using fallback layout.");
        // Fallback to mock layout
        if (isWarehouseManager && assignedWarehouseId) {
          setSelectedWarehouseId(assignedWarehouseId);
          setLayout(getWarehouseLayout(assignedWarehouseId));
        } else {
          setSelectedWarehouseId("warehouse-1");
          setLayout(getWarehouseLayout("warehouse-1"));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadWarehouses();
  }, [
    isWarehouseManager,
    assignedWarehouseId,
    assignedWarehouseName,
    isSystemAdmin,
  ]);

  // Load warehouse layout from API
  const loadWarehouseLayout = async (warehouseId: string) => {
    try {
      setIsLoadingLayout(true);
      setError(null);

      // Try to get hierarchy first
      try {
        const hierarchy = await locationsApi.getHierarchy(warehouseId);
        const warehouse = warehouses.find((w) => w.id === warehouseId);
        const layout = await convertLocationHierarchyToLayout(
          hierarchy,
          warehouseId,
          warehouse?.name || `Warehouse ${warehouseId}`
        );
        setLayout(layout);
      } catch (hierarchyError) {
        // Fallback: get all locations and convert
        console.log("Hierarchy not available, using locations list");
        const locations = await locationsApi.getByWarehouse(warehouseId);
        if (locations.length > 0) {
          const warehouse = warehouses.find((w) => w.id === warehouseId);
          const layout = await convertLocationsToLayout(
            locations,
            warehouseId,
            warehouse?.name || `Warehouse ${warehouseId}`
          );
          setLayout(layout);
        } else {
          // No locations found, use mock layout
          console.log("No locations found, using mock layout");
          setLayout(getWarehouseLayout(warehouseId));
        }
      }
    } catch (error) {
      console.error("Failed to load warehouse layout:", error);
      setError("Failed to load warehouse layout. Using fallback.");
      setLayout(getWarehouseLayout(warehouseId));
    } finally {
      setIsLoadingLayout(false);
    }
  };

  // Filter warehouses based on role
  const availableWarehouses =
    isWarehouseManager && assignedWarehouseId
      ? warehouses.filter((wh) => wh.id === assignedWarehouseId)
      : warehouses;

  const handleRackClick = (rack: RackUnit) => {
    // Only show side elevation for active racks
    // Maintenance and out_of_service racks are empty, so no need to show elevation
    if (rack.status === "active") {
      setSelectedRack(rack);
    } else {
      // For special status racks, just show a message or do nothing
      console.log(`Rack ${rack.id} is ${rack.status} - rack is empty`);
    }
  };

  const handleRackEdit = (rack: RackUnit) => {
    setEditingRack(rack);
    setShowEditModal(true);
    setSelectedRack(null); // Close elevation view if open
  };

  const handleRackUpdate = (updatedRack: RackUnit) => {
    if (!layout) return;

    // Update the rack in the layout
    const updatedRacks = layout.racks.map((rack) =>
      rack.id === updatedRack.id ? updatedRack : rack
    );

    setLayout({
      ...layout,
      racks: updatedRacks,
    });

    // If this rack was selected, update it
    if (selectedRack?.id === updatedRack.id) {
      setSelectedRack(updatedRack);
    }
  };

  const handleBinClick = (bin: LocationBin) => {
    setSelectedBin(bin);
    console.log("Bin clicked:", bin);
  };

  const handleCloseElevation = () => {
    setSelectedRack(null);
  };

  const handleWarehouseChange = async (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    setSelectedRack(null); // Clear selection when switching warehouses
    await loadWarehouseLayout(warehouseId);
  };

  if (isLoading || isLoadingLayout || !layout) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="text-base-content/60">Loading warehouse layout...</p>
        </div>
      </div>
    );
  }

  if (error && !layout) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-warning">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Calculate overall statistics
  const totalRacks = layout.racks.length;
  const totalBins = layout.racks.reduce(
    (sum, rack) => sum + rack.bins.length,
    0
  );
  const occupiedBins = layout.racks.reduce(
    (sum, rack) =>
      sum + rack.bins.filter((b) => b.status === "occupied").length,
    0
  );
  const reservedBins = layout.racks.reduce(
    (sum, rack) =>
      sum + rack.bins.filter((b) => b.status === "reserved").length,
    0
  );
  const emptyBins = totalBins - occupiedBins - reservedBins;
  const occupancyRate = totalBins > 0 ? (occupiedBins / totalBins) * 100 : 0;

  // Rack status counts
  const activeRacks = layout.racks.filter((r) => r.status === "active").length;
  const maintenanceRacks = layout.racks.filter(
    (r) => r.status === "maintenance"
  ).length;
  const outOfServiceRacks = layout.racks.filter(
    (r) => r.status === "out_of_service"
  ).length;

  // Check if user can edit racks
  const canEditRacks = isSystemAdmin || isWarehouseManager;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Warehouse Layout
          </h1>
          <p className="text-base-content/70 mt-1">
            {isWarehouseManager
              ? `Viewing ${assignedWarehouseName || "your assigned warehouse"}`
              : "Interactive visualization of warehouse storage locations"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => selectedWarehouseId && loadWarehouseLayout(selectedWarehouseId)}
            title="Refresh layout"
            disabled={isLoadingLayout}
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>

          {/* Warehouse selector (only for system admin) */}
          {isSystemAdmin && (
          <div className="form-control w-full max-w-xs">
            <label className="label">
              <span className="label-text font-semibold">Select Warehouse</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={selectedWarehouseId || ""}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              disabled={availableWarehouses.length === 0}
            >
              {availableWarehouses.length === 0 ? (
                <option value="">Loading warehouses...</option>
              ) : (
                availableWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))
              )}
            </select>
          </div>
          )}

          {/* Warehouse name display for warehouse managers */}
          {isWarehouseManager && assignedWarehouseName && (
            <div className="badge badge-lg badge-primary">
              {assignedWarehouseName}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Total Racks</div>
            <span className="material-symbols-outlined text-base-content/40">inventory_2</span>
          </div>
          <div className="text-3xl font-bold text-base-content">
            {totalRacks}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Total Bins</div>
            <span className="material-symbols-outlined text-base-content/40">category</span>
          </div>
          <div className="text-3xl font-bold text-base-content">
            {totalBins}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Occupied</div>
            <span className="material-symbols-outlined text-success">check_circle</span>
          </div>
          <div className="text-3xl font-bold text-success">
            {occupiedBins}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Reserved</div>
            <span className="material-symbols-outlined text-info">lock</span>
          </div>
          <div className="text-3xl font-bold text-info">
            {reservedBins}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Occupancy Rate</div>
            <span className="material-symbols-outlined text-base-content/40">percent</span>
          </div>
          <div className="text-3xl font-bold text-base-content">
            {occupancyRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Rack Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-100 border border-success rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Active Racks</div>
            <span className="material-symbols-outlined text-success">check_circle</span>
          </div>
          <div className="text-3xl font-bold text-success">
            {activeRacks}
          </div>
        </div>
        <div className="card bg-base-100 border border-warning rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Maintenance</div>
            <span className="material-symbols-outlined text-warning">build</span>
          </div>
          <div className="text-3xl font-bold text-warning">
            {maintenanceRacks}
          </div>
        </div>
        <div className="card bg-base-100 border border-error rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Out of Service</div>
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
          <div className="text-3xl font-bold text-error">
            {outOfServiceRacks}
          </div>
        </div>
      </div>

      {/* Warehouse Layout Visualization */}
      <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm relative">
        {/* Velocity Toggle - positioned outside scrollable area */}
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-base-100 rounded-lg shadow-lg border border-base-300 p-2 min-w-[140px]">
            <label className="label cursor-pointer gap-2 py-1">
              <span className="label-text text-xs font-semibold whitespace-nowrap">
                Velocity Heat Map
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={showVelocity}
                onChange={(e) => setShowVelocity(e.target.checked)}
              />
            </label>
            {showVelocity && (
              <div className="mt-2 text-xs text-base-content/60 space-y-1 pt-2 border-t border-base-300">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#22C55E] flex-shrink-0"></div>
                  <span className="text-xs">Low (0-20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#F59E0B] flex-shrink-0"></div>
                  <span className="text-xs">Medium (20-50%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#DC2626] flex-shrink-0"></div>
                  <span className="text-xs">High (50-100%)</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="h-[800px] w-full rounded-lg overflow-x-auto overflow-y-auto border border-base-300">
          <WarehouseLayoutVisualization
            layout={layout}
            onRackClick={handleRackClick}
            selectedRackId={selectedRack?.id || null}
            showVelocity={showVelocity}
            onVelocityToggle={setShowVelocity}
          />
        </div>
        <div className="flex items-start gap-2 mt-4">
          <span className="material-symbols-outlined text-base-content/60 text-sm mt-0.5">info</span>
          <p className="text-sm text-base-content/70 leading-relaxed">
            {canEditRacks
              ? "Click on any rack to view details, or right-click to edit status and description"
              : "Click on any rack to view its side elevation and all vertical levels"}
          </p>
        </div>
      </div>

      {/* Legend - Color Code */}
      <div className="card bg-base-100 border border-base-300 rounded-lg p-3 shadow-sm">
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-medium mb-2 text-base-content/70">
              Active Rack Occupancy Levels:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center gap-2 p-2 rounded bg-base-200">
                <div
                  className="w-8 h-8 rounded border border-gray-400 flex-shrink-0"
                  style={{ backgroundColor: "#F5F5F5" }}
                ></div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-base-content">Empty (0%)</div>
                  <div className="text-xs text-base-content/60">White/Gray</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-base-200">
                <div
                  className="w-8 h-8 rounded border border-green-600 flex-shrink-0"
                  style={{ backgroundColor: "#22C55E" }}
                ></div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-base-content">Low (&lt;50%)</div>
                  <div className="text-xs text-base-content/60">Green</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-base-200">
                <div
                  className="w-8 h-8 rounded border border-amber-600 flex-shrink-0"
                  style={{ backgroundColor: "#F59E0B" }}
                ></div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-base-content">Medium (50-85%)</div>
                  <div className="text-xs text-base-content/60">Amber</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-base-200">
                <div
                  className="w-8 h-8 rounded border border-indigo-700 flex-shrink-0"
                  style={{ backgroundColor: "#1E3A8A" }}
                ></div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-base-content">High (&gt;85%)</div>
                  <div className="text-xs text-base-content/60">Dark Blue</div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-medium mb-2 text-base-content/70">
              Special Status:
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 rounded bg-base-200 border border-blue-600">
                <div
                  className="w-8 h-8 rounded border border-blue-600 flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: "#4A90E2" }}
                >
                  <span className="material-symbols-outlined text-white text-sm">
                    lock
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-base-content">Reserved</div>
                  <div className="text-xs text-base-content/60">Blue</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-base-200 border border-orange-600">
                <div
                  className="w-8 h-8 rounded border border-orange-600 flex-shrink-0 flex items-center justify-center relative"
                  style={{ backgroundColor: "#FF6B35" }}
                >
                  <span className="material-symbols-outlined text-white text-sm">
                    build
                  </span>
                  <div
                    className="absolute inset-0 rounded opacity-20"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)",
                    }}
                  ></div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-base-content">Maintenance</div>
                  <div className="text-xs text-base-content/60">Orange</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-base-200 border border-red-700">
                <div
                  className="w-8 h-8 rounded border border-red-700 flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: "#DC2626" }}
                >
                  <span className="material-symbols-outlined text-white text-sm">
                    warning
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-base-content">Out of Service</div>
                  <div className="text-xs text-base-content/60">Red</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Elevation View Modal - only show for active racks */}
      {selectedRack && selectedRack.status === "active" && (
        <RackElevationView
          rack={selectedRack}
          onClose={handleCloseElevation}
          onBinClick={handleBinClick}
          onEdit={canEditRacks ? () => handleRackEdit(selectedRack) : undefined}
        />
      )}

      {/* Rack Edit Modal */}
      {showEditModal && editingRack && selectedWarehouseId && (
        <RackEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingRack(null);
          }}
          rack={editingRack}
          warehouseId={selectedWarehouseId}
          onUpdate={handleRackUpdate}
        />
      )}

      {/* Location Create Modal */}
      {selectedWarehouseId && (
        <LocationCreateModal
          isOpen={showCreateLocationModal}
          onClose={() => setShowCreateLocationModal(false)}
          warehouseId={selectedWarehouseId}
          onSuccess={() => {
            if (selectedWarehouseId) {
              loadWarehouseLayout(selectedWarehouseId);
            }
          }}
        />
      )}

      {/* Location Edit Modal */}
      {editingLocation && (
        <LocationEditModal
          isOpen={showEditLocationModal}
          onClose={() => {
            setShowEditLocationModal(false);
            setEditingLocation(null);
          }}
          location={editingLocation}
          onSuccess={() => {
            if (selectedWarehouseId) {
              loadWarehouseLayout(selectedWarehouseId);
            }
          }}
        />
      )}
    </div>
  );
}
