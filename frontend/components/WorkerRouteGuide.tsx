"use client";

import { useMemo } from "react";
import { WarehouseRouteMap } from "@/components/WarehouseRouteMap";
import {
  RouteOperation,
  buildRouteInstruction,
  optimizeWarehouseRoute,
  parseRouteLocation,
} from "@/lib/warehouse-routing";

interface WorkerRouteGuideProps {
  warehouseId?: string;
  targetLocationCode?: string | null;
  targetLocationCodes?: Array<string | null | undefined>;
  completedLocationCodes?: Array<string | null | undefined>;
  operationType: RouteOperation;
}

export function WorkerRouteGuide({
  targetLocationCode,
  targetLocationCodes,
  completedLocationCodes = [],
  operationType,
}: WorkerRouteGuideProps) {
  const locationCodes = useMemo(
    () => (targetLocationCodes?.length ? targetLocationCodes : [targetLocationCode]),
    [targetLocationCode, targetLocationCodes]
  );
  const route = useMemo(
    () =>
      optimizeWarehouseRoute({
        operation: operationType,
        locationCodes,
        completedLocationCodes,
      }),
    [completedLocationCodes, locationCodes, operationType]
  );

  const targetCount = locationCodes.filter(Boolean).length;
  if (targetCount === 0) return null;

  const unroutable = locationCodes.filter((locationCode) => locationCode && !parseRouteLocation(locationCode));

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-3 mt-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <div className="text-sm font-semibold">Shortest Route</div>
          <div className="text-xs text-base-content/60">
            {operationType === "putaway" ? "Inbound wait zone to storage rack" : "Forklift park to picks, then packing"}
          </div>
        </div>
        <span className="badge badge-outline">{operationType === "putaway" ? "Putaway" : "Picking"}</span>
      </div>

      {unroutable.length > 0 && (
        <div className="alert alert-warning py-2 text-xs mb-3">
          <span>Some locations do not match synthetic Zone A/B/C coordinates yet.</span>
        </div>
      )}

      {!route ? (
        <div className="text-xs text-base-content/60">No routable remaining location selected.</div>
      ) : (
        <div className="space-y-3">
          <WarehouseRouteMap
            route={route}
            activeLocationCode={route.orderedStops[0]?.raw}
            completedLocationCodes={completedLocationCodes}
            detail="worker"
          />
          <div className="grid grid-cols-1 gap-2">
            {buildRouteInstruction(route).map((step, index) => (
              <div key={step} className="flex gap-2 rounded-lg bg-base-200 px-3 py-2 text-xs leading-relaxed">
                <span className="font-bold text-primary">{index + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
