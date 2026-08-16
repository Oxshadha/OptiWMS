"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WarehouseRouteControlPanel } from "@/app/admin/warehouses/components/WarehouseRouteControlPanel";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { Warehouse, warehousesApi } from "@/lib/api/warehouses";
import { logger } from "@/lib/utils/logger";

export default function PathfindingPage() {
  const { admin, hasPermission, isLoading: adminLoading } = useAdmin();
  const searchParams = useSearchParams();
  // Set when arriving from the warehouse layout page so the same warehouse stays selected.
  const warehouseFromUrl = searchParams.get("warehouseId");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const canView = hasPermission(ADMIN_ROUTES.PATHFINDING, "view");

  useEffect(() => {
    if (adminLoading || !canView) return;
    let active = true;
    warehousesApi
      .getAll()
      .then((items) => {
        if (!active) return;
        const warehouseRestricted =
          admin?.role === "warehouse_manager" && Boolean(admin.warehouseId);
        const available = warehouseRestricted
          ? items.filter((warehouse) => warehouse.id === admin.warehouseId)
          : items;
        const preferred =
          available.find((warehouse) => warehouse.id === warehouseFromUrl) ||
          available.find((warehouse) => warehouse.code === "WH-001") ||
          available[0];
        setWarehouses(available);
        setSelectedWarehouseId((current) =>
          available.some((warehouse) => warehouse.id === current)
            ? current
            : preferred?.id || ""
        );
      })
      .catch((error) => {
        logger.error("Failed to load warehouses for route control:", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [admin?.role, admin?.warehouseId, adminLoading, canView, warehouseFromUrl]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId),
    [selectedWarehouseId, warehouses]
  );

  if (adminLoading || loading) {
    return (
      <main className="p-6">
        <div className="flex min-h-[320px] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="p-6">
        <div className="alert alert-error">
          You do not have permission to view live route control.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Server-authoritative warehouse movement
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Live Route Control
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-base-content/60">
            The operational view uses the versioned physical layout, aisle-only
            graph and time reservations shared with worker devices. The former
            browser-only demonstration grid has been removed from this route.
          </p>
        </div>
        <label className="form-control w-full max-w-sm">
          <span className="label-text mb-1 text-xs font-bold uppercase tracking-wide">
            Warehouse
          </span>
          <select
            className="select select-bordered"
            value={selectedWarehouseId}
            onChange={(event) => setSelectedWarehouseId(event.target.value)}
            disabled={
              (admin?.role === "warehouse_manager" &&
                Boolean(admin.warehouseId)) ||
              warehouses.length <= 1
            }
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {selectedWarehouseId ? (
        <WarehouseRouteControlPanel warehouseId={selectedWarehouseId} />
      ) : (
        <div className="alert alert-warning">
          No warehouse is assigned or available for route control.
        </div>
      )}

      {selectedWarehouse ? (
        <p className="text-xs text-base-content/50">
          Active control scope: {selectedWarehouse.code} ·{" "}
          {selectedWarehouse.name}. Algorithm benchmark evidence is generated
          separately from the operational control plane.
        </p>
      ) : null}
    </main>
  );
}
