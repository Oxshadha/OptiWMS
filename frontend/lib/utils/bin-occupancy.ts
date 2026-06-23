import type { LocationBin } from "@/lib/types/warehouse-layout";
import type { BinOccupancy } from "@/lib/api/locations";

export function binPalletFillPercent(bin: LocationBin): number {
  if (!bin.inventory || (bin.palletCount ?? 0) <= 0) return 0;
  const cap = bin.maxPalletCapacity && bin.maxPalletCapacity > 0 ? bin.maxPalletCapacity : 1;
  return Math.min(((bin.palletCount ?? 0) / cap) * 100, 100);
}

export function applyOccupancyToBin(bin: LocationBin, occupancy?: BinOccupancy): LocationBin {
  if (!occupancy) return bin;
  return {
    ...bin,
    maxPalletCapacity: occupancy.maxPalletCapacity,
    palletCount: occupancy.palletCount,
    levelWeightCapacityKg: occupancy.levelWeightCapacityKg ?? undefined,
    levelWeightUsedKg: occupancy.levelWeightUsedKg ?? undefined,
    inventory: bin.inventory
      ? {
          ...bin.inventory,
          weight: occupancy.binWeightKg ?? bin.inventory.weight,
          unitsPerPallet: occupancy.unitsPerPallet ?? undefined,
          palletWeightKg: occupancy.palletWeightKg ?? undefined,
        }
      : undefined,
  };
}

export function levelBeamLabel(bin: LocationBin): string | null {
  if (bin.levelWeightCapacityKg == null || bin.levelWeightUsedKg == null) return null;
  return `Level beam: ${Math.round(bin.levelWeightUsedKg)}/${Math.round(bin.levelWeightCapacityKg)} kg`;
}
