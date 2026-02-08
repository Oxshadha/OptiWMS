/**
 * Convert Location API data to WarehouseLayout format
 * SIMPLIFIED: Only shows STORAGE locations (receiving, packing, shipping areas are hidden)
 */

import { Location, LocationHierarchy } from '@/lib/api/locations';
import { WarehouseLayout, RackUnit, LocationBin, BinStatus } from '@/lib/types/warehouse-layout';
import { inventoryApi } from '@/lib/api/inventory';
import { materialsApi } from '@/lib/api/materials';

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
    // Normalize area code: Convert "ST" to "C" for consistency (storage areas use single letter)
    // This ensures all storage racks use consistent naming (C-01-01, A-01-01, etc.)
    let area = location.area || 'C';
    if (area === 'ST') {
      area = 'C'; // Standardize ST (Storage) to C for consistency
    }
    
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
 * SIMPLIFIED: Only shows STORAGE locations in a simple grid layout
 */
function locationsToRacks(
  locations: Location[],
  inventoryMap: Map<string, { quantity: number; sku: string }>
): RackUnit[] {
  // Safety check: Filter to only STORAGE locations (backend should already do this, but double-check)
  const storageLocations = locations.filter((loc) => 
    loc.zoneType === 'STORAGE' && loc.isActive !== false
  );
  
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
    // Normalize area: Convert "ST" to "C" for consistency
    let area = firstLocation.area || 'C';
    if (area === 'ST') {
      area = 'C'; // Standardize ST (Storage) to C for consistency
    }
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
  
  // Filter to only STORAGE locations (safety check - backend should already filter)
  const storageLocations = allLocations.filter((loc) => 
    loc.zoneType === 'STORAGE' && loc.isActive !== false
  );
  
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
    console.error('Failed to fetch materials for SKU mapping:', error);
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
  const racks = locationsToRacks(storageLocations, inventoryMap);
  
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
  const storageLocations = locations.filter((loc) => 
    loc.zoneType === 'STORAGE' && loc.isActive !== false
  );
  
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
    console.error('Failed to fetch materials for SKU mapping:', error);
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
  
  const racks = locationsToRacks(storageLocations, inventoryMap);
  
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
    aisles: [],
  };
}
