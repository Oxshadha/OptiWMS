import type { WarehouseLayout } from "@/lib/types/warehouse-layout";

export interface WarehouseStats {
  totalRacks: number;
  totalBins: number;
  occupiedBins: number;
  reservedBins: number;
  emptyBins: number;
  occupancyRate: number;
  activeRacks: number;
  reservedRacks: number;
  maintenanceRacks: number;
  outOfServiceRacks: number;
}

export function calculateWarehouseStats(layout: WarehouseLayout): WarehouseStats {
  const totalRacks = layout.racks.length;
  const totalBins = layout.racks.reduce((sum, rack) => sum + rack.bins.length, 0);
  const occupiedBins = layout.racks.reduce(
    (sum, rack) => sum + rack.bins.filter((bin) => bin.status === "occupied").length,
    0
  );
  const reservedBins = layout.racks.reduce(
    (sum, rack) => sum + rack.bins.filter((bin) => bin.status === "reserved").length,
    0
  );
  const emptyBins = totalBins - occupiedBins - reservedBins;
  const occupancyRate = totalBins > 0 ? (occupiedBins / totalBins) * 100 : 0;

  const activeRacks = layout.racks.filter((rack) => rack.status === "active").length;
  const reservedRacks = layout.racks.filter((rack) => rack.status === "reserved").length;
  const maintenanceRacks = layout.racks.filter((rack) => rack.status === "maintenance").length;
  const outOfServiceRacks = layout.racks.filter((rack) => rack.status === "out_of_service").length;

  return {
    totalRacks,
    totalBins,
    occupiedBins,
    reservedBins,
    emptyBins,
    occupancyRate,
    activeRacks,
    reservedRacks,
    maintenanceRacks,
    outOfServiceRacks,
  };
}
