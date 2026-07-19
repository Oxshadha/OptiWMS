"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
const WAREHOUSE_LAYOUT_STALE_TIME_MS = 10 * 60 * 1000;
const WAREHOUSE_LAYOUT_GC_TIME_MS = 30 * 60 * 1000;

interface WarehouseLayoutQueryData {
  layout: WarehouseLayout;
  hasRealData: boolean;
  limitNotice: string | null;
  errorMessage: string | null;
}

const warehouseLayoutQueryKey = (warehouseId: string | null) => [
  "warehouse-layout",
  warehouseId || "none",
  WAREHOUSE_LAYOUT_RACK_LIMIT,
] as const;

export default function WarehousesPage() {
  const searchParams = useSearchParams();
  const rackFromUrl = searchParams.get("rack");
  const warehouseFromUrl = searchParams.get("warehouseId");
  const { admin, role } = useAdmin();
  const queryClient = useQueryClient();
  const isSystemAdmin = role === "admin";
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const assignedWarehouseId = admin?.warehouseId;

  const [selectedRack, setSelectedRack] = useState<RackUnit | null>(null);
  const [selectedBin, setSelectedBin] = useState<LocationBin | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    null
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRack, setEditingRack] = useState<RackUnit | null>(null);
  const [showCreateLocationModal, setShowCreateLocationModal] = useState(false);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showVelocity, setShowVelocity] = useState(false);
  const [showBulkRackModal, setShowBulkRackModal] = useState(false);
  const [showSlottingPlannerModal, setShowSlottingPlannerModal] = useState(false);
  const [layoutViewMode, setLayoutViewMode] = useState<"detailed" | "simple" | "routes">("detailed");
  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "layout-selector"],
    queryFn: warehousesApi.getAll,
    staleTime: WAREHOUSE_LAYOUT_STALE_TIME_MS,
    gcTime: WAREHOUSE_LAYOUT_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const warehouses = useMemo(() => warehousesQuery.data || [], [warehousesQuery.data]);

  const loadWarehouseLayout = useCallback(async (warehouseId: string): Promise<WarehouseLayoutQueryData> => {
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    const warehouseName = warehouse?.name || `Warehouse ${warehouseId}`;

    try {
      const summaries = await locationsApi.getRackSummaries(warehouseId, {
        limit: WAREHOUSE_LAYOUT_RACK_LIMIT,
        offset: 0,
      });

      if (summaries.length > 0) {
        const nextLayout = await convertRackSummariesToLayout(
          summaries,
          warehouseId,
          warehouseName
        );
        return {
          layout: nextLayout,
          hasRealData: true,
          limitNotice:
            summaries.length >= WAREHOUSE_LAYOUT_RACK_LIMIT
              ? `Showing first ${WAREHOUSE_LAYOUT_RACK_LIMIT.toLocaleString()} racks for browser safety. Use search/slotting views for full warehouse-scale analysis.`
              : null,
          errorMessage: null,
        };
      }

      logger.debug("No storage rack summaries found, showing empty layout state");
      return {
        layout: createEmptyLayout(warehouseId, warehouseName),
        hasRealData: false,
        limitNotice: null,
        errorMessage: "No storage locations are configured for this warehouse yet.",
      };
    } catch (error) {
      logger.error("Failed to load warehouse layout:", error);
      return {
        layout: createEmptyLayout(warehouseId, warehouseName),
        hasRealData: false,
        limitNotice: null,
        errorMessage: "Failed to load warehouse layout. Showing an empty state instead of generated mock racks.",
      };
    }
  }, [warehouses]);

  useEffect(() => {
    if (selectedWarehouseId || warehousesQuery.isPending) {
      return;
    }

    if (isWarehouseManager && assignedWarehouseId) {
      setSelectedWarehouseId(assignedWarehouseId);
      return;
    }

    if (warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [
    assignedWarehouseId,
    isWarehouseManager,
    selectedWarehouseId,
    warehouses,
    warehousesQuery.isPending,
  ]);

  const layoutQuery = useQuery({
    queryKey: warehouseLayoutQueryKey(selectedWarehouseId),
    queryFn: () => selectedWarehouseId
      ? loadWarehouseLayout(selectedWarehouseId)
      : Promise.resolve({
          layout: createEmptyLayout("unavailable", "Unavailable"),
          hasRealData: false,
          limitNotice: null,
          errorMessage: "No warehouse selected.",
        }),
    enabled: Boolean(selectedWarehouseId),
    staleTime: WAREHOUSE_LAYOUT_STALE_TIME_MS,
    gcTime: WAREHOUSE_LAYOUT_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const openRackDetail = useCallback(async (rack: RackUnit) => {
    if (!selectedWarehouseId) {
      setSelectedRack(rack);
      return;
    }

    setSelectedRack(rack);
    try {
      const rows = await queryClient.fetchQuery({
        queryKey: ["warehouse-rack-detail", selectedWarehouseId, rack.id],
        queryFn: () => locationsApi.getRackDetail(selectedWarehouseId, rack.id),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
      const detailedRack = {
        ...rack,
        bins: occupancyRowsToBins(rows),
        maxLevels: Math.max(...rows.map((row) => row.levelNumber || 1), rack.maxLevels, 5),
      };
      setSelectedRack(detailedRack);
      queryClient.setQueryData<WarehouseLayoutQueryData>(warehouseLayoutQueryKey(selectedWarehouseId), (current) => {
        if (!current) return current;
        return {
          ...current,
          layout: {
            ...current.layout,
            racks: current.layout.racks.map((item) => item.id === rack.id ? detailedRack : item),
          },
        };
      });
    } catch (error) {
      logger.error(`Failed to load rack detail for ${rack.id}:`, error);
      showToast.error("Rack summary loaded, but bin details could not be loaded.");
    }
  }, [queryClient, selectedWarehouseId]);

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
    if (!selectedWarehouseId) return;

    queryClient.setQueryData<WarehouseLayoutQueryData>(warehouseLayoutQueryKey(selectedWarehouseId), (current) => {
      if (!current) return current;
      return {
        ...current,
        layout: {
          ...current.layout,
          racks: current.layout.racks.map((rack) =>
            rack.id === updatedRack.id ? updatedRack : rack
          ),
        },
      };
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

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    setSelectedRack(null);
  };

  useEffect(() => {
    if (!warehouseFromUrl || warehouses.length === 0) return;
    if (warehouses.some((w) => w.id === warehouseFromUrl) && selectedWarehouseId !== warehouseFromUrl) {
      handleWarehouseChange(warehouseFromUrl);
    }
  }, [selectedWarehouseId, warehouseFromUrl, warehouses]);

  const layoutData = layoutQuery.data;
  const layout = layoutData?.layout ?? null;
  const layoutHasRealData = Boolean(layoutData?.hasRealData);
  const layoutLimitNotice = layoutData?.limitNotice ?? null;
  const error =
    warehousesQuery.error
      ? "Failed to load warehouses. Layout data is unavailable until the warehouse list loads."
      : layoutData?.errorMessage ?? null;
  const isLoading = warehousesQuery.isPending && !warehousesQuery.data;
  const isLoadingLayout = layoutQuery.isPending && !layoutQuery.data;
  const isRefreshingLayout =
    (warehousesQuery.isFetching && !warehousesQuery.isPending) ||
    (layoutQuery.isFetching && !layoutQuery.isPending);

  useEffect(() => {
    if (!layout || !rackFromUrl) return;
    const match = layout.racks.find(
      (rack) => rack.id === rackFromUrl || rack.id.toUpperCase() === rackFromUrl.toUpperCase()
    );
    if (match) {
      setLayoutViewMode("detailed");
      void openRackDetail(match);
    }
  }, [layout, rackFromUrl, openRackDetail]);

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
      await queryClient.invalidateQueries({ queryKey: warehouseLayoutQueryKey(selectedWarehouseId) });
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
        isLoadingLayout={layoutQuery.isFetching}
        onRefresh={() => {
          if (selectedWarehouseId) {
            void layoutQuery.refetch();
          }
        }}
        onOpenBulkRackCreate={() => setShowBulkRackModal(true)}
        onOpenSlottingPlanner={() => setShowSlottingPlannerModal(true)}
        onWarehouseChange={(warehouseId) => {
          handleWarehouseChange(warehouseId);
        }}
      />
      {isRefreshingLayout && (
        <div className="alert alert-info py-2">
          <span className="loading loading-spinner loading-xs"></span>
          <span>Refreshing cached warehouse layout...</span>
        </div>
      )}

      <WarehouseStatsCards stats={stats} />

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
            void queryClient.invalidateQueries({ queryKey: warehouseLayoutQueryKey(selectedWarehouseId) });
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
              void queryClient.invalidateQueries({ queryKey: warehouseLayoutQueryKey(selectedWarehouseId) });
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
              void queryClient.invalidateQueries({ queryKey: warehouseLayoutQueryKey(selectedWarehouseId) });
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
            void queryClient.invalidateQueries({ queryKey: warehouseLayoutQueryKey(selectedWarehouseId) });
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
    stations: [],
    aisles: [],
  };
}
