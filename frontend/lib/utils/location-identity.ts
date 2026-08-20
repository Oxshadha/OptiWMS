import type { Location } from "@/lib/api/locations";

/** Structural parts of a storage bin (canonical: AREA-ROW-BAY-LEVEL-BIN). */
export type LocationParts = {
  area: string;
  row: string;
  bay: string;
  level: number;
  bin: string;
};

export type LocationIdentityInput = Pick<
  Location,
  "locationCode" | "area" | "rowNumber" | "bayNumber" | "levelNumber" | "binPosition"
>;

/** Normalize storage area for rack grouping (ST → C). */
export function normalizeArea(area?: string | null): string {
  const raw = (area || "C").trim().toUpperCase();
  return raw === "ST" ? "C" : raw;
}

export function normalizeRow(row?: string | null): string {
  const n = parseInt(row || "1", 10);
  return String(Number.isFinite(n) ? n : 1).padStart(2, "0");
}

export function normalizeBay(bay?: string | null): string {
  const n = parseInt(bay || "1", 10);
  return String(Number.isFinite(n) ? n : 1).padStart(3, "0");
}

/** Derived rack key used across layout, slotting planner, and quarterly plans. */
export function deriveRackId(
  area?: string | null,
  row?: string | null,
  bay?: string | null
): string {
  return `${normalizeArea(area)}-${normalizeRow(row)}-${normalizeBay(bay)}`;
}

export function deriveRackIdFromLocation(loc: LocationIdentityInput): string {
  return deriveRackId(loc.area, loc.rowNumber, loc.bayNumber);
}

/** Parse canonical storage code `AREA-ROW-BAY-LEVEL-BIN` (row 2 digits, bay 3 digits). */
export function parseLocationCode(code?: string | null): LocationParts | null {
  if (!code?.trim()) return null;
  const parts = code.trim().split("-");
  if (parts.length < 5) return null;
  const bin = parts[parts.length - 1]?.toUpperCase() || "A";
  const level = parseInt(parts[parts.length - 2] || "1", 10);
  const bay = parts[parts.length - 3] || "001";
  const row = parts[parts.length - 4] || "01";
  const area = parts.slice(0, parts.length - 4).join("-").toUpperCase();
  if (!area) return null;
  return {
    area,
    row: normalizeRow(row),
    bay: normalizeBay(bay),
    level: Number.isFinite(level) ? level : 1,
    bin,
  };
}

export function parseRackId(rackId: string): { area: string; row: string; bay: string } | null {
  const m = rackId.trim().match(/^([A-Z]+)-(\d+)-(\d+)$/i);
  if (!m) return null;
  return {
    area: m[1].toUpperCase(),
    row: normalizeRow(m[2]),
    bay: normalizeBay(m[3]),
  };
}

export function rackIdFromLocationCode(code?: string | null): string | null {
  const parsed = parseLocationCode(code);
  if (!parsed) return null;
  return deriveRackId(parsed.area, parsed.row, parsed.bay);
}

/** Manager-facing label: rack + bin detail. */
export function formatManagerLocationLabel(
  loc: LocationIdentityInput | null | undefined,
  locationCode?: string | null
): string {
  if (loc?.area != null) {
    const rack = deriveRackIdFromLocation(loc);
    const level = loc.levelNumber ?? 1;
    const bin = (loc.binPosition || "A").toUpperCase();
    const code = loc.locationCode || locationCode;
    return code ? `Rack ${rack} · L${level}-${bin} (${code})` : `Rack ${rack} · L${level}-${bin}`;
  }
  const code = locationCode?.trim();
  if (!code) return "—";
  const parsed = parseLocationCode(code);
  if (!parsed) return code;
  const rack = deriveRackId(parsed.area, parsed.row, parsed.bay);
  return `Rack ${rack} · L${parsed.level}-${parsed.bin} (${code})`;
}

export function buildWarehouseLayoutUrl(warehouseId: string, rackId?: string | null): string {
  const base = `/admin/warehouses?warehouseId=${encodeURIComponent(warehouseId)}`;
  if (!rackId) return base;
  return `${base}&rack=${encodeURIComponent(rackId)}`;
}

export function locationMatchesRack(loc: LocationIdentityInput, rackId: string): boolean {
  return deriveRackIdFromLocation(loc) === rackId;
}

/**
 * Resolved presentation for a bin. Prefers structural fields (area/row/bay) from a Location row
 * so rack labels match the warehouse layout even when location_code uses a different area prefix
 * (e.g. area=FG but canonical code prefix B from legacy seeding).
 */
export type LocationPresentation = {
  locationCode: string;
  rackId: string;
  binLabel: string;
  managerLabel: string;
  /** True when rackId came from Location structural fields, not parsed code only. */
  fromStructuralFields: boolean;
};

export function buildLocationIndex(locations: Location[]): Map<string, Location> {
  const index = new Map<string, Location>();
  for (const loc of locations) {
    if (loc.locationCode) index.set(loc.locationCode, loc);
  }
  return index;
}

export function resolveLocationPresentation(
  locationCode: string | null | undefined,
  locationIndex?: Map<string, Location>
): LocationPresentation | null {
  if (!locationCode?.trim()) return null;
  const code = locationCode.trim();
  const loc = locationIndex?.get(code);
  if (loc) {
    const rackId = deriveRackIdFromLocation(loc);
    const level = loc.levelNumber ?? 1;
    const bin = (loc.binPosition || "A").toUpperCase();
    return {
      locationCode: code,
      rackId,
      binLabel: `L${level}-${bin}`,
      managerLabel: `Rack ${rackId} · L${level}-${bin}`,
      fromStructuralFields: true,
    };
  }
  const parsed = parseLocationCode(code);
  if (parsed) {
    const rackId = deriveRackId(parsed.area, parsed.row, parsed.bay);
    return {
      locationCode: code,
      rackId,
      binLabel: `L${parsed.level}-${parsed.bin}`,
      managerLabel: `Rack ${rackId} · L${parsed.level}-${parsed.bin}`,
      fromStructuralFields: false,
    };
  }
  return {
    locationCode: code,
    rackId: code,
    binLabel: code,
    managerLabel: code,
    fromStructuralFields: false,
  };
}
