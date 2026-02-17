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
  return (
    <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm relative">
      <div className="absolute top-2 right-2 z-20">
        <div className="bg-base-100 rounded-lg shadow-lg border border-base-300 p-2 min-w-[140px]">
          <label className="label cursor-pointer gap-2 py-1">
            <span className="label-text text-xs font-semibold whitespace-nowrap">Velocity Heat Map</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={showVelocity}
              onChange={(event) => onToggleVelocity(event.target.checked)}
            />
          </label>
          {showVelocity && (
            <div className="mt-2 text-xs text-base-content/60 space-y-1 pt-2 border-t border-base-300">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#22C55E] flex-shrink-0"></div><span className="text-xs">Low (0-20%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#F59E0B] flex-shrink-0"></div><span className="text-xs">Medium (20-50%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#DC2626] flex-shrink-0"></div><span className="text-xs">High (50-100%)</span></div>
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
