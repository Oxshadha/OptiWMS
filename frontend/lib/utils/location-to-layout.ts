/**
 * Convert Location API data to WarehouseLayout format
 * Transforms location hierarchy from backend into the format expected by WarehouseLayoutVisualization
 */

import { Location, LocationHierarchy } from '@/lib/api/locations';
import { WarehouseLayout, RackUnit, LocationBin, BinStatus } from '@/lib/types/warehouse-layout';
import { inventoryApi } from '@/lib/api/inventory';

/**
 * Convert a single location to a LocationBin
 */
function locationToBin(location: Location, inventoryMap: Map<string, { quantity: number; sku: string }>): LocationBin {
  const inventory = inventoryMap.get(location.id);
  const level = location.levelNumber || 1;
  
  // Determine bin status based on inventory and location status
  let status: BinStatus = 'empty';
  if (!location.isActive) {
    status = 'reserved';
  } else if (inventory && inventory.quantity > 0) {
    status = 'occupied';
  }

  return {
    id: location.locationCode,
    level,
    status,
    inventory: inventory ? {
      sku: inventory.sku,
      quantity: inventory.quantity,
      weight: 0, // TODO: Get from material data
    } : undefined,
  };
}

/**
 * Group locations by rack (area-row-bay combination)
 */
function groupLocationsByRack(locations: Location[]): Map<string, Location[]> {
  const rackMap = new Map<string, Location[]>();
  
  locations.forEach((location) => {
    // Create rack key from area, row, and bay
    const area = location.area || 'ST';
    const row = location.rowNumber || '01';
    const bay = location.bayNumber || '01';
    const rackKey = `${area}-${row}-${bay}`;
    
    if (!rackMap.has(rackKey)) {
      rackMap.set(rackKey, []);
    }
    rackMap.get(rackKey)!.push(location);
  });
  
  return rackMap;
}

/**
 * Convert locations to RackUnit format
 * Groups racks by area into square/rectangular sections in a grid layout
 * Layout: Storage (top) -> Reception -> Picking -> Packing -> Putaway -> Shipping (bottom)
 */
function locationsToRacks(
  locations: Location[],
  inventoryMap: Map<string, { quantity: number; sku: string }>
): RackUnit[] {
  const rackMap = groupLocationsByRack(locations);
  const racks: RackUnit[] = [];
  
  // Group racks by area
  const racksByArea = new Map<string, Array<{rackKey: string; locations: Location[]}>>();
  rackMap.forEach((rackLocations, rackKey) => {
    const firstLocation = rackLocations[0];
    const area = firstLocation.area || 'ST';
    if (!racksByArea.has(area)) {
      racksByArea.set(area, []);
    }
    racksByArea.get(area)!.push({ rackKey, locations: rackLocations });
  });
  
  // Define area layout: grid positions and sizes
  // Layout: Storage (top full width), then Reception/Picking/Packing/Putaway in columns, Shipping (bottom full width)
  const rackWidth = 90;
  const rackHeight = 160;
  const rackSpacing = 30;
  const sectionSpacing = 50; // Space between area sections (increased to prevent overlap)
  const sectionPadding = 50; // Padding inside each section
  const labelHeight = 40; // Height reserved for area label
  
  // Calculate section dimensions
  const sectionWidth = 600; // Width of each area section
  const sectionHeight = 450; // Height of each area section (reduced to account for label)
  const totalGridWidth = sectionWidth * 4 + sectionSpacing * 3; // 4 columns + spacing
  
  // Area positions in grid layout
  // Row 1: Storage (full width, top)
  // Row 2: Reception, Picking, Putaway, Raw Materials/Finished Goods (4 columns)
  // Row 3: Shipping (full width, bottom)
  const areaLayout: Record<string, {row: number; col: number; colspan: number; rowspan: number}> = {
    'ST': { row: 0, col: 0, colspan: 4, rowspan: 1 }, // Storage - top, full width
    'RC': { row: 1, col: 0, colspan: 1, rowspan: 1 }, // Reception - row 2, col 1
    'PK': { row: 1, col: 1, colspan: 1, rowspan: 1 }, // Picking - row 2, col 2
    'PA': { row: 1, col: 2, colspan: 1, rowspan: 1 }, // Putaway - row 2, col 3
    'RM': { row: 1, col: 3, colspan: 1, rowspan: 1 }, // Raw Materials - row 2, col 4
    'FG': { row: 1, col: 3, colspan: 1, rowspan: 1 }, // Finished Goods - row 2, col 4 (shares with RM)
    'SH': { row: 2, col: 0, colspan: 4, rowspan: 1 }, // Shipping - bottom, full width
  };
  
  // Process each area
  racksByArea.forEach((areaRacks, area) => {
    const layout = areaLayout[area];
    if (!layout || areaRacks.length === 0) return;
    
    // Calculate section position
    // For full-width sections (colspan > 1), center them
    let sectionX: number;
    if (layout.colspan > 1) {
      // Full width section - center it
      sectionX = sectionPadding;
    } else {
      // Column section
      sectionX = sectionPadding + layout.col * (sectionWidth + sectionSpacing);
    }
    // Calculate section Y position - account for label height and spacing
    // Row 0: sectionPadding
    // Row 1: sectionPadding + sectionHeight + labelHeight + sectionSpacing
    // Row 2: sectionPadding + (sectionHeight + labelHeight + sectionSpacing) * 2
    const sectionY = sectionPadding + layout.row * (sectionHeight + labelHeight + sectionSpacing);
    
    // Calculate actual section width
    const actualSectionWidth = layout.colspan > 1 
      ? totalGridWidth - sectionPadding * 2
      : sectionWidth;
    
    // Calculate how many racks fit in this section (excluding label area)
    const racksPerRow = Math.floor((actualSectionWidth - sectionPadding * 2) / (rackWidth + rackSpacing));
    const maxRows = Math.floor((sectionHeight - sectionPadding * 2) / (rackHeight + rackSpacing));
    const maxRacksInSection = racksPerRow * maxRows;
    
    // Limit racks to fit in section
    const racksToShow = areaRacks.slice(0, maxRacksInSection);
    
    let rackIndex = 0;
    let currentAisle = 1;
    
    racksToShow.forEach(({ rackKey, locations: rackLocations }) => {
      const rowInSection = Math.floor(rackIndex / racksPerRow);
      const colInSection = rackIndex % racksPerRow;
      
      const rackX = sectionX + sectionPadding + colInSection * (rackWidth + rackSpacing);
      const rackY = sectionY + labelHeight + sectionPadding + rowInSection * (rackHeight + rackSpacing); // Start after label
      
      // Get first location to extract rack info
      const firstLocation = rackLocations[0];
      const row = parseInt(firstLocation.rowNumber || '01');
      const bay = parseInt(firstLocation.bayNumber || '01');
      
      // Convert locations to bins
      const bins: LocationBin[] = rackLocations
        .sort((a, b) => (a.levelNumber || 1) - (b.levelNumber || 1))
        .map((loc) => locationToBin(loc, inventoryMap));
      
      // Determine rack status
      const hasInactiveLocations = rackLocations.some((loc) => !loc.isActive);
      const hasOccupiedBins = bins.some((bin) => bin.status === 'occupied');
      
      let status: 'active' | 'maintenance' | 'reserved' | 'out_of_service' = 'active';
      if (hasInactiveLocations && !hasOccupiedBins) {
        status = 'out_of_service';
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
      };
      
      racks.push(rack);
      rackIndex++;
      if (rackIndex % racksPerRow === 0) {
        currentAisle++;
      }
    });
  });
  
  return racks;
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
  
  // Load inventory for this warehouse
  const inventoryItems = await inventoryApi.getByWarehouse(warehouseId);
  const inventoryMap = new Map<string, { quantity: number; sku: string }>();
  
  inventoryItems.forEach((item) => {
    if (item.locationCode) {
      // Find location by code
      const location = allLocations.find((loc) => loc.locationCode === item.locationCode);
      if (location) {
        inventoryMap.set(location.id, {
          quantity: parseFloat(item.quantity) || 0,
          sku: item.materialId, // Using materialId as SKU for now
        });
      }
    }
  });
  
  // Convert to racks
  const racks = locationsToRacks(allLocations, inventoryMap);
  
  // Calculate warehouse dimensions (accounting for grid layout with labels and spacing)
  // 3 rows: Storage (row 0), Middle row (row 1), Shipping (row 2)
  const sectionHeight = 450;
  const labelHeight = 40;
  const sectionSpacing = 50;
  const sectionPadding = 50;
  const totalHeight = sectionPadding + 3 * (sectionHeight + labelHeight + sectionSpacing) - sectionSpacing + sectionPadding;
  
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
  // Load inventory
  const inventoryItems = await inventoryApi.getByWarehouse(warehouseId);
  const inventoryMap = new Map<string, { quantity: number; sku: string }>();
  
  inventoryItems.forEach((item) => {
    if (item.locationCode) {
      const location = locations.find((loc) => loc.locationCode === item.locationCode);
      if (location) {
        inventoryMap.set(location.id, {
          quantity: parseFloat(item.quantity) || 0,
          sku: item.materialId,
        });
      }
    }
  });
  
  const racks = locationsToRacks(locations, inventoryMap);
  
  // Calculate warehouse dimensions (accounting for grid layout with labels and spacing)
  const sectionHeight = 450;
  const labelHeight = 40;
  const sectionSpacing = 50;
  const sectionPadding = 50;
  const totalHeight = sectionPadding + 3 * (sectionHeight + labelHeight + sectionSpacing) - sectionSpacing + sectionPadding;
  
  const maxX = Math.max(...racks.map((r) => r.x + r.width), 2500);
  const maxY = Math.max(...racks.map((r) => r.y + r.height), totalHeight);
  
  return {
    id: warehouseId,
    name: warehouseName,
    warehouseId,
    width: maxX + 100,
    height: maxY + 100,
    racks,
    aisles: [], // Will be calculated if needed
  };
}

