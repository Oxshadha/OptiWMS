"use client";

import type { WarehouseLayout } from "@/lib/types/warehouse-layout";

export function SimpleSlottingView({ layout }: { layout: WarehouseLayout }) {
  const parseRack = (rack: { id: string; zone?: string; aisle?: number; bay?: number }) => {
    const m = rack.id.match(/^([A-Z]+)-(\d+)-(\d+)$/);
    const zone = (m?.[1] || rack.zone || "C").toUpperCase();
    const row = Number(m?.[2] ?? rack.aisle ?? 0);
    const bay = Number(m?.[3] ?? rack.bay ?? 0);
    return {
      zone,
      row,
      bay,
      rowCode: String(row).padStart(2, "0"),
      bayCode: String(bay).padStart(3, "0"),
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

  const grouped = layout.racks.reduce<Record<string, typeof layout.racks>>((acc, rack) => {
    const zone = parseRack(rack).zone;
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(rack);
    return acc;
  }, {});

  const zoneOrder = Object.keys(grouped).sort();
  const classCount = layout.racks.reduce<Record<string, number>>((acc, rack) => {
    const key = (rack.amalgamatedClass || "CM").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const classOrder = ["AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"];

  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-base-content">Simple Slotting Layout</h3>
        <p className="text-xs text-base-content/60">High-level view by zone and slotting class (no detailed bay UI).</p>
        <p className="mt-1 text-xs text-base-content/70">
          Amalgamated Classes: A* = high-volume products, B* = medium-volume products, C* = low-volume products.
          F = fast-moving, M = medium-moving, S = slow-moving.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-800">F = Blue</span>
          <span className="rounded-md border border-base-300 bg-base-100 px-2 py-1 text-base-content/80">M = White/Neutral</span>
          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">S = Yellow</span>
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
            <div className="text-sm font-semibold mb-2">Zone {zone}</div>
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
      </div>
    </div>
  );
}
