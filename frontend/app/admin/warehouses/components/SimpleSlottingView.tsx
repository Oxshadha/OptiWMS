"use client";

import type { RackUnit, WarehouseLayout } from "@/lib/types/warehouse-layout";
import { parseRackId } from "@/lib/utils/location-identity";

export function SimpleSlottingView({ layout }: { layout: WarehouseLayout }) {
  const parseRack = (rack: { id: string; zone?: string; aisle?: number; bay?: number }) => {
    const parsed = parseRackId(rack.id);
    const zone = (parsed?.area || rack.zone || "C").toUpperCase();
    const row = Number(parsed?.row ?? rack.aisle ?? 0);
    const bay = Number(parsed?.bay ?? rack.bay ?? 0);
    return {
      zone,
      row,
      bay,
      rowCode: parsed?.row ?? String(row).padStart(2, "0"),
      bayCode: parsed?.bay ?? String(bay).padStart(3, "0"),
    };
  };

  const classColor = (slotClass?: string) => {
    const normalized = (slotClass || "CM").toUpperCase();
    if (normalized.endsWith("F")) {
      return {
        tile: "bg-blue-50 border-blue-300",
        text: "text-blue-800",
      };
    }
    if (normalized.endsWith("S")) {
      return {
        tile: "bg-amber-50 border-amber-300",
        text: "text-amber-900",
      };
    }
    return {
      tile: "bg-base-100 border-base-300",
      text: "text-base-content/80",
    };
  };

  const isDesignedPickZone = (rack: RackUnit) => {
    const zone = parseRack(rack).zone;
    return ["A", "B", "C", "D"].includes(zone) && !rack.isGeneratedOverflow;
  };

  const isReserveOverflow = (rack: RackUnit) => !isDesignedPickZone(rack);

  const grouped = layout.racks
    .filter(isDesignedPickZone)
    .reduce<Record<string, RackUnit[]>>((acc, rack) => {
      const zone = parseRack(rack).zone;
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(rack);
      return acc;
    }, {});

  const reserveOverflowRacks = layout.racks.filter(isReserveOverflow);

  const zoneOrder = Object.keys(grouped).sort();
  const classCount = layout.racks.reduce<Record<string, number>>((acc, rack) => {
    const key = (rack.amalgamatedClass || "CM").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const classOrder = ["AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"];
  const designedRackCount = layout.racks.filter(isDesignedPickZone).length;
  const overflowByZone = reserveOverflowRacks.reduce<Record<string, number>>((acc, rack) => {
    const zone = parseRack(rack).zone;
    acc[zone] = (acc[zone] || 0) + 1;
    return acc;
  }, {});

  const zoneDescription = (zone: string) => {
    if (zone === "A") return "High-access pick face for high-volume and fast-moving SKUs.";
    if (zone === "B") return "Medium-access pallet storage with designated bulk-capable rack positions.";
    if (zone === "C") return "Standard reserve storage for medium and low-velocity SKUs.";
    if (zone === "D") return "Back reserve storage for slow-moving and long-dwell SKUs.";
    return "Storage zone.";
  };

  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-base-content">Storage Class Layout</h3>
        <p className="text-xs text-base-content/60">Warehouse zones grouped by ABC/FMS storage class.</p>
        <p className="mt-1 text-xs text-base-content/70">
          Amalgamated Classes: A* = high-volume products, B* = medium-volume products, C* = low-volume products.
          F = fast-moving, M = medium-moving, S = slow-moving.
        </p>
        <p className="mt-1 text-xs text-base-content/70">
          A-D are primary operational zones. F/G/H/I/J/R are extended reserve zones used for bulk stock cover,
          slow-moving inventory, and future capacity planning.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-800">F = Blue</span>
          <span className="rounded-md border border-base-300 bg-base-100 px-2 py-1 text-base-content/80">M = White/Neutral</span>
          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">S = Yellow</span>
          <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-slate-700">
            Extended reserve: {reserveOverflowRacks.length}
          </span>
          <span className="rounded-md border border-base-300 bg-base-100 px-2 py-1 text-base-content/80">
            Designed A-D: {designedRackCount}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {classOrder.map((slotClass) => (
            <span
              key={slotClass}
              className="rounded-md border border-base-300 bg-base-100 px-2 py-1 text-base-content/80"
            >
              {slotClass}: {classCount[slotClass] || 0}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {zoneOrder.map((zone) => (
          <div key={zone} className="rounded-lg border border-base-300 p-3">
            <div className="mb-2">
              <div className="text-sm font-semibold">Zone {zone}</div>
              <div className="text-xs text-base-content/60">{zoneDescription(zone)}</div>
            </div>
            <div className="space-y-3">
              {Object.entries(
                grouped[zone].reduce<Record<string, typeof layout.racks>>((rows, rack) => {
                  const parsed = parseRack(rack);
                  const key = `${parsed.zone}-${parsed.rowCode}`;
                  if (!rows[key]) rows[key] = [];
                  rows[key].push(rack);
                  return rows;
                }, {})
              )
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([rowKey, racks]) => (
                  <div key={rowKey} className="rounded-md border border-base-300 p-2">
                    <div className="mb-2 text-xs font-semibold text-base-content/70">Row {rowKey}</div>
                    <div className="flex flex-wrap gap-2">
                      {racks
                        .slice()
                        .sort((a, b) => parseRack(a).bay - parseRack(b).bay)
                        .map((rack) => {
                          const colors = classColor(rack.amalgamatedClass);
                          return (
                            <div
                              key={rack.id}
                              className={`min-w-[120px] rounded-md border px-2 py-1 ${colors.tile}`}
                              title={rack.id}
                            >
                              <div className={`text-xs font-mono ${colors.text}`}>{rack.id}</div>
                              <div className={`text-xs ${colors.text}`}>Class: {rack.amalgamatedClass || "CM"}</div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-800">Extended Reserve Capacity</div>
              <div className="text-xs text-slate-600">
                Reserve storage pool for long-dwell, low-velocity, and capacity-balancing stock. Slotting uses this area
                after primary zones are protected for higher-service items.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(overflowByZone)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([zone, count]) => (
                  <span key={zone} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700">
                    Zone {zone}: {count}
                  </span>
                ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {reserveOverflowRacks
              .slice()
              .sort((a, b) => a.id.localeCompare(b.id))
              .slice(0, 72)
              .map((rack) => {
                const colors = classColor(rack.amalgamatedClass);
                return (
                  <div
                    key={rack.id}
                    className={`rounded-md border px-2 py-1 ${colors.tile}`}
                    title={`${rack.id} - extended reserve`}
                  >
                    <div className={`text-xs font-mono ${colors.text}`}>{rack.id}</div>
                    <div className={`text-xs ${colors.text}`}>Class: {rack.amalgamatedClass || "CM"}</div>
                  </div>
                );
              })}
          </div>
          {reserveOverflowRacks.length > 72 && (
            <div className="mt-2 text-xs text-slate-600">
              Showing first 72 of {reserveOverflowRacks.length} reserve racks. Use detailed warehouse layout for the full reserve pool.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
