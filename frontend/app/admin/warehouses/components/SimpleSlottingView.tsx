"use client";

import type { WarehouseLayout } from "@/lib/types/warehouse-layout";

export function SimpleSlottingView({ layout }: { layout: WarehouseLayout }) {
  const grouped = layout.racks.reduce<Record<string, typeof layout.racks>>((acc, rack) => {
    const zone = (rack.zone || "C").toUpperCase();
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(rack);
    return acc;
  }, {});

  const zoneOrder = Object.keys(grouped).sort();

  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-base-content">Simple Slotting Layout</h3>
        <p className="text-xs text-base-content/60">High-level view by zone and slotting class (no detailed bay UI).</p>
      </div>
      <div className="space-y-4">
        {zoneOrder.map((zone) => (
          <div key={zone} className="rounded-lg border border-base-300 p-3">
            <div className="text-sm font-semibold mb-2">Zone {zone}</div>
            <div className="flex flex-wrap gap-2">
              {grouped[zone]
                .slice()
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((rack) => (
                  <div
                    key={rack.id}
                    className="min-w-[120px] rounded-md border border-base-300 bg-base-200 px-2 py-1"
                    title={rack.id}
                  >
                    <div className="text-xs font-mono">{rack.id}</div>
                    <div className="text-xs text-base-content/70">Class: {rack.amalgamatedClass || "CM"}</div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
