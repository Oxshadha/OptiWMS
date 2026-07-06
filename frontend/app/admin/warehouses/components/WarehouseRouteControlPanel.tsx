"use client";

import { useMemo, useState } from "react";
import { WarehouseRouteMap, type RouteWorkerMarker } from "@/components/WarehouseRouteMap";
import {
  GridCoord,
  buildRouteInstruction,
  optimizeWarehouseRoute,
  ROUTE_PRESETS,
  PathfindingAlgorithm,
} from "@/lib/warehouse-routing";
import clsx from "clsx";

const workers: RouteWorkerMarker[] = [
  { id: "w-001", name: "Forklift 01", coord: { x: 13, y: 5 }, status: "putaway" },
  { id: "w-002", name: "Forklift 02", coord: { x: 21, y: 3 }, status: "picking" },
  { id: "w-003", name: "Forklift 03", coord: { x: 6, y: 14 }, status: "idle" },
];

export function WarehouseRouteControlPanel() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(ROUTE_PRESETS[0].id);
  const [algorithm, setAlgorithm] = useState<PathfindingAlgorithm>("astar");
  const [avoidActiveForklift, setAvoidActiveForklift] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [showVisitedNodes, setShowVisitedNodes] = useState(false);

  const preset1 = useMemo(() => ROUTE_PRESETS.find((p) => p.id === selectedPresetId) || ROUTE_PRESETS[0], [selectedPresetId]);
  
  // Pick a secondary preset for collision testing (use opposite type or just next preset)
  const preset2 = useMemo(() => {
    const isPutaway = preset1.operation === "putaway";
    return ROUTE_PRESETS.find(p => p.operation === (isPutaway ? "picking" : "putaway")) || ROUTE_PRESETS[2];
  }, [preset1]);

  const route1 = useMemo(
    () =>
      optimizeWarehouseRoute({
        operation: preset1.operation,
        locationCodes: preset1.locationCodes,
        avoidPath: [],
        algorithm,
      }),
    [preset1, algorithm]
  );

  const route2 = useMemo(
    () => {
      if (!avoidActiveForklift) return null;
      return optimizeWarehouseRoute({
        operation: preset2.operation,
        locationCodes: preset2.locationCodes,
        avoidPath: route1?.path || [],
        algorithm,
      });
    },
    [preset2, route1, avoidActiveForklift, algorithm]
  );

  const totalVisitedNodes = (route1?.totalVisitedNodes || 0) + (route2?.totalVisitedNodes || 0);
  const totalRuntimeMs = (route1?.totalRuntimeMs || 0) + (route2?.totalRuntimeMs || 0);
  const overlapCount = (route1?.overlapCells?.length || 0) + (route2?.overlapCells?.length || 0);

  return (
    <div className="card bg-base-100 border border-base-300 rounded-xl p-0 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="border-b border-base-300 bg-base-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-base-content">Pathfinding Lab</h2>
            <p className="text-sm text-base-content/60 mt-1">
              Test A* and Dijkstra routes on a synthetic warehouse coordinate map, then verify whether a second forklift route collides with an active path or reroutes around it.
            </p>
          </div>
          
          {/* Performance Metrics */}
          <div className="flex bg-white border border-base-200 rounded-xl shadow-sm divide-x divide-base-200">
            <div className="px-4 py-3 text-center min-w-[120px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-1">Algorithm</div>
              <div className="text-lg font-black text-base-content">
                {algorithm === "astar" ? "A*" : "Dijkstra"}
              </div>
            </div>
            <div className="px-4 py-3 text-center min-w-[100px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-1">Overlap Cells</div>
              <div className={clsx("text-lg font-black", overlapCount > 0 ? "text-error" : "text-success")}>
                {overlapCount}
              </div>
            </div>
            <div className="px-4 py-3 text-center min-w-[100px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-1">Visited Nodes</div>
              <div className="text-lg font-black text-base-content">
                {totalVisitedNodes}
              </div>
            </div>
            <div className="px-4 py-3 text-center min-w-[100px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-1">Runtime</div>
              <div className="text-lg font-black text-base-content">
                {totalRuntimeMs.toFixed(2)} ms
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px] divide-y lg:divide-y-0 lg:divide-x divide-base-300">
        
        {/* Left Sidebar: Controls */}
        <div className="p-5 bg-base-50/50 space-y-6">
          <div>
            <h3 className="font-bold text-base-content mb-4">Simulation controls</h3>
            
            <div className="space-y-4">
              <div className="form-control">
                <label className="label pt-0"><span className="label-text font-semibold">Scenario (Worker 1)</span></label>
                <select 
                  className="select select-bordered select-sm w-full"
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                >
                  <optgroup label="Putaway Scenarios">
                    {ROUTE_PRESETS.filter(p => p.operation === "putaway").map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Picking Scenarios">
                    {ROUTE_PRESETS.filter(p => p.operation === "picking").map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                </select>
                <label className="label pb-0"><span className="label-text-alt text-base-content/60">{preset1.description}</span></label>
              </div>

              <div className="form-control">
                <label className="label pt-0"><span className="label-text font-semibold">Algorithm</span></label>
                <select 
                  className="select select-bordered select-sm w-full"
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as PathfindingAlgorithm)}
                >
                  <option value="astar">A* with Manhattan heuristic</option>
                  <option value="dijkstra">Dijkstra (uniform cost)</option>
                </select>
              </div>

              <div className="divider my-2"></div>

              <label className="label cursor-pointer p-4 rounded-xl border border-base-200 bg-white hover:border-primary/30 transition-colors">
                <div>
                  <span className="label-text font-bold block mb-1">Avoid active path</span>
                  <span className="label-text-alt text-base-content/60 block">Deploys Worker 2 and blocks Worker 1's path</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={avoidActiveForklift}
                  onChange={(event) => setAvoidActiveForklift(event.target.checked)}
                />
              </label>

              <label className="label cursor-pointer p-3 rounded-xl border border-base-200 bg-white hover:border-primary/30 transition-colors">
                <span className="label-text font-bold">Show visited nodes</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={showVisitedNodes}
                  onChange={(event) => setShowVisitedNodes(event.target.checked)}
                />
              </label>

              <label className="label cursor-pointer p-3 rounded-xl border border-base-200 bg-white hover:border-primary/30 transition-colors">
                <span className="label-text font-bold">Show grid coordinates</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={showCoordinates}
                  onChange={(event) => setShowCoordinates(event.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Center: Map */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base-content">Bird-view warehouse map</h3>
              <p className="text-xs text-base-content/60">Synthetic coordinates represent the real rack logic until physical survey coordinates are connected.</p>
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><div className="w-3 h-1 bg-[#e11d48] rounded-full"></div> Route 1</span>
              {avoidActiveForklift && (
                <span className="flex items-center gap-1.5"><div className="w-3 h-1 bg-[#2563eb] rounded-full"></div> Route 2</span>
              )}
            </div>
          </div>
          <WarehouseRouteMap 
            route={route1} 
            route2={route2}
            workers={workers} 
            detail="admin" 
            showCoordinates={showCoordinates}
            showVisitedNodes={showVisitedNodes}
            visitedNodesCount={totalVisitedNodes}
          />
        </div>

        {/* Right Sidebar: Results */}
        <div className="p-5 bg-base-50/50 space-y-4">
          <h3 className="font-bold text-base-content mb-4">Route Summaries</h3>
          
          {route1 && (
            <div className="rounded-xl border border-base-200 bg-white p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#e11d48]"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm text-[#e11d48]">Worker 1 (Route 1)</div>
                <div className="badge badge-success badge-sm badge-outline">Found</div>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-base-content/70 font-medium">
                  {route1.start.label} → {route1.orderedStops.map(s => s.rackId).join(', ')} {route1.end ? `→ ${route1.end.label}` : ''}
                </div>
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-base-100">
                  <div>
                    <div className="text-[10px] text-base-content/50 font-bold uppercase">Distance</div>
                    <div className="text-sm font-bold">{route1.distance}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-base-content/50 font-bold uppercase">Visited</div>
                    <div className="text-sm font-bold">{route1.totalVisitedNodes}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-base-content/50 font-bold uppercase">Runtime</div>
                    <div className="text-sm font-bold">{route1.totalRuntimeMs.toFixed(2)}ms</div>
                  </div>
                </div>
                <div className="text-[11px] text-base-content/60 leading-relaxed font-mono bg-base-50 p-2 rounded-lg">
                  {route1.path.map((p, i) => i === 0 || i === route1.path.length - 1 ? `${p.x},${p.y}` : '').filter(Boolean).join(' ... ')}
                  <br />
                  ({route1.path.length} path nodes)
                </div>
              </div>
            </div>
          )}

          {avoidActiveForklift && route2 && (
            <div className="rounded-xl border border-base-200 bg-white p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#2563eb]"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm text-[#2563eb]">Worker 2 (Route 2)</div>
                <div className="badge badge-success badge-sm badge-outline">Found</div>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-base-content/70 font-medium">
                  {route2.start.label} → {route2.orderedStops.map(s => s.rackId).join(', ')} {route2.end ? `→ ${route2.end.label}` : ''}
                </div>
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-base-100">
                  <div>
                    <div className="text-[10px] text-base-content/50 font-bold uppercase">Distance</div>
                    <div className="text-sm font-bold">{route2.distance}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-base-content/50 font-bold uppercase">Visited</div>
                    <div className="text-sm font-bold">{route2.totalVisitedNodes}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-base-content/50 font-bold uppercase">Runtime</div>
                    <div className="text-sm font-bold">{route2.totalRuntimeMs.toFixed(2)}ms</div>
                  </div>
                </div>
                <div className="text-[11px] text-base-content/60 leading-relaxed font-mono bg-base-50 p-2 rounded-lg">
                  {route2.path.map((p, i) => i === 0 || i === route2.path.length - 1 ? `${p.x},${p.y}` : '').filter(Boolean).join(' ... ')}
                  <br />
                  ({route2.path.length} path nodes)
                </div>
              </div>
            </div>
          )}
          
          {!avoidActiveForklift && (
            <div className="rounded-xl border border-dashed border-base-300 bg-base-50 p-6 text-center text-base-content/50 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined mb-2 opacity-50">forklift</span>
              <p className="text-xs">Enable "Avoid active path" to deploy Worker 2 and test collision avoidance.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
