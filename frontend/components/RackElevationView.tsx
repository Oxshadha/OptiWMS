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
  // Calculate bin occupancy percentage (based on quantity vs max capacity)
  // Assuming max capacity of 100 units per bin (matches WarehouseLayout.tsx)
  const getBinOccupancy = (bin: LocationBin): number => {
    if (!bin.inventory) return 0;
    const maxCapacity = 100; // Default max capacity per bin
    return Math.min((bin.inventory.quantity / maxCapacity) * 100, 100);
  };

  // Get color based on occupancy percentage (matches WarehouseLayout.tsx and legend)
  const getOccupancyColor = (
    occupancy: number
  ): { color: string; stroke: string } => {
    if (occupancy === 0) {
      return { color: "#F5F5F5", stroke: "#D1D5DB" }; // White/Very Light Gray - Empty
    }
    if (occupancy < 50) {
      return { color: "#22C55E", stroke: "#16A34A" }; // Green - Low (<50%)
    }
    if (occupancy < 85) {
      return { color: "#F59E0B", stroke: "#D97706" }; // Yellow/Amber - Medium (50-85%)
    }
    return { color: "#1E3A8A", stroke: "#1E40AF" }; // Dark Blue/Indigo - High (>85%)
  };

  // Map bin status to colors (matches WarehouseLayout.tsx level segments exactly)
  // If rack is in maintenance/out_of_service, ALL bins show rack status color (rack is empty)
  // Reserved bins use Safety Blue (special status)
  // Occupied bins use occupancy-based colors
  const getBinColor = (bin: LocationBin): string => {
    // If rack is in maintenance or out_of_service, ALL levels show rack status color
    if (rack.status === "maintenance") {
      return "#FF6B35"; // Safety Orange - Maintenance warning
    } else if (rack.status === "out_of_service") {
      return "#DC2626"; // Safety Red - Stop/Danger
    }

    // Reserved bins use Safety Blue (special status takes priority)
    if (bin.status === "reserved" && bin.inventory) {
      return "#4A90E2"; // Safety Blue - matches legend
    }

    // Calculate occupancy for occupied bins
    const occupancy = getBinOccupancy(bin);
    const occupancyColors = getOccupancyColor(occupancy);
    return occupancyColors.color;
  };

  const getBinBorderColor = (bin: LocationBin): string => {
    // If rack is in maintenance or out_of_service, ALL levels show rack status border
    if (rack.status === "maintenance") {
      return "#C2410C"; // Darker orange border
    } else if (rack.status === "out_of_service") {
      return "#991B1B"; // Darker red border
    }

    // Reserved bins use Safety Blue border
    if (bin.status === "reserved" && bin.inventory) {
      return "#2563EB"; // Dark blue border - matches map
    }

    // Calculate occupancy for occupied bins
    const occupancy = getBinOccupancy(bin);
    const occupancyColors = getOccupancyColor(occupancy);
    return occupancyColors.stroke;
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

  // Create array of all levels from top (maxLevels) to bottom (1)
  // This ensures all levels are shown, matching the warehouse layout visualization
  const allLevels: (LocationBin | null)[] = [];
  for (let level = rack.maxLevels; level >= 1; level--) {
    const bin = rack.bins.find((b) => b.level === level);
    allLevels.push(bin || null);
  }

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
              {rack.bay.toString().padStart(3, "0")}
            </p>
            {rack.description && (
              <p className="text-sm text-base-content/80 mt-1 italic">
                {rack.description}
              </p>
            )}
            {rack.status !== "active" && (
              <p className="text-sm mt-1">
                <span
                  className={`badge badge-sm ${
                    rack.status === "maintenance"
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
          <div className="flex flex-col gap-1.5">
            {allLevels.map((binOrNull, index) => {
              const level = rack.maxLevels - index; // Calculate actual level (from top)

              // If bin doesn't exist for this level, create a placeholder
              const bin: LocationBin = binOrNull || {
                id: `${rack.id}-L${level}-EMPTY`,
                level,
                status: "empty",
              };
              const isRecent = hasRecentReceipt(bin);

              // Ensure bin status is correctly determined based on actual inventory
              // If bin has no inventory, it should be empty regardless of status field
              // However, if rack is in maintenance/out_of_service, empty bins show rack status
              // This ensures side elevation matches what's shown in the map
              const isEmpty = !bin.inventory;
              const actualStatus: "empty" | "occupied" | "reserved" =
                bin.inventory
                  ? bin.status === "reserved"
                    ? "reserved"
                    : "occupied"
                  : "empty";

              const displayBin: LocationBin = {
                ...bin,
                status: actualStatus,
              };

              // Check if empty bin should show rack status
              const isEmptyAndRackInSpecialStatus =
                isEmpty &&
                (rack.status === "maintenance" ||
                  rack.status === "out_of_service");

              return (
                <div
                  key={bin.id}
                  className={clsx(
                    "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                    "hover:shadow-lg",
                    isRecent && "animate-pulse"
                  )}
                  style={{
                    backgroundColor: getBinColor(displayBin),
                    borderColor: getBinBorderColor(displayBin),
                    opacity: getBinOpacity(displayBin),
                    boxShadow:
                      "0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)",
                    transform: "translateY(-1px)",
                  }}
                  onClick={() => onBinClick?.(displayBin)}
                >
                  {/* Level indicator */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="text-xs font-bold text-base-content">
                      Level {bin.level}
                    </div>
                    <div className="text-xs text-base-content/70">
                      {bin.id.includes("EMPTY")
                        ? "No Bin"
                        : bin.id.split("-").pop()}
                    </div>
                  </div>

                  {/* Status badge and Occupancy */}
                  <div className="flex-shrink-0 flex flex-row items-center gap-3">
                    <span
                      className={clsx(
                        "badge badge-sm",
                        displayBin.status === "occupied"
                          ? "badge-success"
                          : displayBin.status === "reserved"
                          ? "badge-info"
                          : isEmptyAndRackInSpecialStatus
                          ? rack.status === "maintenance"
                            ? "badge-warning"
                            : "badge-error"
                          : "badge-ghost"
                      )}
                    >
                      {isEmptyAndRackInSpecialStatus
                        ? rack.status === "maintenance"
                          ? "🔧 Maintenance"
                          : "⚠ Out of Service"
                        : displayBin.status}
                    </span>
                    {/* Occupancy percentage - fixed width for alignment */}
                    <div className="text-center w-12">
                      <div
                        className="text-base font-bold"
                        style={{
                          color: displayBin.inventory
                            ? displayBin.status === "reserved"
                              ? "#2563EB"
                              : getOccupancyColor(getBinOccupancy(displayBin))
                                  .stroke
                            : isEmptyAndRackInSpecialStatus
                            ? "#FFFFFF"
                            : "#6B7280",
                        }}
                      >
                        {getBinOccupancy(displayBin).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Inventory info */}
                  {displayBin.inventory && (
                    <div className="flex-1 flex items-center gap-4 text-sm ml-4">
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs"
                          style={{
                            color:
                              displayBin.status === "reserved" ||
                              getBinOccupancy(displayBin) >= 85
                                ? "rgba(255,255,255,0.8)"
                                : "rgba(0,0,0,0.7)",
                          }}
                        >
                          SKU
                        </div>
                        <div
                          className="font-semibold truncate"
                          style={{
                            color:
                              displayBin.status === "reserved" ||
                              getBinOccupancy(displayBin) >= 85
                                ? "#FFFFFF"
                                : "#1F2937",
                          }}
                        >
                          {displayBin.inventory.sku}
                        </div>
                      </div>
                      <div className="flex-1 text-center">
                        <div
                          className="text-xs"
                          style={{
                            color:
                              displayBin.status === "reserved" ||
                              getBinOccupancy(displayBin) >= 85
                                ? "rgba(255,255,255,0.8)"
                                : "rgba(0,0,0,0.7)",
                          }}
                        >
                          Qty
                        </div>
                        <div
                          className="font-semibold"
                          style={{
                            color:
                              displayBin.status === "reserved" ||
                              getBinOccupancy(displayBin) >= 85
                                ? "#FFFFFF"
                                : "#1F2937",
                          }}
                        >
                          {displayBin.inventory.quantity}
                        </div>
                      </div>
                      <div className="flex-1 text-center">
                        <div
                          className="text-xs"
                          style={{
                            color:
                              displayBin.status === "reserved" ||
                              getBinOccupancy(displayBin) >= 85
                                ? "rgba(255,255,255,0.8)"
                                : "rgba(0,0,0,0.7)",
                          }}
                        >
                          Weight
                        </div>
                        <div
                          className="font-semibold"
                          style={{
                            color:
                              displayBin.status === "reserved" ||
                              getBinOccupancy(displayBin) >= 85
                                ? "#FFFFFF"
                                : "#1F2937",
                          }}
                        >
                          {displayBin.inventory.weight} kg
                        </div>
                      </div>
                      {/* Recent receipt indicator - fixed width to maintain alignment */}
                      <div className="flex-shrink-0 w-12 flex justify-center">
                        {hasRecentReceipt(displayBin) && (
                          <span className="badge badge-warning badge-sm">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!displayBin.inventory && (
                    <div
                      className="flex-1 text-xs italic"
                      style={{
                        color: isEmptyAndRackInSpecialStatus
                          ? "#FFFFFF"
                          : "rgba(0,0,0,0.5)",
                      }}
                    >
                      {isEmptyAndRackInSpecialStatus
                        ? rack.status === "maintenance"
                          ? "🔧 Empty - Rack Under Maintenance"
                          : "⚠ Empty - Rack Out of Service"
                        : "Empty (0% occupancy)"}
                    </div>
                  )}
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
              {rack.bins.filter((b) => b.status === "empty").length}
            </div>
            <div className="text-xs text-base-content/70">Empty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
