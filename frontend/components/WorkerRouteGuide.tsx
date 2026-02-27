"use client";

import { useEffect, useMemo, useState } from "react";
import { locationsApi, type Location } from "@/lib/api/locations";

type OperationType = "putaway" | "picking";

interface WorkerRouteGuideProps {
  warehouseId?: string;
  targetLocationCode?: string | null;
  operationType: OperationType;
}

interface ParsedLocationCode {
  area: string;
  row: number;
  bay: number;
  level: number;
  position: string;
}

interface GridPoint {
  row: number;
  bay: number;
}

const parseLocationCode = (code?: string | null): ParsedLocationCode | null => {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  const match = normalized.match(/^([A-Z])-(\d{2})-(\d{2})-(\d{1,2})-([A-Z])$/);
  if (!match) return null;
  return {
    area: match[1],
    row: Number(match[2]),
    bay: Number(match[3]),
    level: Number(match[4]),
    position: match[5],
  };
};

const aStar = (start: GridPoint, end: GridPoint, maxRow: number, maxBay: number): GridPoint[] => {
  const key = (p: GridPoint) => `${p.row}:${p.bay}`;
  const heuristic = (a: GridPoint, b: GridPoint) => Math.abs(a.row - b.row) + Math.abs(a.bay - b.bay);
  const neighbors = (p: GridPoint): GridPoint[] => {
    const points = [
      { row: p.row + 1, bay: p.bay },
      { row: p.row - 1, bay: p.bay },
      { row: p.row, bay: p.bay + 1 },
      { row: p.row, bay: p.bay - 1 },
    ];
    return points.filter((item) => item.row >= 1 && item.row <= maxRow && item.bay >= 1 && item.bay <= maxBay);
  };

  const open = new Map<string, GridPoint>();
  const cameFrom = new Map<string, GridPoint>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  open.set(key(start), start);
  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, end));

  while (open.size > 0) {
    const current = Array.from(open.values()).reduce((best, point) =>
      (fScore.get(key(point)) ?? Number.MAX_SAFE_INTEGER) <
      (fScore.get(key(best)) ?? Number.MAX_SAFE_INTEGER)
        ? point
        : best
    );
    if (current.row === end.row && current.bay === end.bay) {
      const path: GridPoint[] = [current];
      let currKey = key(current);
      while (cameFrom.has(currKey)) {
        const prev = cameFrom.get(currKey)!;
        path.unshift(prev);
        currKey = key(prev);
      }
      return path;
    }

    open.delete(key(current));
    for (const next of neighbors(current)) {
      const tentative = (gScore.get(key(current)) ?? Number.MAX_SAFE_INTEGER) + 1;
      if (tentative < (gScore.get(key(next)) ?? Number.MAX_SAFE_INTEGER)) {
        cameFrom.set(key(next), current);
        gScore.set(key(next), tentative);
        fScore.set(key(next), tentative + heuristic(next, end));
        if (!open.has(key(next))) {
          open.set(key(next), next);
        }
      }
    }
  }
  return [start, end];
};

const getDirections = (
  path: GridPoint[],
  parsed: ParsedLocationCode,
  operationType: OperationType,
  startLabel: string
): string[] => {
  const steps: string[] = [`Start at ${startLabel}`];
  if (path.length >= 2) {
    const start = path[0];
    const end = path[path.length - 1];
    const rowDelta = end.row - start.row;
    const bayDelta = end.bay - start.bay;
    if (rowDelta !== 0) {
      steps.push(`Move ${Math.abs(rowDelta)} row(s) ${rowDelta > 0 ? "down" : "up"}.`);
    }
    if (bayDelta !== 0) {
      steps.push(`Move ${Math.abs(bayDelta)} bay(s) ${bayDelta > 0 ? "right" : "left"}.`);
    }
  }
  steps.push(`Reach Zone ${parsed.area}, Row ${parsed.row.toString().padStart(2, "0")}, Bay ${parsed.bay.toString().padStart(2, "0")}.`);
  steps.push(`Use Level ${parsed.level}, Bin ${parsed.position}.`);
  if (operationType === "picking") {
    steps.push("After pick, return to packing/staging using reverse route.");
  }
  return steps;
};

export function WorkerRouteGuide({ warehouseId, targetLocationCode, operationType }: WorkerRouteGuideProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!warehouseId) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await locationsApi.getStorageLocationsByWarehouse(warehouseId);
        setLocations(data);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [warehouseId]);

  const routeData = useMemo(() => {
    const parsed = parseLocationCode(targetLocationCode);
    if (!parsed) return null;
    const inZone = locations.filter((loc) => (loc.area || "").toUpperCase() === parsed.area);
    const maxRow = Math.max(...inZone.map((loc) => Number(loc.rowNumber || 0)), parsed.row, 1);
    const maxBay = Math.max(...inZone.map((loc) => Number(loc.bayNumber || 0)), parsed.bay, 1);

    const start: GridPoint =
      operationType === "putaway"
        ? { row: 1, bay: 1 }
        : { row: 1, bay: maxBay };
    const end: GridPoint = { row: parsed.row, bay: parsed.bay };
    const path = aStar(start, end, maxRow, maxBay);
    const startLabel = operationType === "putaway" ? "Receiving Dock Entry" : "Packing/Staging Entry";
    const directions = getDirections(path, parsed, operationType, startLabel);

    return { parsed, maxRow, maxBay, path, directions, start, end };
  }, [locations, targetLocationCode, operationType]);

  if (!targetLocationCode) return null;

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Route Guide</div>
        <span className="badge badge-outline">{operationType === "putaway" ? "Putaway" : "Picking"}</span>
      </div>
      {loading && <div className="text-xs text-base-content/60">Loading route map...</div>}
      {!loading && !routeData && (
        <div className="text-xs text-base-content/60">
          Target location format not routable yet: {targetLocationCode}
        </div>
      )}
      {!loading && routeData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            {routeData.directions.map((step, idx) => (
              <div key={idx} className="text-xs">
                {idx + 1}. {step}
              </div>
            ))}
          </div>
          <div className="overflow-auto">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${Math.min(routeData.maxBay, 12)}, minmax(20px, 1fr))`,
              }}
            >
              {Array.from({ length: routeData.maxRow }).flatMap((_, rowIdx) => {
                const row = rowIdx + 1;
                return Array.from({ length: routeData.maxBay }).map((__, bayIdx) => {
                  const bay = bayIdx + 1;
                  const isStart = row === routeData.start.row && bay === routeData.start.bay;
                  const isEnd = row === routeData.end.row && bay === routeData.end.bay;
                  const onPath = routeData.path.some((point) => point.row === row && point.bay === bay);
                  return (
                    <div
                      key={`${row}-${bay}`}
                      className={`h-6 rounded border text-[9px] flex items-center justify-center ${
                        isEnd
                          ? "bg-primary text-primary-content border-primary"
                          : isStart
                          ? "bg-info/20 border-info"
                          : onPath
                          ? "bg-success/20 border-success/40"
                          : "bg-base-200 border-base-300"
                      }`}
                      title={`R${row.toString().padStart(2, "0")} B${bay.toString().padStart(2, "0")}`}
                    >
                      {row}-{bay}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
