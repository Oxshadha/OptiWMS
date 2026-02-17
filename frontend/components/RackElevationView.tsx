"use client";

import { RackUnit, LocationBin } from "@/lib/types/warehouse-layout";
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
  const POSITIONS: Array<"A" | "B"> = ["A", "B"];

  // Map bin status to colors (matches WarehouseLayout.tsx level segments exactly)
  // If rack is in maintenance/out_of_service, ALL bins show rack status color (rack is empty)
  // Reserved bins use cyan special-status color
  // Occupied bins use occupancy-based colors
  const getBinColor = (bin: LocationBin): string => {
    // If rack is in maintenance or out_of_service, ALL levels show rack status color
    if (rack.status === "maintenance") {
      return "#FEF3C7"; // Yellow/amber tint
    } else if (rack.status === "out_of_service") {
      return "#FEE2E2"; // Dull red tint
    }

    // Reserved bins use cyan (special status takes priority)
    if (bin.status === "reserved") {
      return "#E0F2FE"; // Soft cyan tint
    }

    // Calculate occupancy for occupied bins
    return bin.inventory ? "#22C55E" : "#F5F5F5";
  };

  const getBinBorderColor = (bin: LocationBin): string => {
    // If rack is in maintenance or out_of_service, ALL levels show rack status border
    if (rack.status === "maintenance") {
      return "#D97706";
    } else if (rack.status === "out_of_service") {
      return "#DC2626";
    }

    // Reserved bins use cyan border
    if (bin.status === "reserved") {
      return "#0284C7";
    }

    // Calculate occupancy for occupied bins
    return bin.inventory ? "#16A34A" : "#D1D5DB";
  };

  const getBinOpacity = (bin: LocationBin): number => {
    // Use full opacity for readability in side elevation (map uses 0.6 for overlay effect)
    return 1;
  };

  const hasRecentReceipt = (bin: LocationBin): boolean => {
    if (!bin.inventory?.receivedAt) return false;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    return new Date(bin.inventory.receivedAt).getTime() > oneHourAgo;
  };

  const allLevels = Array.from({ length: rack.maxLevels }, (_, idx) => rack.maxLevels - idx);
  const binForLevelPosition = (level: number, position: "A" | "B"): LocationBin => {
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
              return (
                <div key={`${rack.id}-${level}`} className="rounded-lg border border-base-300 bg-base-100 p-3">
                  <div className="text-xs font-bold mb-2">Level {level}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {POSITIONS.map((position) => {
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
                          <div className="flex items-center justify-between">
                            <span className="badge badge-ghost badge-sm">Bin {position}</span>
                            <span className={clsx("badge badge-sm", displayBin.inventory ? "badge-success" : "badge-ghost")}>
                              {displayBin.inventory ? "occupied" : isSpecial ? rack.status.replace("_", " ") : "empty"}
                            </span>
                          </div>
                          <div className="mt-2 text-xs">
                            {displayBin.inventory ? (
                              <>
                                <div className="font-semibold truncate">{displayBin.inventory.sku}</div>
                                <div>Qty: {Math.ceil(displayBin.inventory.quantity || 0)}</div>
                                <div>Weight: {displayBin.inventory.weight} kg</div>
                                {hasRecentReceipt(displayBin) && <span className="badge badge-warning badge-xs mt-1">New</span>}
                              </>
                            ) : (
                              <div className="text-base-content/60">No stock</div>
                            )}
                          </div>
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
              {Math.max(rack.maxLevels * 2 - rack.bins.filter((b) => b.status === "occupied" || b.inventory).length, 0)}
            </div>
            <div className="text-xs text-base-content/70">Empty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
