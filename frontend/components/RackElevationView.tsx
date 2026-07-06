"use client";

import { RackUnit, LocationBin } from "@/lib/types/warehouse-layout";
import { binPalletFillPercent, levelBeamLabel } from "@/lib/utils/bin-occupancy";
import clsx from "clsx";

interface RackElevationViewProps {
  rack: RackUnit;
  onClose: () => void;
  onBinClick?: (bin: LocationBin) => void;
  onEdit?: () => void;
}

/**
 * Side-Elevation View Component
 * Shows the rack from the front, displaying all vertical levels
 */
export function RackElevationView({
  rack,
  onClose,
  onBinClick,
  onEdit,
}: RackElevationViewProps) {
  const positions = Array.from(
    new Set(
      rack.bins
        .map((bin) => (bin.id.split("-").pop() || "").toUpperCase())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const visiblePositions = positions.length > 0 ? positions : ["A", "B"];

  const getBinOccupancy = (bin: LocationBin): number => binPalletFillPercent(bin);

  // Map bin status to colors (matches WarehouseLayout.tsx level segments exactly)
  // If rack is in maintenance/out_of_service, ALL bins show rack status color (rack is empty)
  // Reserved bins use cyan special-status color
  // Occupied bins use occupancy-based colors
  const getBinColor = (bin: LocationBin): string => {
    // If rack is in maintenance or out_of_service, ALL levels show rack status color
    if (rack.status === "maintenance") {
      return "#FFEDD5"; // Orange tint
    } else if (rack.status === "out_of_service") {
      return "#FEE2E2"; // Dull red tint
    }

    // Reserved bins use cyan (special status takes priority)
    if (bin.status === "reserved") {
      return "#E0F2FE"; // Soft cyan tint
    }

    // Quarantined bins use purple
    if (bin.status === "quarantined") {
      return "#9333EA";
    }

    // Capacity-based fill colors (Slate Gray scale)
    const occupancy = getBinOccupancy(bin);
    if (occupancy === 0) return "#F8FAFC"; // Slate 50
    if (occupancy < 50) return "#CBD5E1"; // Slate 300
    if (occupancy < 85) return "#64748B"; // Slate 500
    return "#1E293B"; // Slate 900
  };

  const getBinBorderColor = (bin: LocationBin): string => {
    // If rack is in maintenance or out_of_service, ALL levels show rack status border
    if (rack.status === "maintenance") {
      return "#F97316"; // Orange
    } else if (rack.status === "out_of_service") {
      return "#DC2626"; // Red
    }

    // Reserved bins use cyan border
    if (bin.status === "reserved") {
      return "#0284C7";
    }

    if (bin.status === "quarantined") {
      return "#7C3AED";
    }

    const occupancy = getBinOccupancy(bin);
    if (occupancy === 0) return "#CBD5E1"; // Slate 300
    if (occupancy < 50) return "#94A3B8"; // Slate 400
    if (occupancy < 85) return "#475569"; // Slate 600
    return "#0F172A"; // Slate 950
  };

  const getBinOpacity = (bin: LocationBin): number => {
    // Use full opacity for readability in side elevation (map uses 0.6 for overlay effect)
    return 1;
  };

  const isDarkBin = (bin: LocationBin): boolean => {
    if (rack.status === "out_of_service" || rack.status === "maintenance") return false;
    const occupancy = getBinOccupancy(bin);
    return occupancy >= 50 || bin.status === "quarantined"; // Slate 500+ is dark
  };

  const hasRecentReceipt = (bin: LocationBin): boolean => {
    if (!bin.inventory?.receivedAt) return false;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    return new Date(bin.inventory.receivedAt).getTime() > oneHourAgo;
  };

  const allLevels = Array.from({ length: rack.maxLevels }, (_, idx) => rack.maxLevels - idx);
  const binForLevelPosition = (level: number, position: string): LocationBin => {
    const found = rack.bins.find(
      (b) =>
        b.level === level &&
        ((b.id.split("-").pop() || "").toUpperCase() === position)
    );
    if (found) return found;
    return {
      id: `${rack.id}-${level}-${position}`,
      level,
      status: "empty",
    };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="card-surface p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-base-content">
              Rack: {rack.id}
            </h2>
            <p className="text-sm text-base-content/70 mt-1">
              Zone: {rack.zone} | Aisle:{" "}
              {rack.aisle.toString().padStart(2, "0")} | Bay:{" "}
              {rack.bay.toString().padStart(2, "0")}
            </p>
            {rack.description && (
              <p className="text-sm text-base-content/80 mt-1 italic">
                {rack.description}
              </p>
            )}
            {rack.status !== "active" && (
              <p className="text-sm mt-1">
                <span
                  className={`badge badge-sm ${rack.status === "maintenance"
                    ? "badge-warning"
                    : rack.status === "out_of_service"
                      ? "badge-error"
                      : "badge-info"
                    }`}
                >
                  {rack.status.replace("_", " ").toUpperCase()}
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="btn btn-sm btn-primary"
                aria-label="Edit Rack"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit Rack
              </button>
            )}
            <button
              onClick={onClose}
              className="btn btn-circle btn-sm btn-ghost"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Elevation View */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">
            Side Elevation View (Top to Bottom)
          </h3>
          {rack.status !== "active" && (
            <div className={`alert mb-3 py-2 ${rack.status === "out_of_service" ? "alert-error" : "alert-warning"}`}>
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-sm">
                This rack is currently <strong>{rack.status.replace("_", " ")}</strong>. Bin interactions are disabled until status is Active.
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {allLevels.map((level) => {
              const levelBins = rack.bins.filter((b) => b.level === level);
              const beamBin = levelBins.find((b) => b.levelWeightCapacityKg != null) ?? levelBins[0];
              const beamLabel = beamBin ? levelBeamLabel(beamBin) : null;
              const beamPct = beamBin?.levelWeightCapacityKg
                ? Math.min(
                    ((beamBin.levelWeightUsedKg ?? 0) / beamBin.levelWeightCapacityKg) * 100,
                    100
                  )
                : 0;
              return (
                <div key={`${rack.id}-${level}`} className="rounded-lg border border-base-300 bg-base-100 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs font-bold">Level {level}</div>
                    {beamLabel && (
                      <div className="text-[10px] text-base-content/70">{beamLabel}</div>
                    )}
                  </div>
                  {beamLabel && (
                    <div className="mb-2 h-1.5 rounded-full bg-base-200 overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full",
                          beamPct >= 90 ? "bg-error" : beamPct >= 70 ? "bg-warning" : "bg-primary"
                        )}
                        style={{ width: `${beamPct}%` }}
                      />
                    </div>
                  )}
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${visiblePositions.length}, minmax(0, 1fr))` }}
                  >
                    {visiblePositions.map((position) => {
                      const displayBin = binForLevelPosition(level, position);
                      const isSpecial =
                        !displayBin.inventory &&
                        (rack.status === "maintenance" || rack.status === "out_of_service");
                      return (
                        <div
                          key={displayBin.id}
                          className={clsx(
                            "rounded-lg border p-2",
                            rack.status === "active" ? "cursor-pointer" : "cursor-not-allowed"
                          )}
                          style={{
                            backgroundColor: getBinColor(displayBin),
                            borderColor: getBinBorderColor(displayBin),
                            opacity: getBinOpacity(displayBin),
                          }}
                          onClick={() => {
                            if (rack.status !== "active") return;
                            onBinClick?.(displayBin);
                          }}
                        >
                          {(() => {
                            const darkBin = isDarkBin(displayBin);
                            const textClass = darkBin ? "text-white" : "text-base-content";
                            const mutedTextClass = darkBin ? "text-white/80" : "text-base-content/60";
                            const statusLabel = displayBin.inventory
                              ? "in use"
                              : isSpecial
                              ? rack.status.replace("_", " ")
                              : "empty";
                            const statusBadgeClass = displayBin.inventory
                              ? darkBin
                                ? "bg-white/20 text-white border border-white/40"
                                : "bg-success/15 text-success border border-success/50"
                              : isSpecial
                              ? "bg-base-100/70 text-base-content border border-base-300"
                              : "bg-base-100 text-base-content/70 border border-base-300";

                            return (
                              <>
                          <div className="flex items-center justify-between">
                            <span className="badge badge-ghost badge-sm">Bin {position}</span>
                            <span className={clsx("badge badge-sm capitalize", statusBadgeClass)}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className={clsx("mt-2 text-xs", textClass)}>
                            {displayBin.inventory ? (
                              <>
                                <div className="font-semibold truncate">{displayBin.inventory.sku}</div>
                                <div>Qty: {Math.ceil(displayBin.inventory.quantity || 0)}</div>
                                <div>Pallets: {displayBin.palletCount ?? 1}/{displayBin.maxPalletCapacity ?? 1}</div>
                                <div>Fill: {Math.round(getBinOccupancy(displayBin))}%</div>
                                <div>Weight: {Math.round(displayBin.inventory.weight || 0)} kg</div>
                                {hasRecentReceipt(displayBin) && <span className="badge badge-warning badge-xs mt-1">New</span>}
                              </>
                            ) : (
                              <div className={mutedTextClass}>No stock</div>
                            )}
                          </div>
                              </>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-base-300">
          <div className="text-center">
            <div className="text-2xl font-bold text-base-content">
              {rack.bins.filter((b) => b.status === "occupied").length}
            </div>
            <div className="text-xs text-base-content/70">Occupied</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-base-content">
              {rack.bins.filter((b) => b.status === "reserved").length}
            </div>
            <div className="text-xs text-base-content/70">Reserved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-base-content">
              {Math.max(rack.maxLevels * visiblePositions.length - rack.bins.filter((b) => b.status === "occupied" || b.inventory).length, 0)}
            </div>
            <div className="text-xs text-base-content/70">Empty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
