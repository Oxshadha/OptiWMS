"use client";

import { useState, useEffect } from "react";
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
import { logger } from "@/lib/utils/logger";
import { WarehouseHeader } from "./components/WarehouseHeader";
import { WarehouseStatsCards } from "./components/WarehouseStatsCards";
import { WarehouseLayoutCard } from "./components/WarehouseLayoutCard";
import { WarehouseLegend } from "./components/WarehouseLegend";
import { calculateWarehouseStats } from "./types";

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
        logger.error("Failed to load warehouses:", error);
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
        // Fallback: get storage-only locations and convert
        // Only show STORAGE locations in 2D map (hide receiving, packing, shipping areas)
        logger.debug("Hierarchy not available, using storage-only locations list");
        const locations = await locationsApi.getStorageLocationsByWarehouse(warehouseId);
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
          logger.debug("No storage locations found, using mock layout");
          setLayout(getWarehouseLayout(warehouseId));
        }
      }
    } catch (error) {
      logger.error("Failed to load warehouse layout:", error);
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
      logger.debug(`Rack ${rack.id} is ${rack.status} - rack is empty`);
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
    logger.debug("Bin clicked:", bin);
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

  const stats = calculateWarehouseStats(layout);

  // Check if user can edit racks
  const canEditRacks = isSystemAdmin || isWarehouseManager;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <WarehouseHeader
        isSystemAdmin={isSystemAdmin}
        isWarehouseManager={isWarehouseManager}
        assignedWarehouseName={assignedWarehouseName}
        selectedWarehouseId={selectedWarehouseId}
        availableWarehouses={availableWarehouses}
        isLoadingLayout={isLoadingLayout}
        onRefresh={() => {
          if (selectedWarehouseId) {
            void loadWarehouseLayout(selectedWarehouseId);
          }
        }}
        onWarehouseChange={(warehouseId) => {
          void handleWarehouseChange(warehouseId);
        }}
      />

      <WarehouseStatsCards stats={stats} />

      <WarehouseLayoutCard
        layout={layout}
        showVelocity={showVelocity}
        canEditRacks={canEditRacks}
        selectedRackId={selectedRack?.id || null}
        onToggleVelocity={setShowVelocity}
        onRackClick={handleRackClick}
      />

      <WarehouseLegend />

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
