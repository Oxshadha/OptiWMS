import { WarehouseLayoutVisualization } from "@/components/WarehouseLayout";
import type { WarehouseLayout, RackUnit } from "@/lib/types/warehouse-layout";

interface WarehouseLayoutCardProps {
  layout: WarehouseLayout;
  showVelocity: boolean;
  canEditRacks: boolean;
  selectedRackId: string | null;
  onToggleVelocity: (value: boolean) => void;
  onRackClick: (rack: RackUnit) => void;
}

export function WarehouseLayoutCard({
  layout,
  showVelocity,
  canEditRacks,
  selectedRackId,
  onToggleVelocity,
  onRackClick,
}: WarehouseLayoutCardProps) {
  const bulkRacks = layout.racks
    .filter((rack) => {
      if (rack.isBulk) return true;
      const zone = (rack.zone || "").toUpperCase();
      const rackId = (rack.id || "").toUpperCase();
      return zone.includes("BULK") || rackId.startsWith("BULK-") || rackId.startsWith("ZONE-BULK-");
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const getRackFill = (rack: RackUnit): number => {
    const occupied = rack.bins.filter((bin) => bin.status === "occupied" || !!bin.inventory).length;
    const total = Math.max(rack.maxLevels * 2, 1);
    return Math.round((occupied / total) * 100);
  };

  return (
    <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm relative">
      <div className="absolute top-2 right-2 z-20">
        <div className="bg-base-100 rounded-lg shadow-lg border border-base-300 p-2 min-w-[140px]">
          <label className="label cursor-pointer gap-2 py-1">
            <span className="label-text text-xs font-semibold whitespace-nowrap">Velocity Heat Map</span>
            <div 
              onClick={() => onToggleVelocity(!showVelocity)}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer border border-gray-300 ${showVelocity ? "bg-primary" : "bg-gray-400"}`}
              role="switch"
              aria-checked={showVelocity}
            >
              <div 
                className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-sm ${showVelocity ? "translate-x-5" : "translate-x-0"}`}
              />
            </div>
          </label>
          {showVelocity && (
            <div className="mt-2 text-xs text-base-content/60 space-y-1 pt-2 border-t border-base-300">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#38BDF8] flex-shrink-0"></div><span className="text-xs">Low (0-20%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#FBBF24] flex-shrink-0"></div><span className="text-xs">Medium (20-50%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#F43F5E] flex-shrink-0"></div><span className="text-xs">High (50-100%)</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="h-[800px] w-full rounded-lg overflow-x-auto overflow-y-auto border border-base-300">
        <WarehouseLayoutVisualization
          layout={layout}
          onRackClick={onRackClick}
          selectedRackId={selectedRackId}
          showVelocity={showVelocity}
          onVelocityToggle={onToggleVelocity}
        />
      </div>

      <div className="mt-4 rounded-lg border border-base-300 p-3 bg-base-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-base-content">Bulk-Capable Racks</h4>
            <span className="text-xs text-base-content/60">
              {bulkRacks.length} rack{bulkRacks.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-base-content/70 mb-3">
            Dedicated capacity for drums, tanks, reels, and other non-standard handling units within the physical warehouse layout.
          </p>
          {bulkRacks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>Rack</th>
                    <th>Physical zone</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th>Fill</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRacks.map((rack) => (
                    <tr
                      key={rack.id}
                      className="cursor-pointer hover:bg-base-200/60"
                      onClick={() => onRackClick(rack)}
                    >
                      <td className="font-mono">{rack.id}</td>
                      <td>{(rack.zone || "-").toUpperCase()}</td>
                      <td>{(rack.amalgamatedClass || "CM").toUpperCase()}</td>
                      <td className="capitalize">{rack.status.replaceAll("_", " ")}</td>
                      <td>{getRackFill(rack)}%</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRackClick(rack);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-base-content/60 rounded-md border border-dashed border-base-300 p-3">
              No bulk racks found in current warehouse layout.
            </div>
          )}
      </div>

      <div className="flex items-start gap-2 mt-4">
        <span className="material-symbols-outlined text-base-content/60 text-sm mt-0.5">info</span>
        <p className="text-sm text-base-content/70 leading-relaxed">
          {canEditRacks
            ? "Click an active rack to view levels. Click a reserved/maintenance/out-of-service rack to edit its status."
            : "Click on any rack to view its side elevation and all vertical levels"}
        </p>
      </div>
    </div>
  );
}
