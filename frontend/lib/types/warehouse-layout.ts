/**
 * Warehouse Layout Types
 * Based on the coordinate system: ZONE-AISLE-BAY-LEVEL-POSITION
 */

export type BinStatus = 'empty' | 'occupied' | 'reserved' | 'quarantined';

export interface LocationBin {
  id: string; // "ST-01-004-03-A"
  level: number; // 1 to 5 (1 = Floor, 5 = Top)
  status: BinStatus;
  inventory?: {
    sku: string;
    quantity: number;
    weight: number;
    receivedAt?: string; // For "recently received" pulsing animation
  };
}

export type RackStatus = 'active' | 'maintenance' | 'reserved' | 'out_of_service';

export interface RackUnit {
  id: string; // "ST-01-004"
  zone: string; // "ST", "RC", "PK"
  aisle: number; // 01, 02, etc.
  bay: number; // 004, 005, etc.
  x: number; // SVG x position
  y: number; // SVG y position
  width: number; // SVG width
  height: number; // SVG height
  bins: LocationBin[]; // Array of bins representing the vertical stack
  maxLevels: number; // Maximum vertical levels (default 5)
  status: RackStatus; // Rack operational status
  description?: string; // Notes/description about what's in the rack
  notes?: string; // Additional notes
  velocity?: number; // Velocity percentage (0-100) for heat map visualization
}

export interface WarehouseLayout {
  id: string;
  name: string;
  warehouseId: string; // Reference to warehouse ID
  width: number; // Total warehouse width in SVG units
  height: number; // Total warehouse height in SVG units
  racks: RackUnit[];
  aisles: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}

