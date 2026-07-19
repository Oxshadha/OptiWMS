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
    const total = Math.max(rack.bins.length, 1);
    return Math.round((occupied / total) * 100);
  };

  return (
    <section className="min-w-0 max-w-full bg-base-100 border border-base-300 p-5 shadow-sm relative">
      <div className="mb-4 flex items-center justify-between gap-6">
        <div>
          <h3 className="text-base font-semibold text-base-content">Operational Rack Plan</h3>
          <p className="mt-1 text-sm text-base-content/60">Metric rack coordinates with complete L1-L5 occupancy and suitability evidence.</p>
        </div>
        <div className="flex shrink-0 gap-5 text-sm text-base-content/70">
          <span><strong className="text-base-content">{layout.racks.length}</strong> racks</span>
          <span><strong className="text-base-content">{layout.racks.reduce((sum, rack) => sum + rack.bins.length, 0)}</strong> bins</span>
        </div>
      </div>

      <div className="h-[760px] min-w-0 max-w-full w-full overflow-auto border border-base-300 bg-base-100">
        <WarehouseLayoutVisualization
          layout={layout}
          onRackClick={onRackClick}
          selectedRackId={selectedRackId}
          showVelocity={showVelocity}
          onVelocityToggle={onToggleVelocity}
        />
      </div>

      <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-base-content">Bulk-Capable Racks</h4>
              <p className="text-sm text-base-content/60 mt-1">
                Dedicated capacity for non-standard handling units
              </p>
            </div>
            <span className="badge bg-base-100 border-base-200 shadow-sm text-base-content/70">
              {bulkRacks.length} rack{bulkRacks.length !== 1 ? "s" : ""}
            </span>
          </div>
          
          {bulkRacks.length > 0 ? (
            <div className="overflow-x-auto border border-base-200 rounded-xl bg-base-100 shadow-sm">
              <table className="table">
                <thead className="bg-base-200/50 text-base-content/70">
                  <tr>
                    <th className="font-medium">Rack ID</th>
                    <th className="font-medium">Physical Zone</th>
                    <th className="font-medium">Class</th>
                    <th className="font-medium">Status</th>
                    <th className="font-medium">Fill</th>
                    <th className="text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRacks.map((rack) => (
                    <tr
                      key={rack.id}
                      className="cursor-pointer hover:bg-base-200/40 transition-colors border-b border-base-200 last:border-0"
                      onClick={() => onRackClick(rack)}
                    >
                      <td className="font-mono text-sm font-medium">{rack.id}</td>
                      <td className="text-sm">{(rack.zone || "-").toUpperCase()}</td>
                      <td className="text-sm">{(rack.amalgamatedClass || "CM").toUpperCase()}</td>
                      <td className="text-sm capitalize">{rack.status.replaceAll("_", " ")}</td>
                      <td className="text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-base-200 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${getRackFill(rack)}%` }} />
                          </div>
                          <span>{getRackFill(rack)}%</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <button
                          className="btn btn-ghost btn-sm text-primary hover:bg-primary/10"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRackClick(rack);
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-base-100 border border-dashed border-base-300 rounded-xl">
              <span className="material-symbols-outlined text-4xl text-base-content/20 mb-2">inventory_2</span>
              <p className="text-sm text-base-content/60">No bulk racks found in current layout.</p>
            </div>
          )}
      </div>

      <div className="flex items-start gap-2 mt-6 p-4 bg-info/5 rounded-xl border border-info/10">
        <span className="material-symbols-outlined text-info text-xl">info</span>
        <p className="text-sm text-base-content/70 leading-relaxed pt-0.5">
          {canEditRacks
            ? "Click an active rack to view levels. Click a reserved/maintenance/out-of-service rack to edit its status."
            : "Click on any rack to view its side elevation and all vertical levels"}
        </p>
      </div>
    </section>
  );
}
