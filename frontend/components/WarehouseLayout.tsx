"use client";

import { useState, useMemo, useEffect } from "react";
import clsx from "clsx";
import {
  WarehouseLayout,
  RackUnit,
  LocationBin,
} from "@/lib/types/warehouse-layout";
import { analyticsApi, LocationVelocity } from "@/lib/api/analytics";
import { logger } from "@/lib/utils/logger";

interface WarehouseLayoutProps {
  layout: WarehouseLayout;
  onRackClick?: (rack: RackUnit) => void;
  selectedRackId?: string | null;
  showVelocity?: boolean;
  onVelocityToggle?: (show: boolean) => void;
}

/**
 * SVG-based Warehouse Layout Visualization Component
 * Displays racks with vertical level occupancy using opacity stacking
 */
export function WarehouseLayoutVisualization({
  layout,
  onRackClick,
  selectedRackId,
  showVelocity: externalShowVelocity,
  onVelocityToggle,
}: WarehouseLayoutProps) {
  const [hoveredRackId, setHoveredRackId] = useState<string | null>(null);
  const [internalShowVelocity, setInternalShowVelocity] = useState(false);
  const showVelocity = externalShowVelocity !== undefined ? externalShowVelocity : internalShowVelocity;
  const setShowVelocity = onVelocityToggle || setInternalShowVelocity;
  const [velocityData, setVelocityData] = useState<Map<string, number>>(
    new Map()
  );
  const [isLoadingVelocity, setIsLoadingVelocity] = useState(false);
  
  // Helper function to get theme-aware colors
  const getThemeColor = (variable: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(variable).trim();
    return value || fallback;
  };

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
            logger.error("Velocity API request failed:", error);
            setVelocityData(new Map());
          }
        } catch (error) {
          logger.error("Error loading velocity data:", error);
          setVelocityData(new Map());
        } finally {
          setIsLoadingVelocity(false);
        }
      };

      loadVelocityData();
    }
  }, [showVelocity, layout.warehouseId, layout.racks]);

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
    // Special status colors use muted fills with clearer borders/patterns.
    if (rack.status === "out_of_service") return "#FEE2E2"; // Dull red tint
    if (rack.status === "maintenance") return "#FEF3C7"; // Yellow/amber tint
    if (rack.status === "reserved") return "#E0F2FE"; // Soft cyan tint

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
      const isReserved = bin?.status === "reserved";
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
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full h-full border border-base-300 rounded-lg bg-base-200"
        preserveAspectRatio="none"
        style={{ minWidth: `${layout.width}px`, minHeight: `${layout.height}px` }}
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
              stroke="#B45309"
              strokeWidth="1.5"
              opacity="0.4"
            />
          </pattern>
          <pattern
            id="out-of-service-pattern"
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
              stroke="#B91C1C"
              strokeWidth="1.5"
              opacity="0.35"
            />
          </pattern>
        </defs>
        {/* Area section backgrounds and labels removed - showing only racks */}

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
              style={{ cursor: rack.status === "out_of_service" ? "not-allowed" : "pointer" }}
            >
              {/* Rack base rectangle with rounded corners - only visible for empty racks or as background */}
              <rect
                x={rack.x}
                y={rack.y}
                width={rack.width}
                height={rack.height}
                rx="6"
                ry="6"
                fill={color}
                stroke={
                  isSelected
                    ? "#CF0F47"
                    : isHovered && rack.status !== "out_of_service"
                    ? "#F59E0B"
                    : rack.status === "out_of_service"
                    ? "#DC2626" // Red border for out-of-service
                    : rack.status === "maintenance"
                    ? "#D97706" // Amber border for maintenance
                    : rack.status === "reserved"
                    ? "#0369A1" // Cyan border for reserved
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
                  rack.status !== "active"
                    ? 0.8
                    : showVelocity && rack.velocity !== undefined
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
                  rx="6"
                  ry="6"
                  fill="url(#maintenance-pattern)"
                  pointerEvents="none"
                  opacity="0.6"
                />
              )}
              {rack.status === "out_of_service" && (
                <rect
                  x={rack.x}
                  y={rack.y}
                  width={rack.width}
                  height={rack.height}
                  rx="6"
                  ry="6"
                  fill="url(#out-of-service-pattern)"
                  pointerEvents="none"
                  opacity="0.7"
                />
              )}

              {/* Level segments overlay */}
              {segments.map((segment) => {
                // Map each level to its occupancy color - show actual bin occupancy percentage
                // Special rack statuses (maintenance/out_of_service) apply to empty bins
                // Reserved bins use cyan special-status color
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
                    segmentColor = "#FEF3C7";
                    segmentStroke = "#D97706";
                  } else if (rack.status === "out_of_service") {
                    segmentColor = "#FEE2E2";
                    segmentStroke = "#DC2626";
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
                  // Reserved bins use cyan (distinct from high occupancy dark blue)
                  segmentColor = "#E0F2FE";
                  segmentStroke = "#0284C7";
                }
                // Priority 5: Occupied bins (occupancy-based colors)
                else if (segment.isOccupied && segment.bin) {
                  // Occupied bins use occupancy-based colors
                  const occupancyColors = getOccupancyColor(segment.occupancy);
                  segmentColor = occupancyColors.color;
                  segmentStroke = occupancyColors.stroke;
                }
                // Empty bins in active racks show White/Very Light Gray

                // Determine text color based on background - use theme-aware colors
                const isDarkBackground =
                  segment.occupancy >= 85 ||
                  segment.bin?.status === "quarantined" ||
                  (showVelocity &&
                    rack.velocity !== undefined &&
                    rack.velocity >= 50);
                // Use CSS variables for theme-aware colors
                const textColor = isDarkBackground 
                  ? getThemeColor('--svg-text-light', '#FFFFFF')
                  : getThemeColor('--svg-text-dark', '#6B7280');

                return (
                  <g key={`${rack.id}-level-${segment.level}`}>
                    <rect
                      x={rack.x}
                      y={segment.y}
                      width={rack.width}
                      height={segment.height}
                      rx="4"
                      ry="4"
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
                {(() => {
                  const rackIdText = rack.id;
                  const percentageText = rack.status === "active"
                    ? (showVelocity && rack.velocity !== undefined
                      ? `V: ${Math.round(rack.velocity)}%`
                      : `${Math.round(occupancy)}%`)
                    : rack.status === "reserved"
                      ? "RESERVED"
                      : rack.status === "maintenance"
                        ? "MAINTENANCE"
                        : "OUT OF SERVICE";
                  
                  // Calculate widths separately
                  const rackIdWidth = rackIdText.length * 6;
                  const percentageWidth = percentageText.length * 5.5;
                  const totalWidth = Math.max(rack.width + 4, rackIdWidth + percentageWidth + 12);
                  
                  return (
                    <>
                      {/* Background for better visibility - dynamically sized - theme-aware */}
                      <rect
                        x={rack.x + rack.width / 2 - totalWidth / 2}
                        y={rack.y - 28}
                        width={totalWidth}
                        height={24}
                        fill={getThemeColor('--svg-bg', '#FFFFFF')}
                        opacity="0.95"
                        rx="4"
                        stroke={getThemeColor('--svg-border', '#D1D5DB')}
                        strokeWidth="0.5"
                      />
                      {/* Rack ID on first line */}
                      <text
                        x={rack.x + rack.width / 2}
                        y={rack.y - 18}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-xs font-semibold fill-base-content pointer-events-none"
                        fontSize="10"
                      >
                        {rackIdText}
                      </text>
                      {/* Percentage on second line */}
                      {percentageText && (
                        <text
                          x={rack.x + rack.width / 2}
                          y={rack.y - 6}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-xs font-medium fill-base-content/70 pointer-events-none"
                          fontSize="9"
                        >
                          ({percentageText})
                        </text>
                      )}
                    </>
                  );
                })()}
              </g>
            </g>
          );
        })}

        {/* Zone labels - small labels with colored backgrounds, positioned to avoid overlap */}
        <g>
          {(() => {
            // Collect zones
            const zoneData: Array<{zone: string; minX: number; minY: number; maxX: number; maxY: number}> = [];
            
            Array.from(new Set(layout.racks.map((r) => r.zone))).forEach((zone) => {
              const zoneRacks = layout.racks.filter((r) => r.zone === zone);
              if (zoneRacks.length === 0) return;
              
              const minX = Math.min(...zoneRacks.map((r) => r.x));
              const minY = Math.min(...zoneRacks.map((r) => r.y));
              const maxX = Math.max(...zoneRacks.map((r) => r.x + r.width));
              const maxY = Math.max(...zoneRacks.map((r) => r.y + r.height));
              
              zoneData.push({ zone, minX, minY, maxX, maxY });
            });
            
            // Zone label text mapping
            const getZoneLabel = (zone: string) => {
              if (zone === "RC") return "Reception";
              if (zone === "PA") return "Putaway";
              if (zone === "ST") return "Storage";
              if (zone === "RM") return "Raw Materials";
              if (zone === "FG") return "Finished Goods";
              if (zone === "PK") return "Picking";
              if (zone === "SH") return "Shipping";
              return zone;
            };
            
            // Group zones by row (similar Y positions - within 150px to account for grid layout)
            const zonesByRow = new Map<number, typeof zoneData>();
            zoneData.forEach((zoneInfo) => {
              // Use larger grouping to account for grid layout spacing
              const rowKey = Math.round(zoneInfo.minY / 150) * 150;
              if (!zonesByRow.has(rowKey)) {
                zonesByRow.set(rowKey, []);
              }
              zonesByRow.get(rowKey)!.push(zoneInfo);
            });
            
            const allLabels: Array<{zone: string; x: number; y: number; width: number; endX: number; label: string; centerX: number}> = [];
            const labelHeight = 24;
            const verticalSpacing = 35;
            const horizontalSpacing = 15; // Minimum spacing between labels horizontally
            
            // Process each row separately
            zonesByRow.forEach((zonesInRow) => {
              zonesInRow.sort((a, b) => a.minX - b.minX);
              
              const rowLabels: Array<{x: number; y: number; width: number; endX: number}> = [];
              
              zonesInRow.forEach((zoneInfo) => {
                const { zone, minX, minY } = zoneInfo;
                const zoneLabel = getZoneLabel(zone);
                
                // Calculate label dimensions
                const estimatedLabelWidth = zoneLabel.length * 7.5 + 24;
                const labelCenterX = minX + (zoneInfo.maxX - minX) / 2;
                let labelX = labelCenterX - estimatedLabelWidth / 2;
                const labelEndX = labelX + estimatedLabelWidth;
                
                // Adjust horizontal position to avoid overlap
                for (const existingLabel of rowLabels) {
                  if ((labelX < existingLabel.endX + horizontalSpacing) && (labelEndX > existingLabel.x - horizontalSpacing)) {
                    // Overlap detected - shift this label to the right
                    labelX = existingLabel.endX + horizontalSpacing;
                  }
                }
                
                // Calculate final dimensions after horizontal adjustment
                const finalLabelX = labelX;
                const finalLabelEndX = finalLabelX + estimatedLabelWidth;
                const finalLabelCenterX = finalLabelX + estimatedLabelWidth / 2;
                
                // Start with base Y position (above racks with spacing)
                let baseY = minY - 45;
                let finalY = baseY;
                
                // Check for vertical overlap with existing labels
                for (const existingLabel of rowLabels) {
                  // Check if labels overlap horizontally
                  const horizontalOverlap = (finalLabelX < existingLabel.endX + horizontalSpacing) && 
                                           (finalLabelEndX > existingLabel.x - horizontalSpacing);
                  
                  if (horizontalOverlap) {
                    // Stack this label above the existing one
                    const overlappingLabels = rowLabels.filter(l => 
                      (finalLabelX < l.endX + horizontalSpacing) && (finalLabelEndX > l.x - horizontalSpacing)
                    );
                    if (overlappingLabels.length > 0) {
                      const highestY = Math.min(...overlappingLabels.map(l => l.y));
                      finalY = highestY - (labelHeight + verticalSpacing);
                    }
                  }
                }
                
                // Store this label's position
                const labelPos = {
                  x: finalLabelX,
                  y: finalY,
                  width: estimatedLabelWidth,
                  endX: finalLabelEndX
                };
                rowLabels.push(labelPos);
                
                allLabels.push({
                  zone,
                  x: finalLabelX,
                  y: finalY,
                  width: estimatedLabelWidth,
                  endX: finalLabelEndX,
                  label: zoneLabel,
                  centerX: finalLabelCenterX
                });
              });
            });
            
            // Area colors for labels
            const getAreaColor = (zone: string) => {
              const colors: Record<string, {bg: string; border: string; text: string}> = {
                'RC': { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' }, // Reception - yellow
                'PA': { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' }, // Putaway - blue
                'ST': { bg: '#F3F4F6', border: '#6B7280', text: '#374151' }, // Storage - gray
                'RM': { bg: '#FCE7F3', border: '#EC4899', text: '#BE185D' }, // Raw Materials - pink
                'FG': { bg: '#D1FAE5', border: '#10B981', text: '#047857' }, // Finished Goods - green
                'PK': { bg: '#FED7AA', border: '#F97316', text: '#C2410C' }, // Picking - orange
                'SH': { bg: '#E0E7FF', border: '#6366F1', text: '#4338CA' }, // Shipping - indigo
              };
              return colors[zone] || { bg: '#FFFFFF', border: '#CF0F47', text: '#CF0F47' };
            };
            
            // Render labels with colored backgrounds
            return allLabels.map((labelInfo) => {
              const areaColor = getAreaColor(labelInfo.zone);
              return (
                <g key={`label-${labelInfo.zone}-${labelInfo.x}`}>
                  {/* Background for zone label */}
                  <rect
                    x={labelInfo.x}
                    y={labelInfo.y}
                    width={labelInfo.width}
                    height={labelHeight}
                    fill={areaColor.bg}
                    opacity="0.95"
                    rx="6"
                    stroke={areaColor.border}
                    strokeWidth="2"
                  />
                  {/* Zone label text */}
                  <text
                    x={labelInfo.centerX}
                    y={labelInfo.y + labelHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fill={areaColor.text}
                    fontWeight="600"
                  >
                    {labelInfo.label}
                  </text>
                </g>
              );
            });
          })()}
        </g>
      </svg>
    </div>
  );
}
