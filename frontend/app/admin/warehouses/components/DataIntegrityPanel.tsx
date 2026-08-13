"use client";

import { useEffect, useMemo, useState } from "react";
import { locationsApi } from "@/lib/api/locations";
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

      setMetrics(await locationsApi.getIntegritySummary(warehouseId));
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
    const blockingIssues =
      metrics.inventoryRowsNullLocation +
      metrics.defaultsToInactiveOrBlocked +
      metrics.duplicatePrimaryLocationCount;
    const reviewIssues =
      metrics.materialsWithoutDefault +
      metrics.wrongTypeBulkInNonBulk +
      metrics.wrongTypeNonBulkInBulk;
    if (blockingIssues > 0) return { label: "Action Required", cls: "text-error" };
    if (reviewIssues > 0) return { label: "Review Needed", cls: "text-warning" };
    return { label: "Ready", cls: "text-success" };
  }, [metrics]);

  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-base-content">Data Integrity</h3>
          <p className="text-xs text-base-content/60">
            Master-data coverage, storage compatibility, and stock-health checks.
          </p>
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
          <Metric title="Pallet Stock in Bulk Bins" value={metrics.wrongTypeNonBulkInBulk} warn={metrics.wrongTypeNonBulkInBulk > 0} />
          <Metric title="Bulk Stock in Standard Bins" value={metrics.wrongTypeBulkInNonBulk} warn={metrics.wrongTypeBulkInNonBulk > 0} />
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
