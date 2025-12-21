"use client";

import { useState, useMemo, useEffect } from "react";
import clsx from "clsx";
import {
  WarehouseLayout,
  RackUnit,
  LocationBin,
} from "@/lib/types/warehouse-layout";
import { analyticsApi, LocationVelocity } from "@/lib/api/analytics";

interface WarehouseLayoutProps {
  layout: WarehouseLayout;
  onRackClick?: (rack: RackUnit) => void;
  selectedRackId?: string | null;
}

/**
 * SVG-based Warehouse Layout Visualization Component
 * Displays racks with vertical level occupancy using opacity stacking
 */
export function WarehouseLayoutVisualization({
  layout,
  onRackClick,
  selectedRackId,
}: WarehouseLayoutProps) {
  const [hoveredRackId, setHoveredRackId] = useState<string | null>(null);
  const [showVelocity, setShowVelocity] = useState(false);
  const [velocityData, setVelocityData] = useState<Map<string, number>>(
    new Map()
  );
  const [isLoadingVelocity, setIsLoadingVelocity] = useState(false);

  // Load velocity data when velocity mode is enabled
  useEffect(() => {
    if (showVelocity && layout.warehouseId) {
      const loadVelocityData = async () => {
        setIsLoadingVelocity(true);
        try {
          // Calculate date range (last 7 days)
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);

          // Try to load from API
          try {
            const velocities = await analyticsApi.getLocationVelocity(
              layout.warehouseId,
              startDate.toISOString().split("T")[0],
              endDate.toISOString().split("T")[0]
            );

            // Create a map of location code to velocity
            const velocityMap = new Map<string, number>();
            velocities.forEach((v) => {
              velocityMap.set(v.locationCode, v.velocityPercentage);
            });
            setVelocityData(velocityMap);
          } catch (error) {
            // If API fails, use mock data for demonstration
            console.log("Velocity API not available, using mock data");
            const mockVelocityData = generateMockVelocityData(layout.racks);
            setVelocityData(mockVelocityData);
          }
        } catch (error) {
          console.error("Error loading velocity data:", error);
          // Fallback to mock data
          const mockVelocityData = generateMockVelocityData(layout.racks);
          setVelocityData(mockVelocityData);
        } finally {
          setIsLoadingVelocity(false);
        }
      };

      loadVelocityData();
    }
  }, [showVelocity, layout.warehouseId, layout.racks]);

  // Generate mock velocity data for demonstration
  const generateMockVelocityData = (racks: RackUnit[]): Map<string, number> => {
    const velocityMap = new Map<string, number>();
    racks.forEach((rack) => {
      // Generate random velocity between 0-100% for demo
      // In production, this would come from actual pick/putaway data
      const velocity = Math.floor(Math.random() * 100);
      velocityMap.set(rack.id, velocity);
    });
    return velocityMap;
  };

  // Merge velocity data into racks
  const racksWithVelocity = useMemo(() => {
    if (!showVelocity || velocityData.size === 0) {
      return layout.racks;
    }
    return layout.racks.map((rack) => {
      const velocity = velocityData.get(rack.id);
      return {
        ...rack,
        velocity: velocity !== undefined ? velocity : undefined,
      };
    });
  }, [layout.racks, showVelocity, velocityData]);

  // Calculate occupancy percentage for a rack
  const getRackOccupancy = (rack: RackUnit): number => {
    const occupiedBins = rack.bins.filter((bin) => bin.status === "occupied");
    return (occupiedBins.length / rack.bins.length) * 100;
  };

  // Get color based on velocity (for heat map mode)
  const getVelocityColor = (velocity?: number): string => {
    if (velocity === undefined || velocity === null) return "#F5F5F5"; // Default gray for no data
    if (velocity < 20) return "#22C55E"; // Green - Low velocity (0-20%)
    if (velocity < 50) return "#F59E0B"; // Yellow - Medium velocity (20-50%)
    return "#DC2626"; // Red - High velocity (50-100%)
  };

  // Get color based on occupancy and status
  // Uses industrial safety standards and accessibility principles
  const getRackColor = (rack: RackUnit): string => {
    // Special status colors (industrial safety standards) - take priority
    if (rack.status === "out_of_service") return "#DC2626"; // Safety Red - Stop/Danger
    if (rack.status === "maintenance") return "#FF6B35"; // Safety Orange - Maintenance warning
    if (rack.status === "reserved") return "#4A90E2"; // Safety Blue - Set aside/trustworthy

    // If velocity mode is enabled, use velocity colors
    if (showVelocity && rack.velocity !== undefined) {
      return getVelocityColor(rack.velocity);
    }

    // Occupancy-based colors for active racks (light-to-dark progression, color-blind friendly)
    const occupancy = getRackOccupancy(rack);
    if (occupancy === 0) return "#F5F5F5"; // White/Very Light Gray - Empty/available
    if (occupancy < 50) return "#22C55E"; // Green - Go/high availability
    if (occupancy < 85) return "#F59E0B"; // Yellow/Amber - Cautionary/transitional
    return "#1E3A8A"; // Dark Blue/Indigo - Heavy/high density (receding color)
  };

  // Check if rack has recently received items (for pulsing animation)
  const hasRecentReceipts = (rack: RackUnit): boolean => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    return rack.bins.some(
      (bin) =>
        bin.status === "occupied" &&
        bin.inventory?.receivedAt &&
        new Date(bin.inventory.receivedAt).getTime() > oneHourAgo
    );
  };

  // Calculate bin occupancy percentage (based on quantity vs max capacity)
  // Assuming max capacity of 100 units per bin (can be made configurable)
  const getBinOccupancy = (bin: LocationBin | undefined): number => {
    if (!bin || !bin.inventory) return 0;
    const maxCapacity = 100; // Default max capacity per bin
    return Math.min((bin.inventory.quantity / maxCapacity) * 100, 100);
  };

  // Get color based on occupancy percentage (matches legend)
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

  // Get level segments for visual representation
  const getLevelSegments = (rack: RackUnit) => {
    const segments = [];
    const segmentHeight = rack.height / rack.maxLevels;

    for (let level = 1; level <= rack.maxLevels; level++) {
      const bin = rack.bins.find((b) => b.level === level);
      // Check actual bin status - if no inventory, it's empty regardless of status field
      const hasInventory = bin?.inventory !== undefined;
      const isReserved = hasInventory && bin?.status === "reserved";
      const isEmpty = !hasInventory || bin?.status === "empty";

      // Calculate occupancy percentage for occupied bins
      const occupancy = getBinOccupancy(bin);

      segments.push({
        level,
        y: rack.y + (level - 1) * segmentHeight,
        height: segmentHeight,
        isOccupied: hasInventory && bin?.status === "occupied",
        isReserved,
        isEmpty,
        bin,
        occupancy,
      });
    }

    return segments;
  };

  return (
    <div className="w-full h-full relative">
      {/* Velocity Toggle Button */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-base-100 rounded-lg shadow-lg border border-base-300 p-2">
          <label className="label cursor-pointer gap-2">
            <span className="label-text text-sm font-semibold">
              Velocity Heat Map
            </span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={showVelocity}
              onChange={(e) => setShowVelocity(e.target.checked)}
            />
          </label>
          {showVelocity && (
            <div className="mt-2 text-xs text-base-content/60 space-y-1">
              {isLoadingVelocity ? (
                <div className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-xs"></span>
                  <span>Loading velocity data...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#22C55E]"></div>
                    <span>Low (0-20%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#F59E0B]"></div>
                    <span>Medium (20-50%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#DC2626]"></div>
                    <span>High (50-100%)</span>
                  </div>
                  {velocityData.size === 0 && (
                    <div className="text-xs text-warning mt-1">
                      No velocity data available
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full h-full border border-base-300 rounded-lg bg-base-200"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Define patterns for maintenance status */}
        <defs>
          <pattern
            id="maintenance-pattern"
            x="0"
            y="0"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="#C2410C"
              strokeWidth="1.5"
              opacity="0.4"
            />
          </pattern>
        </defs>
        {/* Render aisles */}
        {layout.aisles.map((aisle) => (
          <rect
            key={aisle.id}
            x={aisle.x}
            y={aisle.y}
            width={aisle.width}
            height={aisle.height}
            fill="#F3F4F6"
            stroke="#D1D5DB"
            strokeWidth="2"
            strokeDasharray="4,4"
            opacity={0.5}
          />
        ))}

        {/* Render racks */}
        {racksWithVelocity.map((rack) => {
          const isSelected = selectedRackId === rack.id;
          const isHovered = hoveredRackId === rack.id;
          const occupancy = getRackOccupancy(rack);
          const color = getRackColor(rack);
          const hasRecent = hasRecentReceipts(rack);
          const segments = getLevelSegments(rack);

          return (
            <g
              key={rack.id}
              onClick={() => onRackClick?.(rack)}
              onMouseEnter={() => setHoveredRackId(rack.id)}
              onMouseLeave={() => setHoveredRackId(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Rack base rectangle - only visible for empty racks or as background */}
              <rect
                x={rack.x}
                y={rack.y}
                width={rack.width}
                height={rack.height}
                fill={color}
                stroke={
                  isSelected
                    ? "#CF0F47"
                    : isHovered
                    ? "#F59E0B"
                    : rack.status === "out_of_service"
                    ? "#991B1B" // Darker red border for out of service
                    : rack.status === "maintenance"
                    ? "#C2410C" // Darker orange border for maintenance
                    : showVelocity &&
                      rack.velocity !== undefined &&
                      rack.velocity >= 50
                    ? "#991B1B" // Darker red border for high velocity
                    : showVelocity &&
                      rack.velocity !== undefined &&
                      rack.velocity >= 20
                    ? "#D97706" // Darker yellow border for medium velocity
                    : "#9CA3AF"
                }
                strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                className={clsx("transition-all", hasRecent && "animate-pulse")}
                opacity={
                  showVelocity && rack.velocity !== undefined
                    ? 0.4
                    : occupancy === 0
                    ? 0.2
                    : 0.3
                }
              />

              {/* Maintenance pattern overlay (diagonal stripes) */}
              {rack.status === "maintenance" && (
                <rect
                  x={rack.x}
                  y={rack.y}
                  width={rack.width}
                  height={rack.height}
                  fill="url(#maintenance-pattern)"
                  pointerEvents="none"
                  opacity="0.6"
                />
              )}

              {/* Level segments overlay */}
              {segments.map((segment) => {
                // Map each level to its occupancy color - show actual bin occupancy percentage
                // Special rack statuses (maintenance/out_of_service) apply to empty bins
                // Reserved bins use Safety Blue (special status)
                // Empty bins use White/Very Light Gray (or rack status color if rack is in special status)
                // Occupied bins use occupancy-based colors (Green/Yellow/Blue based on percentage)
                // When velocity mode is enabled, use velocity colors for all segments
                let segmentColor = "#F5F5F5"; // White/Very Light Gray for empty
                let segmentStroke = "#D1D5DB"; // Light grey border for empty

                // If rack is in maintenance or out_of_service, ALL levels show rack status color (rack is empty)
                const isRackInSpecialStatus =
                  rack.status === "maintenance" ||
                  rack.status === "out_of_service";

                // Priority 1: Special rack statuses (maintenance/out_of_service)
                if (isRackInSpecialStatus) {
                  // All levels in maintenance/out_of_service racks show rack status color
                  if (rack.status === "maintenance") {
                    segmentColor = "#FF6B35"; // Safety Orange - Maintenance warning
                    segmentStroke = "#C2410C"; // Darker orange border
                  } else if (rack.status === "out_of_service") {
                    segmentColor = "#DC2626"; // Safety Red - Stop/Danger
                    segmentStroke = "#991B1B"; // Darker red border
                  }
                }
                // Priority 2: Quarantined bins (safety critical)
                else if (segment.bin?.status === "quarantined") {
                  // Quarantined bins use Purple (highest priority for safety)
                  segmentColor = "#9333EA"; // Purple - Quarantined
                  segmentStroke = "#7C3AED"; // Dark purple border
                }
                // Priority 3: Velocity mode (when enabled, overrides occupancy)
                else if (showVelocity && rack.velocity !== undefined) {
                  // Use velocity color for all segments in this rack
                  const velocityColor = getVelocityColor(rack.velocity);
                  segmentColor = velocityColor;
                  // Use darker version for stroke
                  if (rack.velocity < 20) {
                    segmentStroke = "#16A34A"; // Darker green
                  } else if (rack.velocity < 50) {
                    segmentStroke = "#D97706"; // Darker yellow
                  } else {
                    segmentStroke = "#991B1B"; // Darker red
                  }
                }
                // Priority 4: Reserved bins
                else if (segment.isReserved) {
                  // Reserved bins use Safety Blue (special status takes priority)
                  segmentColor = "#4A90E2"; // Safety Blue - matches legend
                  segmentStroke = "#2563EB"; // Dark blue border
                }
                // Priority 5: Occupied bins (occupancy-based colors)
                else if (segment.isOccupied && segment.bin) {
                  // Occupied bins use occupancy-based colors
                  const occupancyColors = getOccupancyColor(segment.occupancy);
                  segmentColor = occupancyColors.color;
                  segmentStroke = occupancyColors.stroke;
                }
                // Empty bins in active racks show White/Very Light Gray

                // Determine text color based on background
                const isDarkBackground =
                  segment.occupancy >= 85 ||
                  segment.isReserved ||
                  segment.bin?.status === "quarantined" ||
                  isRackInSpecialStatus ||
                  (showVelocity &&
                    rack.velocity !== undefined &&
                    rack.velocity >= 20);
                const textColor = isDarkBackground ? "#FFFFFF" : "#6B7280";

                return (
                  <g key={`${rack.id}-level-${segment.level}`}>
                    <rect
                      x={rack.x}
                      y={segment.y}
                      width={rack.width}
                      height={segment.height}
                      fill={segmentColor}
                      opacity={
                        segment.isEmpty && !isRackInSpecialStatus ? 1.0 : 0.9
                      }
                      stroke={segmentStroke}
                      strokeWidth={0.5}
                      pointerEvents="none"
                    />
                    {/* Level label (L1, L2, L3, L4, L5) */}
                    <text
                      x={rack.x + rack.width / 2}
                      y={segment.y + segment.height / 2 + 4}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-semibold pointer-events-none"
                      fontSize="10"
                      fill={textColor}
                      style={{
                        textShadow: isDarkBackground
                          ? "0 1px 2px rgba(0,0,0,0.5)"
                          : "none",
                      }}
                    >
                      L{segment.level}
                    </text>
                  </g>
                );
              })}

              {/* Rack label - positioned above the rack with occupancy */}
              <g>
                {/* Background for better visibility */}
                <rect
                  x={rack.x - 2}
                  y={rack.y - 18}
                  width={rack.width + 4}
                  height={14}
                  fill="#FFFFFF"
                  opacity="0.9"
                  rx="2"
                  stroke="#D1D5DB"
                  strokeWidth="0.5"
                />
                {/* Rack name with status icon and occupancy */}
                <text
                  x={rack.x + rack.width / 2}
                  y={rack.y - 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-semibold fill-base-content pointer-events-none"
                  fontSize="10"
                >
                  {rack.id}
                  {/* Maintenance/Out of Service status icon next to rack name */}
                  {rack.status === "maintenance" && " 🔧"}
                  {rack.status === "out_of_service" && " ⚠"}
                  {rack.status === "reserved" && " 🔒"}
                  {rack.bins.some((b) => b.status === "quarantined") && " 🚫"}
                  {/* Occupancy percentage or velocity next to rack name */}
                  {rack.status === "active" &&
                    (showVelocity && rack.velocity !== undefined
                      ? ` (V: ${Math.round(rack.velocity)}%)`
                      : ` (${Math.round(occupancy)}%)`)}
                </text>
              </g>
            </g>
          );
        })}

        {/* Zone labels - positioned outside the map area */}
        <g>
          {Array.from(new Set(layout.racks.map((r) => r.zone))).map((zone) => {
            const zoneRacks = layout.racks.filter((r) => r.zone === zone);
            const minX = Math.min(...zoneRacks.map((r) => r.x));
            const minY = Math.min(...zoneRacks.map((r) => r.y));
            const maxX = Math.max(...zoneRacks.map((r) => r.x + r.width));
            const centerX = (minX + maxX) / 2;

            return (
              <g key={zone}>
                {/* Background for zone label */}
                <rect
                  x={centerX - 35}
                  y={minY - 40}
                  width={70}
                  height={18}
                  fill="#FFFFFF"
                  opacity="0.95"
                  rx="3"
                  stroke="#CF0F47"
                  strokeWidth="1.5"
                />
                {/* Zone label text */}
                <text
                  x={centerX}
                  y={minY - 27}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-sm font-bold fill-primary pointer-events-none"
                  fontSize="12"
                >
                  {zone === "ST"
                    ? "Storage"
                    : zone === "RC"
                    ? "Reception"
                    : zone === "PK"
                    ? "Picking"
                    : zone === "SH"
                    ? "Shipping"
                    : zone}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
