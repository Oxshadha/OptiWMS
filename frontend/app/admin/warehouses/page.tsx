"use client";

import { useState, useEffect } from "react";
import { WarehouseLayoutVisualization } from "@/components/WarehouseLayout";
import { RackElevationView } from "@/components/RackElevationView";
import { RackEditModal } from "@/components/RackEditModal";
import { getWarehouseLayout } from "@/lib/utils/warehouse-layout-generator";
import { RackUnit, LocationBin } from "@/lib/types/warehouse-layout";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { useAdmin } from "@/contexts/AdminContext";

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
  const [layout, setLayout] = useState<ReturnType<
    typeof getWarehouseLayout
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRack, setEditingRack] = useState<RackUnit | null>(null);

  // Load warehouses on mount
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoading(true);
        const data = await warehousesApi.getAll();
        setWarehouses(data);

        // Set initial warehouse based on role
        if (isWarehouseManager && assignedWarehouseId) {
          // Warehouse manager: only see their assigned warehouse
          setSelectedWarehouseId(assignedWarehouseId);
          setLayout(getWarehouseLayout(assignedWarehouseId));
        } else if (isSystemAdmin && data.length > 0) {
          // System admin: can see all, default to first
          setSelectedWarehouseId(data[0].id);
          setLayout(getWarehouseLayout(data[0].id));
        } else if (data.length > 0) {
          setSelectedWarehouseId(data[0].id);
          setLayout(getWarehouseLayout(data[0].id));
        }
      } catch (error) {
        console.error("Failed to load warehouses:", error);
        // Use sample data as fallback
        if (isWarehouseManager && assignedWarehouseName === "Warehouse 1") {
          setSelectedWarehouseId("warehouse-1");
          setLayout(getWarehouseLayout("warehouse-1"));
          // Set fallback warehouses for system admin
          if (isSystemAdmin) {
            setWarehouses([
              {
                id: "warehouse-1",
                name: "Warehouse 1",
                code: "WH1",
                status: "active",
              } as Warehouse,
              {
                id: "warehouse-2",
                name: "Warehouse 2",
                code: "WH2",
                status: "active",
              } as Warehouse,
            ]);
          }
        } else if (
          isWarehouseManager &&
          assignedWarehouseName === "Warehouse 2"
        ) {
          setSelectedWarehouseId("warehouse-2");
          setLayout(getWarehouseLayout("warehouse-2"));
          // Set fallback warehouses for system admin
          if (isSystemAdmin) {
            setWarehouses([
              {
                id: "warehouse-1",
                name: "Warehouse 1",
                code: "WH1",
                status: "active",
              } as Warehouse,
              {
                id: "warehouse-2",
                name: "Warehouse 2",
                code: "WH2",
                status: "active",
              } as Warehouse,
            ]);
          }
        } else {
          // Default fallback - for system admin, provide both warehouses
          if (isSystemAdmin) {
            setWarehouses([
              {
                id: "warehouse-1",
                name: "Warehouse 1",
                code: "WH1",
                status: "active",
              } as Warehouse,
              {
                id: "warehouse-2",
                name: "Warehouse 2",
                code: "WH2",
                status: "active",
              } as Warehouse,
            ]);
            setSelectedWarehouseId("warehouse-1");
            setLayout(getWarehouseLayout("warehouse-1"));
          } else {
            setSelectedWarehouseId("warehouse-1");
            setLayout(getWarehouseLayout("warehouse-1"));
          }
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

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    setLayout(getWarehouseLayout(warehouseId));
    setSelectedRack(null); // Clear selection when switching warehouses
  };

  if (!layout) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Total Racks</div>
          <div className="text-2xl font-bold text-base-content mt-1">
            {totalRacks}
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Total Bins</div>
          <div className="text-2xl font-bold text-base-content mt-1">
            {totalBins}
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Occupied</div>
          <div className="text-2xl font-bold text-success mt-1">
            {occupiedBins}
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Reserved</div>
          <div className="text-2xl font-bold text-info mt-1">
            {reservedBins}
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Occupancy Rate</div>
          <div className="text-2xl font-bold text-base-content mt-1">
            {occupancyRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Rack Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Active Racks</div>
          <div className="text-2xl font-bold text-success mt-1">
            {activeRacks}
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Maintenance</div>
          <div className="text-2xl font-bold text-warning mt-1">
            {maintenanceRacks}
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="text-sm text-base-content/70">Out of Service</div>
          <div className="text-2xl font-bold text-error mt-1">
            {outOfServiceRacks}
          </div>
        </div>
      </div>

      {/* Warehouse Layout Visualization */}
      <div className="card-surface p-6">
        <div className="h-[800px] w-full">
          <WarehouseLayoutVisualization
            layout={layout}
            onRackClick={handleRackClick}
            selectedRackId={selectedRack?.id || null}
          />
        </div>
        <p className="text-xs text-base-content/70 mt-3">
          {canEditRacks
            ? "Click on any rack to view details, or right-click to edit status and description"
            : "Click on any rack to view its side elevation and all vertical levels"}
        </p>
      </div>

      {/* Legend - Color Code */}
      <div className="card-surface p-4">
        <h3 className="font-semibold mb-3">
          Legend - Industrial Safety Color Standards
        </h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2 text-base-content/70">
              Active Rack Occupancy Levels (Light-to-Dark Progression):
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                <div
                  className="w-6 h-6 rounded border-2 border-gray-400 flex-shrink-0"
                  style={{ backgroundColor: "#F5F5F5" }}
                ></div>
                <div className="flex-1">
                  <span className="font-semibold">Empty (0%)</span>
                  <p className="text-xs text-base-content/60">
                    White/Very Light Gray - Available, no items
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                <div
                  className="w-6 h-6 rounded border-2 border-green-600 flex-shrink-0"
                  style={{ backgroundColor: "#22C55E" }}
                ></div>
                <div className="flex-1">
                  <span className="font-semibold">Low (&lt;50%)</span>
                  <p className="text-xs text-base-content/60">
                    Green - Go/High availability
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                <div
                  className="w-6 h-6 rounded border-2 border-amber-600 flex-shrink-0"
                  style={{ backgroundColor: "#F59E0B" }}
                ></div>
                <div className="flex-1">
                  <span className="font-semibold">Medium (50-85%)</span>
                  <p className="text-xs text-base-content/60">
                    Yellow/Amber - Cautionary/Transitional
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                <div
                  className="w-6 h-6 rounded border-2 border-indigo-700 flex-shrink-0"
                  style={{ backgroundColor: "#1E3A8A" }}
                ></div>
                <div className="flex-1">
                  <span className="font-semibold">High (&gt;85%)</span>
                  <p className="text-xs text-base-content/60">
                    Dark Blue/Indigo - Heavy/High density
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 text-base-content/70">
              Special Status (Industrial Safety Colors):
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                <div
                  className="w-6 h-6 rounded border-2 border-blue-600 flex-shrink-0 relative"
                  style={{ backgroundColor: "#4A90E2" }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs">
                    🔒
                  </span>
                </div>
                <div className="flex-1">
                  <span className="font-semibold">Reserved</span>
                  <p className="text-xs text-base-content/60">
                    Safety Blue - Set aside/Trustworthy
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                <div
                  className="w-6 h-6 rounded border-2 border-orange-600 flex-shrink-0 relative"
                  style={{ backgroundColor: "#FF6B35" }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs">
                    🔧
                  </span>
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
                    }}
                  ></div>
                </div>
                <div className="flex-1">
                  <span className="font-semibold">Maintenance</span>
                  <p className="text-xs text-base-content/60">
                    Safety Orange - Maintenance warning
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                <div
                  className="w-6 h-6 rounded border-2 border-red-700 flex-shrink-0 relative"
                  style={{ backgroundColor: "#DC2626" }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs">
                    ⚠
                  </span>
                </div>
                <div className="flex-1">
                  <span className="font-semibold">Out of Service</span>
                  <p className="text-xs text-base-content/60">
                    Safety Red - Stop/Danger
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-base-300">
            <p className="text-xs text-base-content/60 italic">
              <strong>Accessibility Note:</strong> This color scheme avoids
              red/green for occupancy levels and uses high-contrast colors with
              secondary visual cues (icons, patterns) to support color-blind
              users.
            </p>
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
    </div>
  );
}
