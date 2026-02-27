"use client";

import { useEffect, useMemo, useState } from "react";
import { inventoryApi } from "@/lib/api/inventory";
import { locationsApi } from "@/lib/api/locations";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import { materialsApi } from "@/lib/api/materials";
import { logger } from "@/lib/utils/logger";

interface DataIntegrityPanelProps {
  warehouseId?: string | null;
}

interface IntegrityMetrics {
  totalMaterials: number;
  defaultsAssigned: number;
  materialsWithoutDefault: number;
  inventoryRows: number;
  inventoryQtySum: number;
  inventoryRowsNullLocation: number;
  wrongTypeNonBulkInBulk: number;
  wrongTypeBulkInNonBulk: number;
  defaultsToInactiveOrBlocked: number;
  duplicatePrimaryLocationCount: number;
  lowLike: number;
  availableLike: number;
}

const emptyMetrics: IntegrityMetrics = {
  totalMaterials: 0,
  defaultsAssigned: 0,
  materialsWithoutDefault: 0,
  inventoryRows: 0,
  inventoryQtySum: 0,
  inventoryRowsNullLocation: 0,
  wrongTypeNonBulkInBulk: 0,
  wrongTypeBulkInNonBulk: 0,
  defaultsToInactiveOrBlocked: 0,
  duplicatePrimaryLocationCount: 0,
  lowLike: 0,
  availableLike: 0,
};

export function DataIntegrityPanel({ warehouseId }: DataIntegrityPanelProps) {
  const [metrics, setMetrics] = useState<IntegrityMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    if (!warehouseId) return;
    try {
      setLoading(true);
      setError(null);

      const [materials, inventory, locations, defaults] = await Promise.all([
        materialsApi.getAll(),
        inventoryApi.getByWarehouse(warehouseId),
        locationsApi.getStorageLocationsByWarehouse(warehouseId),
        materialDefaultLocationsApi.getMaterialsWithLocations(warehouseId),
      ]);

      const storageTypeByMaterialId = new Map(
        materials.map((material) => [material.id, (material.storageType || "pallet").toLowerCase()])
      );
      const locationTypeByCode = new Map(
        locations.map((location) => [location.locationCode, (location.locationType || "storage").toLowerCase()])
      );
      const locationStatusByCode = new Map(
        locations.map((location) => [
          location.locationCode,
          {
            isActive: !!location.isActive,
            rackStatus: (location.rackStatus || "active").toLowerCase(),
          },
        ])
      );

      const assignedMaterialIds = new Set(defaults.map((item) => item.materialId));
      const materialsWithoutDefault = materials.filter((material) => !assignedMaterialIds.has(material.id)).length;

      let inventoryRowsNullLocation = 0;
      let wrongTypeNonBulkInBulk = 0;
      let wrongTypeBulkInNonBulk = 0;
      let inventoryQtySum = 0;

      const grouped = new Map<string, { qty: number; reorderPoint: number; bufferStock: number }>();
      inventory.forEach((row) => {
        const qty = Math.ceil(parseFloat(row.quantity) || 0);
        inventoryQtySum += qty;
        if (!row.locationCode) {
          inventoryRowsNullLocation++;
        }

        const storageType = storageTypeByMaterialId.get(row.materialId) || "pallet";
        const locType = row.locationCode ? locationTypeByCode.get(row.locationCode) || "storage" : "storage";
        if (storageType !== "bulk" && locType === "bulk") {
          wrongTypeNonBulkInBulk++;
        }
        if (storageType === "bulk" && locType !== "bulk") {
          wrongTypeBulkInNonBulk++;
        }

        const current = grouped.get(row.materialId) || { qty: 0, reorderPoint: 0, bufferStock: 0 };
        current.qty += qty;
        current.reorderPoint = Math.max(current.reorderPoint, parseFloat(row.reorderPoint || "0") || 0);
        current.bufferStock = Math.max(current.bufferStock, parseFloat(row.bufferStock || "0") || 0);
        grouped.set(row.materialId, current);
      });

      let lowLike = 0;
      let availableLike = 0;
      grouped.forEach((value) => {
        const isLow = value.qty <= value.reorderPoint || value.qty <= value.bufferStock || value.qty < 10;
        if (isLow) lowLike += 1;
        else availableLike += 1;
      });

      let defaultsToInactiveOrBlocked = 0;
      const primaryCountByLocation = new Map<string, number>();
      defaults.forEach((item) => {
        const state = locationStatusByCode.get(item.locationCode);
        if (!state) {
          defaultsToInactiveOrBlocked += 1;
          return;
        }
        if (item.priority === 1) {
          const current = primaryCountByLocation.get(item.locationCode) || 0;
          primaryCountByLocation.set(item.locationCode, current + 1);
        }
        const blocked = ["reserved", "maintenance", "out_of_service"].includes(state.rackStatus);
        if (!state.isActive || blocked) {
          defaultsToInactiveOrBlocked += 1;
        }
      });
      const duplicatePrimaryLocationCount = Array.from(primaryCountByLocation.values()).filter((count) => count > 1)
        .length;

      setMetrics({
        totalMaterials: materials.length,
        defaultsAssigned: assignedMaterialIds.size,
        materialsWithoutDefault,
        inventoryRows: inventory.length,
        inventoryQtySum,
        inventoryRowsNullLocation,
        wrongTypeNonBulkInBulk,
        wrongTypeBulkInNonBulk,
        defaultsToInactiveOrBlocked,
        duplicatePrimaryLocationCount,
        lowLike,
        availableLike,
      });
    } catch (e) {
      logger.error("Failed to load integrity metrics", e);
      setError("Failed to load data integrity metrics.");
      setMetrics(emptyMetrics);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
  }, [warehouseId]);

  const health = useMemo(() => {
    const criticalIssues =
      metrics.materialsWithoutDefault +
      metrics.inventoryRowsNullLocation +
      metrics.wrongTypeBulkInNonBulk +
      metrics.wrongTypeNonBulkInBulk +
      metrics.defaultsToInactiveOrBlocked +
      metrics.duplicatePrimaryLocationCount;
    if (criticalIssues === 0) return { label: "Healthy", cls: "text-success" };
    if (criticalIssues < 20) return { label: "Warning", cls: "text-warning" };
    return { label: "Critical", cls: "text-error" };
  }, [metrics]);

  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-base-content">Data Integrity</h3>
          <p className="text-xs text-base-content/60">Default location, type-match, and stock-health checks.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${health.cls}`}>{health.label}</span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void loadMetrics()}
            disabled={loading}
            title="Refresh checks"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-warning">
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Metric title="Materials" value={metrics.totalMaterials} />
          <Metric title="Defaults Assigned" value={metrics.defaultsAssigned} />
          <Metric title="Missing Defaults" value={metrics.materialsWithoutDefault} warn={metrics.materialsWithoutDefault > 0} />
          <Metric title="Inventory Rows" value={metrics.inventoryRows} />
          <Metric title="Total Qty" value={metrics.inventoryQtySum} />
          <Metric title="Null Locations" value={metrics.inventoryRowsNullLocation} warn={metrics.inventoryRowsNullLocation > 0} />
          <Metric title="Wrong Type (non-bulk in bulk)" value={metrics.wrongTypeNonBulkInBulk} warn={metrics.wrongTypeNonBulkInBulk > 0} />
          <Metric title="Wrong Type (bulk in non-bulk)" value={metrics.wrongTypeBulkInNonBulk} warn={metrics.wrongTypeBulkInNonBulk > 0} />
          <Metric title="Invalid Defaults" value={metrics.defaultsToInactiveOrBlocked} warn={metrics.defaultsToInactiveOrBlocked > 0} />
          <Metric title="Duplicate Primary Bins" value={metrics.duplicatePrimaryLocationCount} warn={metrics.duplicatePrimaryLocationCount > 0} />
          <Metric title="Stock: Available / Low" value={`${metrics.availableLike} / ${metrics.lowLike}`} />
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, warn }: { title: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-md border border-base-300 bg-base-100 p-3">
      <div className="text-xs text-base-content/60">{title}</div>
      <div className={`text-lg font-semibold ${warn ? "text-warning" : "text-base-content"}`}>{value}</div>
    </div>
  );
}
