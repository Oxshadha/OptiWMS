import { WarehouseLayout, RackUnit, LocationBin, RackStatus } from "@/lib/types/warehouse-layout";

// Helper function to generate varied occupancy quantities (0-100% of max capacity)
function generateOccupancyQuantity(): number {
  const occupancyLevel = Math.random();
  if (occupancyLevel < 0.4) {
    // Low occupancy: 10-49 units (10-49%)
    return Math.floor(Math.random() * 40) + 10;
  } else if (occupancyLevel < 0.8) {
    // Medium occupancy: 50-84 units (50-84%)
    return Math.floor(Math.random() * 35) + 50;
  } else {
    // High occupancy: 85-100 units (85-100%)
    return Math.floor(Math.random() * 16) + 85;
  }
}

/**
 * Generate warehouse layout for Warehouse 1
 * Following warehouse layout guide principles:
 * - Aisle width: 12-13 feet (150-180 SVG units)
 * - Space allocation: 22-27% for storage
 * - Zones separated: Reception, Storage, Picking, Shipping
 */
export function generateWarehouse1Layout(): WarehouseLayout {
  const racks: RackUnit[] = [];
  const aisles: WarehouseLayout["aisles"] = [];
  
  // Storage Zone (ST) - Main storage area (22-27% of space)
  const storageRacks: RackUnit[] = [];
  let rackX = 50;
  let rackY = 50;
  const rackWidth = 80;
  const rackHeight = 120;
  const rackSpacing = 35; // Space between racks vertically (increased for better visibility)
  const aisleWidth = 160; // 12-13 feet equivalent (wider for forklifts)

  // Create 4 aisles with racks on both sides (more realistic)
  for (let aisle = 1; aisle <= 4; aisle++) {
    const aisleX = rackX + (aisle - 1) * (rackWidth * 2 + aisleWidth + 40);
    
    // Left side racks (bays 1-5)
    for (let bay = 1; bay <= 5; bay++) {
      const bins: LocationBin[] = [];
      for (let level = 1; level <= 5; level++) {
        const position = "A";
        const binId = `ST-${aisle.toString().padStart(2, "0")}-${bay.toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-${position}`;
        
        // More realistic occupancy distribution
        const occupancyChance = 0.5 + (bay % 3) * 0.1; // Vary by bay
        const isOccupied = Math.random() < occupancyChance;
        const isReserved = !isOccupied && Math.random() > 0.8;
        
        bins.push({
          id: binId,
          level,
          status: isOccupied ? "occupied" : isReserved ? "reserved" : "empty",
          inventory: isOccupied
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 1000}`,
                quantity: generateOccupancyQuantity(),
                weight: Math.floor(generateOccupancyQuantity() * 1.5) + 20,
                receivedAt:
                  Math.random() > 0.7
                    ? new Date(Date.now() - Math.random() * 3600000).toISOString()
                    : undefined,
              }
            : undefined,
        });
      }

      // Add some variety in rack status for demo
      let rackStatus: RackStatus = "active";
      if (aisle === 1 && bay === 3) rackStatus = "maintenance"; // Demo: one rack in maintenance
      if (aisle === 2 && bay === 5) rackStatus = "reserved"; // Demo: one reserved rack
      if (aisle === 3 && bay === 2) rackStatus = "out_of_service"; // Demo: one rack out of service

      storageRacks.push({
        id: `ST-${aisle.toString().padStart(2, "0")}-${bay.toString().padStart(3, "0")}`,
        zone: "ST",
        aisle,
        bay,
        x: aisleX,
        y: rackY + (bay - 1) * (rackHeight + rackSpacing),
        width: rackWidth,
        height: rackHeight,
        bins,
        maxLevels: 5,
        status: rackStatus,
        description: 
          bay === 1 ? "Electronics storage - High value items" :
          bay === 3 ? "Bulk storage - Heavy items" :
          undefined,
      });
    }

    // Right side racks (bays 6-10)
    for (let bay = 1; bay <= 5; bay++) {
      const bins: LocationBin[] = [];
      for (let level = 1; level <= 5; level++) {
        const position = "B";
        const binId = `ST-${aisle.toString().padStart(2, "0")}-${(bay + 5).toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-${position}`;
        
        const occupancyChance = 0.5 + (bay % 3) * 0.1;
        const isOccupied = Math.random() < occupancyChance;
        const isReserved = !isOccupied && Math.random() > 0.8;
        
        bins.push({
          id: binId,
          level,
          status: isOccupied ? "occupied" : isReserved ? "reserved" : "empty",
          inventory: isOccupied
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 1000}`,
                quantity: generateOccupancyQuantity(),
                weight: Math.floor(generateOccupancyQuantity() * 1.5) + 20,
                receivedAt:
                  Math.random() > 0.7
                    ? new Date(Date.now() - Math.random() * 3600000).toISOString()
                    : undefined,
              }
            : undefined,
        });
      }

      storageRacks.push({
        id: `ST-${aisle.toString().padStart(2, "0")}-${(bay + 5).toString().padStart(3, "0")}`,
        zone: "ST",
        aisle,
        bay: bay + 5,
        x: aisleX + rackWidth + aisleWidth,
        y: rackY + (bay - 1) * (rackHeight + rackSpacing),
        width: rackWidth,
        height: rackHeight,
        bins,
        maxLevels: 5,
        status: "active",
      });
    }

    // Add aisle (12-13 feet wide)
    aisles.push({
      id: `aisle-${aisle}`,
      x: aisleX + rackWidth,
      y: rackY - 20,
      width: aisleWidth,
      height: rackHeight * 5 + rackSpacing * 4 + 40,
    });
  }

  racks.push(...storageRacks);

  // Reception Zone (RC) - Located at entrance, separated from shipping
  const receptionRacks: RackUnit[] = [];
  const rcX = 50;
  const rcY = rackY + rackHeight * 5 + rackSpacing * 4 + 150; // Separated from storage

  for (let bay = 1; bay <= 4; bay++) {
    const bins: LocationBin[] = [];
    for (let level = 1; level <= 3; level++) {
      const binId = `RC-01-${bay.toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-A`;
      bins.push({
        id: binId,
        level,
        status: Math.random() > 0.5 ? "occupied" : "empty",
        inventory:
          Math.random() > 0.5
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 2000}`,
                quantity: Math.floor(Math.random() * 30) + 5,
                weight: Math.floor(Math.random() * 80) + 10,
                receivedAt: new Date(Date.now() - Math.random() * 1800000).toISOString(), // Recently received
              }
            : undefined,
      });
    }

    receptionRacks.push({
      id: `RC-01-${bay.toString().padStart(3, "0")}`,
      zone: "RC",
      aisle: 1,
      bay,
      x: rcX + (bay - 1) * (rackWidth + 30),
      y: rcY,
      width: rackWidth,
      height: rackHeight * 0.6,
      bins,
      maxLevels: 3,
      status: "active",
      description: "Incoming goods - Temporary storage for inspection",
    });
  }

  racks.push(...receptionRacks);

  // Picking Zone (PK) - Fast-moving items, quick access
  const pickingRacks: RackUnit[] = [];
  const pkX = rcX + rackWidth * 4 + 30 * 3 + 100;
  const pkY = rcY;

  for (let bay = 1; bay <= 3; bay++) {
    const bins: LocationBin[] = [];
    for (let level = 1; level <= 2; level++) {
      const binId = `PK-01-${bay.toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-A`;
      bins.push({
        id: binId,
        level,
        status: Math.random() > 0.4 ? "occupied" : "empty",
        inventory:
          Math.random() > 0.4
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 3000}`,
                quantity: Math.floor(Math.random() * 20) + 1,
                weight: Math.floor(Math.random() * 50) + 5,
              }
            : undefined,
      });
    }

    pickingRacks.push({
      id: `PK-01-${bay.toString().padStart(3, "0")}`,
      zone: "PK",
      aisle: 1,
      bay,
      x: pkX + (bay - 1) * (rackWidth + 30),
      y: pkY,
      width: rackWidth,
      height: rackHeight * 0.4,
      bins,
      maxLevels: 2,
      status: "active",
      description: "Fast-moving items - Quick access for order fulfillment",
    });
  }

  racks.push(...pickingRacks);

  // Shipping/Packing Zone (SH) - Separated from Reception to prevent bottlenecks
  const shippingRacks: RackUnit[] = [];
  const shX = 50;
  const shY = rcY + rackHeight * 0.6 + 100; // Below reception, separated

  for (let bay = 1; bay <= 3; bay++) {
    const bins: LocationBin[] = [];
    for (let level = 1; level <= 2; level++) {
      const binId = `SH-01-${bay.toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-A`;
      bins.push({
        id: binId,
        level,
        status: Math.random() > 0.6 ? "occupied" : "empty",
        inventory:
          Math.random() > 0.6
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 4000}`,
                quantity: Math.floor(Math.random() * 15) + 1,
                weight: Math.floor(Math.random() * 40) + 5,
              }
            : undefined,
      });
    }

    shippingRacks.push({
      id: `SH-01-${bay.toString().padStart(3, "0")}`,
      zone: "SH",
      aisle: 1,
      bay,
      x: shX + (bay - 1) * (rackWidth + 30),
      y: shY,
      width: rackWidth,
      height: rackHeight * 0.35,
      bins,
      maxLevels: 2,
      status: "active",
      description: "Packed orders - Ready for shipment",
    });
  }

  racks.push(...shippingRacks);

  // Calculate total dimensions
  const maxX = Math.max(...racks.map((r) => r.x + r.width)) + 50;
  const maxY = Math.max(...racks.map((r) => r.y + r.height)) + 50;

  return {
    id: "warehouse-1-layout",
    name: "Warehouse 1 Layout",
    warehouseId: "warehouse-1",
    width: maxX,
    height: maxY,
    racks,
    aisles,
  };
}

/**
 * Generate warehouse layout for Warehouse 2
 * Smaller warehouse with 2 aisles
 */
export function generateWarehouse2Layout(): WarehouseLayout {
  const racks: RackUnit[] = [];
  const aisles: WarehouseLayout["aisles"] = [];
  
  // Storage Zone (ST) - Main storage area
  const storageRacks: RackUnit[] = [];
  let rackX = 50;
  let rackY = 50;
  const rackWidth = 80;
  const rackHeight = 120;
  const rackSpacing = 35; // Space between racks vertically (increased for better visibility)
  const aisleWidth = 160;

  // Create 2 aisles with racks on both sides
  for (let aisle = 1; aisle <= 2; aisle++) {
    const aisleX = rackX + (aisle - 1) * (rackWidth * 2 + aisleWidth + 40);
    
    // Left side racks
    for (let bay = 1; bay <= 4; bay++) {
      const bins: LocationBin[] = [];
      for (let level = 1; level <= 5; level++) {
        const position = "A";
        const binId = `ST-${aisle.toString().padStart(2, "0")}-${bay.toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-${position}`;
        
        const occupancyChance = 0.6;
        const isOccupied = Math.random() < occupancyChance;
        const isReserved = !isOccupied && Math.random() > 0.7;
        
        bins.push({
          id: binId,
          level,
          status: isOccupied ? "occupied" : isReserved ? "reserved" : "empty",
          inventory: isOccupied
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 5000}`,
                quantity: generateOccupancyQuantity(),
                weight: Math.floor(generateOccupancyQuantity() * 1.5) + 20,
                receivedAt:
                  Math.random() > 0.7
                    ? new Date(Date.now() - Math.random() * 3600000).toISOString()
                    : undefined,
              }
            : undefined,
        });
      }

      let rackStatus: RackStatus = "active";
      if (aisle === 1 && bay === 2) rackStatus = "out_of_service"; // Demo: one out of service

      storageRacks.push({
        id: `ST-${aisle.toString().padStart(2, "0")}-${bay.toString().padStart(3, "0")}`,
        zone: "ST",
        aisle,
        bay,
        x: aisleX,
        y: rackY + (bay - 1) * (rackHeight + rackSpacing),
        width: rackWidth,
        height: rackHeight,
        bins,
        maxLevels: 5,
        status: rackStatus,
        description: bay === 1 ? "Bulk storage - Heavy items" : undefined,
      });
    }

    // Right side racks
    for (let bay = 1; bay <= 4; bay++) {
      const bins: LocationBin[] = [];
      for (let level = 1; level <= 5; level++) {
        const position = "B";
        const binId = `ST-${aisle.toString().padStart(2, "0")}-${(bay + 4).toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-${position}`;
        
        const occupancyChance = 0.6;
        const isOccupied = Math.random() < occupancyChance;
        const isReserved = !isOccupied && Math.random() > 0.7;
        
        bins.push({
          id: binId,
          level,
          status: isOccupied ? "occupied" : isReserved ? "reserved" : "empty",
          inventory: isOccupied
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 5000}`,
                quantity: generateOccupancyQuantity(),
                weight: Math.floor(generateOccupancyQuantity() * 1.5) + 20,
                receivedAt:
                  Math.random() > 0.7
                    ? new Date(Date.now() - Math.random() * 3600000).toISOString()
                    : undefined,
              }
            : undefined,
        });
      }

      storageRacks.push({
        id: `ST-${aisle.toString().padStart(2, "0")}-${(bay + 4).toString().padStart(3, "0")}`,
        zone: "ST",
        aisle,
        bay: bay + 4,
        x: aisleX + rackWidth + aisleWidth,
        y: rackY + (bay - 1) * (rackHeight + rackSpacing),
        width: rackWidth,
        height: rackHeight,
        bins,
        maxLevels: 5,
        status: "active",
      });
    }

    // Add aisle
    aisles.push({
      id: `aisle-${aisle}`,
      x: aisleX + rackWidth,
      y: rackY - 20,
      width: aisleWidth,
      height: rackHeight * 4 + rackSpacing * 3 + 40,
    });
  }

  racks.push(...storageRacks);

  // Reception Zone (RC)
  const receptionRacks: RackUnit[] = [];
  const rcX = 50;
  const rcY = rackY + rackHeight * 4 + rackSpacing * 3 + 100;

  for (let bay = 1; bay <= 2; bay++) {
    const bins: LocationBin[] = [];
    for (let level = 1; level <= 3; level++) {
      const binId = `RC-01-${bay.toString().padStart(3, "0")}-${level.toString().padStart(2, "0")}-A`;
      bins.push({
        id: binId,
        level,
        status: Math.random() > 0.5 ? "occupied" : "empty",
        inventory:
          Math.random() > 0.5
            ? {
                sku: `SKU-${Math.floor(Math.random() * 1000) + 6000}`,
                quantity: Math.floor(Math.random() * 30) + 5,
                weight: Math.floor(Math.random() * 80) + 10,
                receivedAt: new Date(Date.now() - Math.random() * 1800000).toISOString(),
              }
            : undefined,
      });
    }

    receptionRacks.push({
      id: `RC-01-${bay.toString().padStart(3, "0")}`,
      zone: "RC",
      aisle: 1,
      bay,
      x: rcX + (bay - 1) * (rackWidth + 30),
      y: rcY,
      width: rackWidth,
      height: rackHeight * 0.6,
      bins,
      maxLevels: 3,
      status: "active",
      description: "Receiving area - Inspection pending",
    });
  }

  racks.push(...receptionRacks);

  // Calculate total dimensions
  const maxX = Math.max(...racks.map((r) => r.x + r.width)) + 50;
  const maxY = Math.max(...racks.map((r) => r.y + r.height)) + 50;

  return {
    id: "warehouse-2-layout",
    name: "Warehouse 2 Layout",
    warehouseId: "warehouse-2",
    width: maxX,
    height: maxY,
    racks,
    aisles,
  };
}

/**
 * Get warehouse layout by warehouse ID
 */
export function getWarehouseLayout(warehouseId: string): WarehouseLayout {
  if (warehouseId === "warehouse-1" || warehouseId === "1") {
    return generateWarehouse1Layout();
  } else if (warehouseId === "warehouse-2" || warehouseId === "2") {
    return generateWarehouse2Layout();
  }
  // Default to Warehouse 1
  return generateWarehouse1Layout();
}

/**
 * Legacy function for backward compatibility
 */
export function generateSampleWarehouseLayout(): WarehouseLayout {
  return generateWarehouse1Layout();
}
