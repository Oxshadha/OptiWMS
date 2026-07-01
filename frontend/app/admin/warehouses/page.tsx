"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { RackElevationView } from "@/components/RackElevationView";
import { RackEditModal } from "@/components/RackEditModal";
import { convertRackSummariesToLayout, occupancyRowsToBins } from "@/lib/utils/location-to-layout";
import { RackUnit, LocationBin, WarehouseLayout } from "@/lib/types/warehouse-layout";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { locationsApi, Location } from "@/lib/api/locations";
import { showToast } from "@/lib/utils/toast";
import { useAdmin } from "@/contexts/AdminContext";
import { LocationCreateModal } from "@/components/LocationCreateModal";
import { LocationEditModal } from "@/components/LocationEditModal";
import { logger } from "@/lib/utils/logger";
import { WarehouseHeader } from "./components/WarehouseHeader";
import { WarehouseStatsCards } from "./components/WarehouseStatsCards";
import { WarehouseLayoutCard } from "./components/WarehouseLayoutCard";
import { WarehouseLegend } from "./components/WarehouseLegend";
import { BulkRackCreateModal } from "./components/BulkRackCreateModal";
import { SlottingPlannerModal } from "./components/SlottingPlannerModal";
import { SimpleSlottingView } from "./components/SimpleSlottingView";
import { DataIntegrityPanel } from "./components/DataIntegrityPanel";
import { WarehouseRouteControlPanel } from "./components/WarehouseRouteControlPanel";
import { calculateWarehouseStats } from "./types";

const WAREHOUSE_LAYOUT_RACK_LIMIT = 1200;

export default function WarehousesPage() {
  const searchParams = useSearchParams();
  const rackFromUrl = searchParams.get("rack");
  const warehouseFromUrl = searchParams.get("warehouseId");
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
  const [showBulkRackModal, setShowBulkRackModal] = useState(false);
  const [showSlottingPlannerModal, setShowSlottingPlannerModal] = useState(false);
  const [layoutViewMode, setLayoutViewMode] = useState<"detailed" | "simple" | "routes">("detailed");
  const [layoutHasRealData, setLayoutHasRealData] = useState(false);
  const [layoutLimitNotice, setLayoutLimitNotice] = useState<string | null>(null);

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
        setError("Failed to load warehouses. Layout data is unavailable until the warehouse list loads.");
        setLayoutHasRealData(false);
        if (isWarehouseManager && assignedWarehouseId) {
          setSelectedWarehouseId(assignedWarehouseId);
          setLayout(createEmptyLayout(assignedWarehouseId, assignedWarehouseName || "Assigned Warehouse"));
        } else {
          setSelectedWarehouseId(null);
          setLayout(createEmptyLayout("unavailable", "Unavailable"));
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
      setLayoutLimitNotice(null);

      const warehouse = warehouses.find((w) => w.id === warehouseId);
      const summaries = await locationsApi.getRackSummaries(warehouseId, {
        limit: WAREHOUSE_LAYOUT_RACK_LIMIT,
        offset: 0,
      });
      if (summaries.length > 0) {
        const nextLayout = await convertRackSummariesToLayout(
          summaries,
          warehouseId,
          warehouse?.name || `Warehouse ${warehouseId}`
        );
        setLayout(nextLayout);
        setLayoutHasRealData(true);
        if (summaries.length >= WAREHOUSE_LAYOUT_RACK_LIMIT) {
          setLayoutLimitNotice(
            `Showing first ${WAREHOUSE_LAYOUT_RACK_LIMIT.toLocaleString()} racks for browser safety. Use search/slotting views for full warehouse-scale analysis.`
          );
        }
      } else {
        logger.debug("No storage rack summaries found, showing empty layout state");
        setLayout(createEmptyLayout(
          warehouseId,
          warehouse?.name || `Warehouse ${warehouseId}`
        ));
        setLayoutHasRealData(false);
        setError("No storage locations are configured for this warehouse yet.");
      }
    } catch (error) {
      logger.error("Failed to load warehouse layout:", error);
      const warehouse = warehouses.find((w) => w.id === warehouseId);
      setError("Failed to load warehouse layout. Showing an empty state instead of generated mock racks.");
      setLayout(createEmptyLayout(
        warehouseId,
        warehouse?.name || `Warehouse ${warehouseId}`
      ));
      setLayoutHasRealData(false);
    } finally {
      setIsLoadingLayout(false);
    }
  };

  const openRackDetail = async (rack: RackUnit) => {
    if (!selectedWarehouseId) {
      setSelectedRack(rack);
      return;
    }

    setSelectedRack(rack);
    try {
      const rows = await locationsApi.getRackDetail(selectedWarehouseId, rack.id);
      const detailedRack = {
        ...rack,
        bins: occupancyRowsToBins(rows),
        maxLevels: Math.max(...rows.map((row) => row.levelNumber || 1), rack.maxLevels, 5),
      };
      setSelectedRack(detailedRack);
      setLayout((current) => {
        if (!current) return current;
        return {
          ...current,
          racks: current.racks.map((item) => item.id === rack.id ? detailedRack : item),
        };
      });
    } catch (error) {
      logger.error(`Failed to load rack detail for ${rack.id}:`, error);
      showToast.error("Rack summary loaded, but bin details could not be loaded.");
    }
  };

  // Filter warehouses based on role
  const availableWarehouses =
    isWarehouseManager && assignedWarehouseId
      ? warehouses.filter((wh) => wh.id === assignedWarehouseId)
      : warehouses;

  const handleRackClick = (rack: RackUnit) => {
    // Active racks open side elevation for occupancy details.
    // Non-active racks open the edit modal directly so operators can re-activate quickly.
    if (rack.status === "active") {
      void openRackDetail(rack);
      return;
    }

    if (isSystemAdmin || isWarehouseManager) {
      setEditingRack(rack);
      setShowEditModal(true);
      setSelectedRack(null);
      return;
    }

    logger.debug(`Rack ${rack.id} is ${rack.status} and read-only for current role`);
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
    setSelectedRack(null);
    await loadWarehouseLayout(warehouseId);
  };

  useEffect(() => {
    if (!warehouseFromUrl || warehouses.length === 0) return;
    if (warehouses.some((w) => w.id === warehouseFromUrl) && selectedWarehouseId !== warehouseFromUrl) {
      void handleWarehouseChange(warehouseFromUrl);
    }
  }, [warehouseFromUrl, warehouses]);

  useEffect(() => {
    if (!layout || !rackFromUrl) return;
    const match = layout.racks.find(
      (rack) => rack.id === rackFromUrl || rack.id.toUpperCase() === rackFromUrl.toUpperCase()
    );
    if (match) {
      setLayoutViewMode("detailed");
      void openRackDetail(match);
    }
  }, [layout, rackFromUrl]);

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

  const handleCreateZoneARacks = async (payload: {
    area: string;
    rowsToAdd: number;
    baysPerRow: number;
    levelsPerRack: number;
    binsPerLevel: number;
  }) => {
    if (!selectedWarehouseId) return;
    try {
      const result = await locationsApi.bulkCreateRacks({
        warehouseId: selectedWarehouseId,
        area: payload.area,
        rowsToAdd: payload.rowsToAdd,
        baysPerRow: payload.baysPerRow,
        levelsPerRack: payload.levelsPerRack,
        binsPerLevel: payload.binsPerLevel,
      });
      showToast.success(result.message);
      if (result.skippedRacks && result.skippedRacks.length > 0) {
        showToast.warning(`${result.skippedRacks.length} existing rack(s) were skipped safely.`);
      }
      await loadWarehouseLayout(selectedWarehouseId);
    } catch (error) {
      logger.error("Failed to create Zone A racks:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to create racks.");
      throw error;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <WarehouseHeader
        isSystemAdmin={isSystemAdmin}
        isWarehouseManager={isWarehouseManager}
        canEditRacks={canEditRacks}
        assignedWarehouseName={assignedWarehouseName}
        selectedWarehouseId={selectedWarehouseId}
        availableWarehouses={availableWarehouses}
        isLoadingLayout={isLoadingLayout}
        onRefresh={() => {
          if (selectedWarehouseId) {
            void loadWarehouseLayout(selectedWarehouseId);
          }
        }}
        onOpenBulkRackCreate={() => setShowBulkRackModal(true)}
        onOpenSlottingPlanner={() => setShowSlottingPlannerModal(true)}
        onWarehouseChange={(warehouseId) => {
          void handleWarehouseChange(warehouseId);
        }}
      />

      <WarehouseStatsCards stats={stats} />
      {layoutLimitNotice && (
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <span>{layoutLimitNotice}</span>
        </div>
      )}
      <DataIntegrityPanel warehouseId={selectedWarehouseId} />

      {layoutHasRealData ? (
        <>
          {layoutViewMode === "detailed" && <WarehouseLegend />}

          <div className="tabs tabs-boxed w-fit">
            <button
              className={`tab ${layoutViewMode === "detailed" ? "tab-active" : ""}`}
              onClick={() => setLayoutViewMode("detailed")}
            >
              Detailed Layout
            </button>
            <button
              className={`tab ${layoutViewMode === "simple" ? "tab-active" : ""}`}
              onClick={() => setLayoutViewMode("simple")}
            >
              Simple Slotting
            </button>
            <button
              className={`tab ${layoutViewMode === "routes" ? "tab-active" : ""}`}
              onClick={() => setLayoutViewMode("routes")}
            >
              Forklift Routes
            </button>
          </div>

          {layoutViewMode === "detailed" ? (
            <WarehouseLayoutCard
              layout={layout}
              showVelocity={showVelocity}
              canEditRacks={canEditRacks}
              selectedRackId={selectedRack?.id || null}
              onToggleVelocity={setShowVelocity}
              onRackClick={handleRackClick}
            />
          ) : layoutViewMode === "simple" ? (
            <SimpleSlottingView layout={layout} />
          ) : (
            <WarehouseRouteControlPanel />
          )}
        </>
      ) : (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-6xl text-base-content/20 mb-4">
            inventory_2
          </span>
          <h3 className="text-xl font-semibold text-base-content mb-2">
            No Renderable Warehouse Layout
          </h3>
          <p className="text-base-content/60 mb-3">
            This warehouse does not have real storage locations loaded yet, so the 2D map is intentionally hidden.
          </p>
          <p className="text-sm text-base-content/50">
            Create or import storage locations, then refresh to render the live layout.
          </p>
        </div>
      )}

      {/* Side Elevation View Modal */}
      {selectedRack && (
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
          onUpdate={(updatedRack) => {
            // Optimistic UI update so color/status changes instantly
            handleRackUpdate(updatedRack);
            // Then sync from backend to keep all bins/rack metadata consistent
            void loadWarehouseLayout(selectedWarehouseId);
          }}
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

      <BulkRackCreateModal
        isOpen={showBulkRackModal}
        onClose={() => setShowBulkRackModal(false)}
        onSubmit={handleCreateZoneARacks}
      />

      <SlottingPlannerModal
        isOpen={showSlottingPlannerModal}
        warehouseId={selectedWarehouseId}
        onClose={() => setShowSlottingPlannerModal(false)}
        onUpdated={() => {
          if (selectedWarehouseId) {
            void loadWarehouseLayout(selectedWarehouseId);
          }
        }}
      />
    </div>
  );
}

function createEmptyLayout(warehouseId: string, warehouseName: string): WarehouseLayout {
  return {
    id: `empty-${warehouseId}`,
    name: warehouseName,
    warehouseId,
    width: 1200,
    height: 600,
    racks: [],
    aisles: [],
  };
}
