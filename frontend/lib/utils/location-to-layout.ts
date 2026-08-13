import { logger } from "@/lib/utils/logger";
/**
 * Convert Location API data to WarehouseLayout format
 * SIMPLIFIED: Only shows STORAGE locations (receiving, packing, shipping areas are hidden)
 */

import { Location, LocationHierarchy } from '@/lib/api/locations';
import { WarehouseLayout, RackUnit, LocationBin, BinStatus } from '@/lib/types/warehouse-layout';
import { inventoryApi } from '@/lib/api/inventory';
import { materialsApi } from '@/lib/api/materials';
import {
  deriveRackIdFromLocation,
  normalizeArea,
  normalizeBay,
  normalizeRow,
} from '@/lib/utils/location-identity';
import { applyOccupancyToBin } from '@/lib/utils/bin-occupancy';
import { locationsApi, type BinOccupancy, type RackSummary } from '@/lib/api/locations';
import { slottingIntelligenceApi } from '@/lib/api/slotting-intelligence';

const OPERATIONAL_STORAGE_ZONES = new Set(['STORAGE', 'PICK_FACE', 'RESERVE']);
const OPERATIONAL_STORAGE_TYPES = new Set(['STORAGE', 'PICKING', 'BULK']);

function isOperationalStorage(location: Pick<Location, 'zoneType' | 'locationType'>): boolean {
  return OPERATIONAL_STORAGE_ZONES.has((location.zoneType || '').toUpperCase())
    || OPERATIONAL_STORAGE_TYPES.has((location.locationType || '').toUpperCase());
}

/**
 * Convert a single location to a LocationBin
 */
function locationToBin(
  location: Location,
  inventoryMap: Map<string, { quantity: number; sku: string }>,
  occupancyMap: Map<string, BinOccupancy>
): LocationBin {
  const inventory = inventoryMap.get(location.id);
  const level = location.levelNumber || 1;
  const occupancy = occupancyMap.get(location.locationCode);
  
  // Determine bin status based on rack status + inventory.
  // Reserved rack slots remain reserved even when empty.
  let status: BinStatus = 'empty';
  if ((location.rackStatus || "").toLowerCase() === "reserved" && (!inventory || inventory.quantity <= 0)) {
    status = 'reserved';
  } else if (inventory && inventory.quantity > 0) {
    status = 'occupied';
  }

  const baseBin: LocationBin = {
    id: location.locationCode,
    level,
    status,
    maxPalletCapacity: location.maxPalletCapacity ?? 1,
    inventory: inventory ? {
      sku: inventory.sku,
      quantity: inventory.quantity,
      weight: occupancy?.binWeightKg ?? 0,
      unitsPerPallet: occupancy?.unitsPerPallet ?? undefined,
      palletWeightKg: occupancy?.palletWeightKg ?? undefined,
    } : undefined,
  };

  return applyOccupancyToBin(baseBin, occupancy);
}

/**
 * Group locations by rack (area-row-bay combination)
 */
function groupLocationsByRack(locations: Location[]): Map<string, Location[]> {
  const rackMap = new Map<string, Location[]>();
  
  locations.forEach((location) => {
    const rackKey = deriveRackIdFromLocation(location);
    
    if (!rackMap.has(rackKey)) {
      rackMap.set(rackKey, []);
    }
    rackMap.get(rackKey)!.push(location);
  });
  
  return rackMap;
}

/**
 * Convert locations to RackUnit format
 * SIMPLIFIED: Only shows STORAGE locations in a simple grid layout
 */
function locationsToRacks(
  locations: Location[],
  inventoryMap: Map<string, { quantity: number; sku: string }>,
  occupancyMap: Map<string, BinOccupancy>,
  pendingMovesByRack: Map<string, number> = new Map()
): RackUnit[] {
  // Safety check: Filter to only STORAGE locations (backend should already do this, but double-check)
  const storageLocations = locations.filter(isOperationalStorage);
  
  const rackMap = groupLocationsByRack(storageLocations);
  const racks: RackUnit[] = [];
  
  // Simple grid layout for storage racks only
  const rackWidth = 90;
  const rackHeight = 160;
  const rackSpacing = 30;
  const sectionPadding = 50;
  const racksPerRow = 12; // Number of racks per row
  
  let rackIndex = 0;
  let currentAisle = 1;
  
  rackMap.forEach((rackLocations, rackKey) => {
    const rowInGrid = Math.floor(rackIndex / racksPerRow);
    const colInGrid = rackIndex % racksPerRow;
    
    const rackX = sectionPadding + colInGrid * (rackWidth + rackSpacing);
    const rackY = sectionPadding + rowInGrid * (rackHeight + rackSpacing);
    
    // Get first location to extract rack info
    const firstLocation = rackLocations[0];
    const area = normalizeArea(firstLocation.area);
    const row = parseInt(normalizeRow(firstLocation.rowNumber), 10);
    const bay = parseInt(normalizeBay(firstLocation.bayNumber), 10);
    
    // Convert locations to bins
    const bins: LocationBin[] = rackLocations
      .sort((a, b) => (a.levelNumber || 1) - (b.levelNumber || 1))
      .map((loc) => locationToBin(loc, inventoryMap, occupancyMap));
    
    // Determine rack status from persisted rackStatus values.
    // Priority: out_of_service > maintenance > reserved > active.
    const rackStatuses = rackLocations
      .map((loc) => (loc.rackStatus || "").toLowerCase())
      .filter((rackStatus): rackStatus is string => !!rackStatus);

    let status: 'active' | 'maintenance' | 'reserved' | 'out_of_service' = 'active';
    if (rackStatuses.some((rackStatus) => rackStatus === "out_of_service")) {
      status = 'out_of_service';
    } else if (rackStatuses.some((rackStatus) => rackStatus === "maintenance")) {
      status = "maintenance";
    } else if (rackStatuses.some((rackStatus) => rackStatus === "reserved")) {
      status = "reserved";
    }
    
    const rack: RackUnit = {
      id: rackKey,
      zone: area,
      aisle: currentAisle,
      bay,
      x: rackX,
      y: rackY,
      width: rackWidth,
      height: rackHeight,
      bins,
      maxLevels: Math.max(...rackLocations.map((loc) => loc.levelNumber || 1), 5),
      status,
      amalgamatedClass: rackLocations.map((loc) => loc.amalgamatedClass).find((value) => !!value),
      isBulk: rackLocations.some((loc) => (loc.locationType || "").toLowerCase() === "bulk"),
      pendingMoveCount: pendingMovesByRack.get(rackKey) ?? 0,
    };
    
    racks.push(rack);
    rackIndex++;
    if (rackIndex % racksPerRow === 0) {
      currentAisle++;
    }
  });
  
  return racks;
}

function rackStatusFromSummary(value?: string | null): RackUnit["status"] {
  const status = (value || "active").toLowerCase();
  if (status === "maintenance" || status === "reserved" || status === "out_of_service") {
    return status;
  }
  return "active";
}

function buildWarehouseLayout(
  warehouseId: string,
  warehouseName: string,
  racks: RackUnit[],
  stations: WarehouseLayout['stations'] = []
): WarehouseLayout {
  const maxX = Math.max(800, ...racks.map((r) => r.x + r.width));
  const maxY = Math.max(620, ...racks.map((r) => r.y + r.height));

  return {
    id: warehouseId,
    name: warehouseName,
    warehouseId,
    width: maxX + 70,
    height: maxY + 70,
    racks,
    stations,
    aisles: [],
  };
}

function summaryToBins(summary: RackSummary): LocationBin[] {
  const maxLevels = Math.max(summary.maxLevels || 1, 1);
  const positionsPerLevel = Math.max(summary.positionsPerLevel || 1, 1);
  const binCount = Math.min(
    Math.max(summary.binCount || maxLevels * positionsPerLevel, 1),
    maxLevels * positionsPerLevel
  );
  const occupiedBins = Math.min(summary.occupiedBins || 0, binCount);
  const palletCapacityPerBin = Math.max(Math.ceil((summary.palletCapacity || binCount) / binCount), 1);
  const avgPalletsPerOccupiedBin = occupiedBins > 0 ? Math.max(Math.ceil((summary.palletCount || occupiedBins) / occupiedBins), 1) : 0;
  const avgWeightPerOccupiedBin = occupiedBins > 0 ? (summary.totalWeightKg || 0) / occupiedBins : 0;
  const avgQtyPerOccupiedBin = occupiedBins > 0 ? Math.ceil((summary.totalQuantity || 0) / occupiedBins) : 0;

  return Array.from({ length: binCount }, (_, idx) => {
    const level = Math.floor(idx / positionsPerLevel) + 1;
    const position = String.fromCharCode(65 + (idx % positionsPerLevel));
    const occupied = idx < occupiedBins;
    return {
      id: `${summary.rackId}-${level}-${position}`,
      level,
      status: occupied ? "occupied" : "empty",
      maxPalletCapacity: palletCapacityPerBin,
      palletCount: occupied ? Math.min(avgPalletsPerOccupiedBin, palletCapacityPerBin) : 0,
      levelWeightCapacityKg: summary.weightCapacityKg ? summary.weightCapacityKg / maxLevels : undefined,
      levelWeightUsedKg: occupied ? avgWeightPerOccupiedBin * 2 : 0,
      inventory: occupied
        ? {
            sku: "Mixed SKU",
            quantity: avgQtyPerOccupiedBin,
            weight: avgWeightPerOccupiedBin,
          }
        : undefined,
    } satisfies LocationBin;
  });
}

export function occupancyRowsToBins(rows: BinOccupancy[]): LocationBin[] {
  return rows.map((row) => {
    const baseBin: LocationBin = {
      id: row.locationCode,
      level: row.levelNumber || 1,
      status: row.quantity > 0 ? "occupied" : "empty",
      maxPalletCapacity: row.maxPalletCapacity ?? 1,
      inventory:
        row.quantity > 0
          ? {
              sku: row.materialCode || "Unknown SKU",
              quantity: row.quantity,
              weight: row.binWeightKg ?? 0,
              unitsPerPallet: row.unitsPerPallet ?? undefined,
              palletWeightKg: row.palletWeightKg ?? undefined,
            }
          : undefined,
    };
    return applyOccupancyToBin(baseBin, row);
  });
}

export async function convertRackSummariesToLayout(
  summaries: RackSummary[],
  warehouseId: string,
  warehouseName: string
): Promise<WarehouseLayout> {
  const pendingMovesMap = await loadPendingMovesMap(warehouseId);
  const rackWidth = 190;
  const rackHeight = 95;
  const sectionPadding = 50;
  const zoneHeaderHeight = 40;
  const horizontalAisle = 40;
  const verticalAisle = 50;
  const positioned = summaries.filter(
    (summary) => summary.coordinateX != null && summary.coordinateY != null
      && Number.isFinite(Number(summary.coordinateX)) && Number.isFinite(Number(summary.coordinateY))
  );
  // Rotate the metric plan for the desktop canvas: bays run left-to-right and
  // physical zones run top-to-bottom. Swapping axes preserves every distance.
  const coordinateXs = [...new Set(positioned.map((summary) => Number(summary.coordinateY)))].sort((a, b) => a - b);
  const coordinateYs = [...new Set(positioned.map((summary) => Number(summary.coordinateX)))].sort((a, b) => a - b);
  const xIndex = new Map(coordinateXs.map((value, index) => [value, index]));
  const yIndex = new Map(coordinateYs.map((value, index) => [value, index]));
  const fallbackColumns = 5;

  const racks = summaries.map((summary, rackIndex) => {
    const hasCoordinates = summary.coordinateX != null && summary.coordinateY != null
      && Number.isFinite(Number(summary.coordinateX)) && Number.isFinite(Number(summary.coordinateY));
    const rowInGrid = Math.floor(rackIndex / fallbackColumns);
    const colInGrid = rackIndex % fallbackColumns;
    const bins = summaryToBins(summary);
    const rowNumber = parseInt(normalizeRow(summary.rowNumber), 10);
    const bay = parseInt(normalizeBay(summary.bayNumber), 10);

    return {
      id: summary.rackId,
      zone: normalizeArea(summary.area),
      aisle: Number.isFinite(rowNumber) ? rowNumber : Math.floor(rackIndex / fallbackColumns) + 1,
      bay: Number.isFinite(bay) ? bay : 1,
      x: hasCoordinates
        ? sectionPadding + (xIndex.get(Number(summary.coordinateY)) ?? 0) * (rackWidth + horizontalAisle)
        : sectionPadding + colInGrid * (rackWidth + horizontalAisle),
      y: hasCoordinates
        ? sectionPadding + zoneHeaderHeight + (yIndex.get(Number(summary.coordinateX)) ?? 0) * (rackHeight + verticalAisle)
        : sectionPadding + zoneHeaderHeight + rowInGrid * (rackHeight + verticalAisle),
      width: rackWidth,
      height: rackHeight,
      bins,
      maxLevels: Math.max(...bins.map((bin) => bin.level), 5),
      status: rackStatusFromSummary(summary.rackStatus),
      amalgamatedClass: summary.amalgamatedClass || undefined,
      description: summary.description || undefined,
      isBulk: (summary.locationType || "").toLowerCase() === "bulk",
      isGeneratedOverflow: summary.autoGenerated,
      pendingMoveCount: pendingMovesMap.get(summary.rackId) ?? 0,
    } satisfies RackUnit;
  });
  // Operational stations belong to route planning. The detailed rack view is kept
  // spatially stable so rack labels and all L1-L5 segments remain inspectable.
  return buildWarehouseLayout(warehouseId, warehouseName, racks, []);
}

async function loadPendingMovesMap(warehouseId: string): Promise<Map<string, number>> {
  try {
    const snapshot = await slottingIntelligenceApi.getSnapshot(warehouseId);
    return new Map(
      snapshot.pendingMovesByRack.map((row) => [row.rackId, row.pendingMoveCount])
    );
  } catch (error) {
    logger.error('Failed to load intelligence snapshot:', error);
    return new Map();
  }
}

async function loadOccupancyMap(warehouseId: string): Promise<Map<string, BinOccupancy>> {
  try {
    const rows = await locationsApi.getRackOccupancy(warehouseId);
    return new Map(rows.map((row) => [row.locationCode, row]));
  } catch (error) {
    logger.error('Failed to load rack occupancy:', error);
    return new Map();
  }
}

/**
 * Convert location hierarchy from API to WarehouseLayout
 */
export async function convertLocationHierarchyToLayout(
  hierarchy: LocationHierarchy,
  warehouseId: string,
  warehouseName: string
): Promise<WarehouseLayout> {
  // Flatten hierarchy to get all locations
  const allLocations: Location[] = [];
  
  Object.entries(hierarchy.hierarchy).forEach(([area, rows]) => {
    Object.entries(rows).forEach(([row, bays]) => {
      Object.entries(bays).forEach(([bay, locations]) => {
        allLocations.push(...locations);
      });
    });
  });
  
  // Filter to only STORAGE locations (safety check - backend should already filter)
  const storageLocations = allLocations.filter(isOperationalStorage);
  
  // Load inventory for this warehouse - only in-stock items with location codes
  const inventoryItems = await inventoryApi.getByWarehouse(warehouseId);
  
  // Get unique material IDs from inventory items
  const uniqueMaterialIds = [...new Set(inventoryItems.map(item => item.materialId))];
  
  // Fetch materials to map materialId to materialCode (human-readable SKU)
  const materialCodeMap = new Map<string, string>();
  try {
    // Fetch materials in parallel for better performance
    const materialPromises = uniqueMaterialIds.map(id => 
      materialsApi.getById(id).catch(() => null)
    );
    const materials = await Promise.all(materialPromises);
    materials.forEach((material) => {
      if (material) {
        materialCodeMap.set(material.id, material.materialCode);
      }
    });
  } catch (error) {
    logger.error('Failed to fetch materials for SKU mapping:', error);
  }
  
  const inventoryMap = new Map<string, { quantity: number; sku: string }>();
  
  inventoryItems.forEach((item) => {
    // Only include items that have locationCode AND are in-stock (quantity > 0)
    if (item.locationCode && parseFloat(item.quantity) > 0) {
      const location = storageLocations.find((loc) => loc.locationCode === item.locationCode);
      if (location) {
        // Use materialCode if available, otherwise fallback to materialId
        const sku = materialCodeMap.get(item.materialId) || item.materialId;
        inventoryMap.set(location.id, {
          quantity: parseFloat(item.quantity) || 0,
          sku: sku,
        });
      }
    }
  });
  
  // Convert to racks (only storage locations)
  const occupancyMap = await loadOccupancyMap(warehouseId);
  const pendingMovesMap = await loadPendingMovesMap(warehouseId);
  const racks = locationsToRacks(storageLocations, inventoryMap, occupancyMap, pendingMovesMap);
  
  // Calculate warehouse dimensions (simplified - only storage racks)
  const sectionPadding = 50;
  const rackHeight = 160;
  const rackSpacing = 30;
  const racksPerRow = 12;
  const totalRows = Math.ceil(racks.length / racksPerRow);
  const totalHeight = sectionPadding + totalRows * (rackHeight + rackSpacing) - rackSpacing + sectionPadding;
  
  const maxX = Math.max(...racks.map((r) => r.x + r.width), 2500);
  const maxY = Math.max(...racks.map((r) => r.y + r.height), totalHeight);
  
  // Generate aisles (simplified - based on rack positions)
  const aisles: WarehouseLayout['aisles'] = [];
  const aisleSet = new Set(racks.map((r) => r.aisle));
  aisleSet.forEach((aisleNum) => {
    const aisleRacks = racks.filter((r) => r.aisle === aisleNum);
    if (aisleRacks.length > 0) {
      const minX = Math.min(...aisleRacks.map((r) => r.x));
      const maxX = Math.max(...aisleRacks.map((r) => r.x + r.width));
      const minY = Math.min(...aisleRacks.map((r) => r.y));
      const maxY = Math.max(...aisleRacks.map((r) => r.y + r.height));
      
      aisles.push({
        id: `aisle-${aisleNum}`,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }
  });
  
  return {
    id: warehouseId,
    name: warehouseName,
    warehouseId,
    width: maxX + 100,
    height: maxY + 100,
    racks,
    stations: [],
    aisles,
  };
}

/**
 * Fallback: Generate a simple layout from locations list
 */
export async function convertLocationsToLayout(
  locations: Location[],
  warehouseId: string,
  warehouseName: string
): Promise<WarehouseLayout> {
  // Filter to only STORAGE locations (safety check - backend should already filter)
  const storageLocations = locations.filter(isOperationalStorage);
  
  // Load inventory - only in-stock items with location codes
  const inventoryItems = await inventoryApi.getByWarehouse(warehouseId);
  
  // Get unique material IDs from inventory items
  const uniqueMaterialIds = [...new Set(inventoryItems.map(item => item.materialId))];
  
  // Fetch materials to map materialId to materialCode (human-readable SKU)
  const materialCodeMap = new Map<string, string>();
  try {
    // Fetch materials in parallel for better performance
    const materialPromises = uniqueMaterialIds.map(id => 
      materialsApi.getById(id).catch(() => null)
    );
    const materials = await Promise.all(materialPromises);
    materials.forEach((material) => {
      if (material) {
        materialCodeMap.set(material.id, material.materialCode);
      }
    });
  } catch (error) {
    logger.error('Failed to fetch materials for SKU mapping:', error);
  }
  
  const inventoryMap = new Map<string, { quantity: number; sku: string }>();
  
  inventoryItems.forEach((item) => {
    if (item.locationCode && parseFloat(item.quantity) > 0) {
      const location = storageLocations.find((loc) => loc.locationCode === item.locationCode);
      if (location) {
        // Use materialCode if available, otherwise fallback to materialId
        const sku = materialCodeMap.get(item.materialId) || item.materialId;
        inventoryMap.set(location.id, {
          quantity: parseFloat(item.quantity) || 0,
          sku: sku,
        });
      }
    }
  });
  
  const occupancyMap = await loadOccupancyMap(warehouseId);
  const pendingMovesMap = await loadPendingMovesMap(warehouseId);
  const racks = locationsToRacks(storageLocations, inventoryMap, occupancyMap, pendingMovesMap);
  
  // Calculate warehouse dimensions (simplified - only storage racks)
  const sectionPadding = 50;
  const rackHeight = 160;
  const rackSpacing = 30;
  const racksPerRow = 12;
  const totalRows = Math.ceil(racks.length / racksPerRow);
  const totalHeight = sectionPadding + totalRows * (rackHeight + rackSpacing) - rackSpacing + sectionPadding;
  
  const maxX = Math.max(...racks.map((r) => r.x + r.width), 2500);
  const maxY = Math.max(...racks.map((r) => r.y + r.height), totalHeight);
  
  return {
    id: warehouseId,
    name: warehouseName,
    warehouseId,
    width: maxX + 100,
    height: maxY + 100,
    racks,
    stations: [],
    aisles: [],
  };
}
