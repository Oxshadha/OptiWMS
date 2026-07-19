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
    const normalized = (slotClass || "UNASSIGNED").toUpperCase();
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

  const grouped = layout.racks
    .reduce<Record<string, RackUnit[]>>((acc, rack) => {
      const zone = parseRack(rack).zone;
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(rack);
      return acc;
    }, {});

  const zoneOrder = Object.keys(grouped).sort();
  const classCount = layout.racks.reduce<Record<string, number>>((acc, rack) => {
    const key = (rack.amalgamatedClass || "UNASSIGNED").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const classOrder = ["AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"];
  const zoneDescription = (zone: string) => {
    if (zone === "A") return "Fast-pick racks nearest receiving, packing, and dispatch.";
    if (zone === "B") return "Forward pallet storage for high-throughput replenishment.";
    if (zone === "C") return "Bulk raw-material storage with high-capacity lower levels.";
    if (zone === "D") return "Packaging and finished-goods storage for standard flows.";
    if (zone === "E") return "Controlled and special-handling storage with segregated positions.";
    return "Operational storage racks.";
  };

  const racksByClass = classOrder.map((slotClass) => ({
    slotClass,
    racks: layout.racks
      .filter((rack) => (rack.amalgamatedClass || "").toUpperCase() === slotClass)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
  }));

  const classMeaning = (slotClass: string) => {
    const volume = slotClass[0] === "A" ? "High volume" : slotClass[0] === "B" ? "Medium volume" : "Low volume";
    const velocity = slotClass[1] === "F" ? "fast access" : slotClass[1] === "M" ? "standard access" : "deep access";
    return `${volume}, ${velocity}`;
  };

  return (
    <div className="space-y-4 bg-base-100 border border-base-300 p-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="font-semibold text-base-content">Operational Rack Suitability</h3>
          <p className="text-xs text-base-content/60">Every rack is active operational capacity. Classes define which ABC/FMS demand profiles each rack can serve.</p>
        </div>
        <div className="flex gap-4 text-xs text-base-content/70">
          <span><strong>{layout.racks.length}</strong> operational racks</span>
          <span><strong>{Object.keys(classCount).filter((value) => value !== "UNASSIGNED").length}</strong> suitability classes</span>
          <span className={classCount.UNASSIGNED ? "text-error" : "text-success"}>
            <strong>{classCount.UNASSIGNED || 0}</strong> unassigned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {racksByClass.map(({ slotClass, racks }) => {
          const colors = classColor(slotClass);
          return (
            <div key={slotClass} className={`border p-3 ${colors.tile}`}>
              <div className="flex items-center justify-between">
                <span className={`font-mono font-bold ${colors.text}`}>{slotClass}</span>
                <span className="text-lg font-semibold">{racks.length}</span>
              </div>
              <div className="text-xs text-base-content/60">{classMeaning(slotClass)}</div>
              <div className="mt-1 truncate font-mono text-[11px] text-base-content/50" title={racks.map((rack) => rack.id).join(", ")}>
                {racks.slice(0, 4).map((rack) => rack.id).join(" · ") || "No racks assigned"}
                {racks.length > 4 ? ` · +${racks.length - 4}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr><th>Zone</th><th>Operational role</th><th className="text-right">Racks</th><th>Class allocation</th></tr>
          </thead>
          <tbody>
            {zoneOrder.map((zone) => {
              const zoneRacks = grouped[zone];
              const distribution = classOrder
                .map((slotClass) => `${slotClass} ${zoneRacks.filter((rack) => rack.amalgamatedClass === slotClass).length}`)
                .filter((value) => !value.endsWith(" 0"));
              return (
                <tr key={zone}>
                  <td className="font-semibold">Zone {zone}</td>
                  <td className="text-xs text-base-content/70">{zoneDescription(zone)}</td>
                  <td className="text-right">{zoneRacks.length}</td>
                  <td className="font-mono text-xs">{distribution.join(" · ") || "Unassigned"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
