'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SparklesIcon, ArrowLeftIcon, CheckCircleIcon, MapIcon, ListBulletIcon } from '@heroicons/react/20/solid';
import toast from 'react-hot-toast';

import WarehouseVisualization from '@/components/WarehouseVisualizationNew';
import ControlPanel from '@/components/ControlPanelNew';
import PathVisualizer from '@/components/PathVisualizerNew';
import TurnByTurnNav from '@/components/TurnByTurnNav';
import {
  findPathWithFallback, optimizeMultiStop,
  PathNode, TurnByTurnStep, StopSegment, PickStop,
  MultiStopResponse, PathResponse,
} from '@/lib/pathfinding-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WarehouseNode {
  id: string; row: number; col: number; type: string; walkable: boolean;
}
interface WarehouseEdge { from: string; to: string; cost: number; }

// ── Full 7-zone × 10-bay warehouse layout (A–G, bays 1–10) ──────────────────
const ZONES = ['A','B','C','D','E','F','G'];
const BAYS  = [1,2,3,4,5,6,7,8,9,10];

function buildSampleWarehouse() {
  const nodes: any[] = [
    { id: 'ENTRY', row: 0,  col: 0,  type: 'entry', walkable: true },
    { id: 'EXIT',  row: 16, col: 10, type: 'exit',  walkable: true },
  ];
  const edges: any[] = [];

  ZONES.forEach((z, zi) => {
    BAYS.forEach(b => {
      nodes.push({ id: `${z}${b}`, row: zi * 2 + 1, col: b, type: 'rack', walkable: true });
    });
  });

  // Within-row bay connections (bidirectional)
  ZONES.forEach(z => {
    for (let b = 1; b < 10; b++) {
      edges.push({ from: `${z}${b}`, to: `${z}${b+1}`, cost: 1.5, bidirectional: true });
    }
  });

  // Cross-aisle connections at bay 1 (left end) and bay 10 (right end)
  for (let i = 0; i < ZONES.length - 1; i++) {
    const za = ZONES[i], zb = ZONES[i+1];
    edges.push({ from: `${za}1`,  to: `${zb}1`,  cost: 3.0, bidirectional: true });
    edges.push({ from: `${za}10`, to: `${zb}10`, cost: 3.0, bidirectional: true });
  }

  // ENTRY → Row A
  edges.push({ from: 'ENTRY', to: 'A1',  cost: 2.0, bidirectional: false });
  edges.push({ from: 'ENTRY', to: 'A10', cost: 2.5, bidirectional: false });

  // EXIT connections: G1 and G3–G10 (G2 not connected to EXIT)
  [1, 3, 4, 5, 6, 7, 8, 9, 10].forEach(b => {
    edges.push({ from: `G${b}`, to: 'EXIT', cost: 2.0, bidirectional: false });
  });

  return { name: 'OptiWMS Warehouse (A–G, 10 bays)', nodes, edges };
}

const SAMPLE_WAREHOUSE = buildSampleWarehouse();

// ─── Component ───────────────────────────────────────────────────────────────

export default function PathfindingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('orderId');
  const customerId = searchParams.get('customerId');

  const [nodes, setNodes] = useState<WarehouseNode[]>([]);
  const [edges, setEdges] = useState<WarehouseEdge[]>([]);
  const [path, setPath] = useState<PathNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [singleResult, setSingleResult] = useState<PathResponse | null>(null);
  const [multiResult, setMultiResult] = useState<MultiStopResponse | null>(null);
  const [warehouseConfig, setWarehouseConfig] = useState<any>(null);
  const [pickingItems, setPickingItems] = useState<any[]>([]);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);
  const [routeMode, setRouteMode] = useState<'single' | 'multi'>('single');

  // Derived nav data
  const turnByTurnSteps: TurnByTurnStep[] = singleResult?.turn_by_turn ?? [];
  const multiSegments: StopSegment[] = multiResult?.segments ?? [];
  const totalCost = routeMode === 'multi' ? (multiResult?.total_cost ?? 0) : (singleResult?.total_cost ?? 0);
  const estSeconds = routeMode === 'multi'
    ? (multiResult?.estimated_travel_seconds ?? 0)
    : (singleResult?.estimated_travel_seconds ?? 0);

  // ── Load warehouse ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsInitialLoading(true);
      try {
        const res = await fetch('http://localhost:8080/api/pathfinding/warehouse/graph', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        });
        if (res.ok) {
          const data = await res.json();
          if ((data.nodes || []).length >= 5) {
            const transformed = transformNodes(data.nodes || []);
            const genEdges = generateEdges(transformed);
            setWarehouseConfig(data);
            setNodes(transformed);
            setEdges(genEdges);
            if (orderId) loadPickingItems();
            setIsInitialLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      setWarehouseConfig(SAMPLE_WAREHOUSE);
      setNodes(SAMPLE_WAREHOUSE.nodes as WarehouseNode[]);
      setEdges(SAMPLE_WAREHOUSE.edges as WarehouseEdge[]);
      if (orderId) loadPickingItems();
      setIsInitialLoading(false);
    };
    load();
  }, [orderId]);

  const transformNodes = (raw: any[]): WarehouseNode[] =>
    raw.map((n: any) => {
      if (n.type === 'entry') return { id: n.id, row: 0, col: 0, type: 'entry', walkable: true };
      if (n.type === 'exit') return { id: n.id, row: 15, col: 11, type: 'exit', walkable: true };
      const areaNum = n.area ? n.area.charCodeAt(0) - 65 : 0;
      const rowNum = parseInt(n.row) || 1;
      const bayNum = parseInt(n.bay) || 1;
      return { id: n.id, row: areaNum * 4 + (rowNum - 1) + 1, col: bayNum, type: 'rack', walkable: n.walkable !== false };
    });

  const generateEdges = (ns: WarehouseNode[]): WarehouseEdge[] => {
    const racks = ns.filter(n => n.type === 'rack');
    const result: WarehouseEdge[] = [];
    for (let i = 0; i < racks.length; i++) {
      for (let j = i + 1; j < racks.length; j++) {
        const a = racks[i], b = racks[j];
        const dr = Math.abs(a.row - b.row), dc = Math.abs(a.col - b.col);
        if (dr === 0 && dc === 1) result.push({ from: a.id, to: b.id, cost: 1.0 });
        if (dc === 0 && dr === 1) result.push({ from: a.id, to: b.id, cost: 1.5 });
      }
    }
    racks.filter(n => n.row === 1).slice(0, 3).forEach(r => result.push({ from: 'ENTRY', to: r.id, cost: 2.0 }));
    racks.filter(n => n.row === 14).slice(0, 3).forEach(r => result.push({ from: r.id, to: 'EXIT', cost: 2.0 }));
    return result;
  };

  const loadPickingItems = () => {
    setPickingItems([
      { id: 1, sku: 'SKU-001', name: 'Item A', location: 'AISLE_1_A', qty: 2 },
      { id: 2, sku: 'SKU-002', name: 'Item B', location: 'AISLE_2_C', qty: 1 },
      { id: 3, sku: 'SKU-003', name: 'Item C', location: 'AISLE_3_B', qty: 1 },
    ]);
  };

  // ── Single-stop optimize ────────────────────────────────────────────────
  const handleOptimize = async (start: string, end: string, constraints: any) => {
    if (!warehouseConfig) return toast.error('Warehouse not loaded');
    setIsLoading(true);
    setRouteMode('single');
    setMultiResult(null);
    try {
      const cfg = { ...warehouseConfig, nodes, edges };
      const result = await findPathWithFallback(start, end, cfg, constraints);
      setPath(result.path || []);
      setSingleResult(result);
      if (result.path_found) {
        toast.success(`✅ Route found! ${result.path.length} steps, ${result.estimated_travel_seconds?.toFixed(0)}s`);
      } else {
        toast.error(`❌ No path found between ${start} and ${end}`);
      }
    } catch (err) {
      toast.error('Failed to optimize path');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Multi-stop optimize ─────────────────────────────────────────────────
  const handleMultiStopOptimize = async (stops: PickStop[], constraints: any) => {
    if (!warehouseConfig || stops.length === 0) return toast.error('No stops provided');
    setIsLoading(true);
    setRouteMode('multi');
    setSingleResult(null);
    try {
      const cfg = { ...warehouseConfig, nodes, edges };
      const result = await optimizeMultiStop('ENTRY', 'EXIT', stops, cfg, constraints);
      setPath(result.total_path || []);
      setMultiResult(result);
      if (result.route_found) {
        toast.success(`✅ Multi-stop route! ${stops.length} stops, ${result.estimated_travel_seconds}s est.`);
      } else {
        toast.error('❌ Could not find a complete multi-stop route');
      }
    } catch (err) {
      toast.error('Multi-stop optimization failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRoute = async () => {
    const hasRoute = routeMode === 'single' ? singleResult?.path_found : multiResult?.route_found;
    if (!hasRoute) return toast.error('Please generate a route first');
    setIsOrderConfirmed(true);
    toast.success('Route confirmed! Starting picking interface...');
    setTimeout(() => {
      router.push(`/picking${orderId ? `?orderId=${orderId}&customerId=${customerId}` : ''}`);
    }, 1500);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-6 px-4 md:px-8" style={{ background: '#F7F7F7' }}>
      {/* Loading */}
      {isInitialLoading && (
        <div className="min-h-screen flex flex-col items-center justify-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin" style={{ borderTopColor: '#CF0F47' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#111827' }}>Loading Warehouse</h2>
          <p style={{ color: '#6B7280' }}>Fetching real-time warehouse data...</p>
        </div>
      )}

      {!isInitialLoading && (
        <div>
          {/* ── Header ── */}
          <div className="max-w-7xl mx-auto mb-6">
            <div className="flex items-center justify-between p-5 rounded-2xl shadow-sm" style={{ background: '#111827' }}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#CF0F47' }}>
                  <span className="material-symbols-outlined text-white text-xl">route</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Route Optimizer</h1>
                  <p className="text-gray-400 text-sm mt-0.5">A* Warehouse Pathfinding Engine</p>
                  {orderId && (
                    <p className="text-gray-400 text-xs mt-0.5">
                      Order {orderId} &bull; Customer: {customerId || 'Unknown'}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/warehouses')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm text-white"
                style={{ background: '#1F2937' }}
                onMouseEnter={e => (e.currentTarget.style.background='#374151')}
                onMouseLeave={e => (e.currentTarget.style.background='#1F2937')}
              >
                <ArrowLeftIcon className="w-4 h-4" /> Back
              </button>
            </div>
          </div>

          {/* ── Service Quick Links ── */}
          <div className="max-w-7xl mx-auto mb-5">
            <div className="rounded-xl px-5 py-3 flex flex-wrap items-center gap-3 border" style={{ background: '#FFFFFF', borderColor: '#EFEFEF' }}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#39BE7D' }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#39BE7D' }} />
                </span>
                <span className="text-sm font-semibold" style={{ color: '#111827' }}>A* Path Optimization API</span>
                <span className="text-xs font-medium" style={{ color: '#39BE7D' }}>Live on :8081</span>
              </div>
              <div className="h-4 w-px hidden sm:block" style={{ background: '#EFEFEF' }} />
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'API Docs', icon: 'description', href: 'http://localhost:8081/api/docs', highlight: true },
                  { label: 'Health', icon: 'favorite', href: 'http://localhost:8081/health/' },
                  { label: 'Stats', icon: 'bar_chart', href: 'http://localhost:8081/api/pathfinding/stats' },
                  { label: 'Sample Warehouse', icon: 'map', href: 'http://localhost:8081/api/pathfinding/sample-warehouse' },
                  { label: 'OpenAPI JSON', icon: 'code', href: 'http://localhost:8081/api/openapi.json' },
                ].map(link => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={link.highlight
                      ? { background: '#CF0F47', color: '#FFFFFF' }
                      : { background: '#F7F7F7', color: '#374151', border: '1px solid #EFEFEF' }
                    }>
                    <span className="material-symbols-outlined text-sm">{link.icon}</span>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* ── Route mode tabs ── */}
          <div className="max-w-7xl mx-auto mb-5">
            <div className="inline-flex rounded-xl p-1 border" style={{ background: '#FFFFFF', borderColor: '#EFEFEF' }}>
              <button
                onClick={() => setRouteMode('single')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={routeMode === 'single'
                  ? { background: '#CF0F47', color: '#FFFFFF', boxShadow: '0 1px 4px rgba(207,15,71,0.3)' }
                  : { color: '#6B7280' }
                }
              >
                <MapIcon className="w-4 h-4" /> Single Route
              </button>
              <button
                onClick={() => setRouteMode('multi')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={routeMode === 'multi'
                  ? { background: '#CF0F47', color: '#FFFFFF', boxShadow: '0 1px 4px rgba(207,15,71,0.3)' }
                  : { color: '#6B7280' }
                }
              >
                <ListBulletIcon className="w-4 h-4" /> Multi-Stop Picking
              </button>
            </div>
          </div>

          {/* ── Picking items ── */}
          {pickingItems.length > 0 && (
            <div className="max-w-7xl mx-auto mb-6 bg-slate-800/60 border border-slate-700 rounded-xl shadow-lg p-5">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">inventory_2</span>
                Items to Pick
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {pickingItems.map(item => (
                  <div key={item.id} className="border border-slate-600 rounded-lg p-3 hover:border-primary/50 transition-colors bg-slate-700/40">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-xs text-slate-400 uppercase">{item.sku}</p>
                        <p className="font-bold text-white">{item.name}</p>
                      </div>
                      <span className="text-2xl font-bold text-primary">&times;{item.qty}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 border-t border-slate-600 pt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {item.location}
                    </p>
                  </div>
                ))}
              </div>
              {routeMode === 'multi' && (
                <button
                  onClick={() => handleMultiStopOptimize(
                    pickingItems.map(i => ({ node_id: i.location, label: i.name, sku: i.sku, quantity: i.qty })),
                    { worker_type: 'picker' }
                  )}
                  disabled={isLoading}
                  className="mt-4 px-5 py-2 bg-primary hover:bg-primary/80 disabled:bg-slate-600 text-white rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">{isLoading ? 'hourglass_empty' : 'alt_route'}</span>
                  {isLoading ? 'Optimizing Route...' : 'Auto-Optimize Picking Route'}
                </button>
              )}
            </div>
          )}

          {/* ── Success banner ── */}
          {isOrderConfirmed && (
            <div className="max-w-7xl mx-auto mb-6 rounded-xl p-5 flex items-center gap-4 border" style={{ background: '#F0FFF4', borderColor: '#39BE7D' }}>
              <CheckCircleIcon className="w-8 h-8" style={{ color: '#39BE7D' }} />
              <div>
                <h3 className="font-bold" style={{ color: '#14532D' }}>Route Confirmed!</h3>
                <p className="text-sm" style={{ color: '#166534' }}>Redirecting to picking interface...</p>
              </div>
            </div>
          )}

          {/* ── Main Grid ── */}
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Control Panel */}
            <div className="lg:col-span-3">
              <ControlPanel
                nodes={nodes}
                onOptimize={handleOptimize}
                isLoading={isLoading}
                pathLength={path.length}
                totalCost={totalCost}
                executionTime={
                  routeMode === 'multi'
                    ? (multiResult?.execution_time_ms ?? undefined)
                    : (singleResult?.execution_time_ms ?? undefined)
                }
              />
            </div>

            {/* Warehouse Visualization */}
            <div className="lg:col-span-5">
              <WarehouseVisualization
                nodes={nodes}
                edges={edges}
                path={path}
                start={path?.[0]?.node_id}
                end={path?.[path.length - 1]?.node_id}
                blocked={[]}
              />
            </div>

            {/* Turn-by-Turn Nav */}
            <div className="lg:col-span-4">
              <TurnByTurnNav
                steps={turnByTurnSteps}
                segments={multiSegments}
                totalCost={totalCost}
                estimatedSeconds={estSeconds}
                mode={routeMode}
              />
            </div>
          </div>

          {/* ── Path step details ── */}
          <div className="max-w-7xl mx-auto mt-5">
            <PathVisualizer
              path={path}
              totalCost={totalCost}
              executionTime={
                routeMode === 'multi'
                  ? (multiResult?.execution_time_ms ?? 0)
                  : (singleResult?.execution_time_ms ?? 0)
              }
              message={
                routeMode === 'multi'
                  ? (multiResult?.message ?? 'Configure multi-stop route above')
                  : (singleResult?.message ?? 'Select start and end locations to optimize')
              }
              pathFound={routeMode === 'multi' ? (multiResult?.route_found ?? false) : (singleResult?.path_found ?? false)}
            />
          </div>

          {/* ── Info cards ── */}
          <div className="max-w-7xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: 'bolt', title: 'Real-Time A* Optimization', desc: 'Get optimal routes in milliseconds using the A* algorithm with Euclidean heuristic' },
              { icon: 'alt_route', title: 'Multi-Stop TSP Solver', desc: 'Nearest-neighbour heuristic optimises pick order to minimize total travel distance' },
              { icon: 'near_me', title: 'Turn-by-Turn Navigation', desc: 'Compass-direction instructions (N/S/E/W) with estimated travel time for each segment' },
            ].map(c => (
              <div key={c.title} className="rounded-xl p-5 border hover:shadow-md transition-all" style={{ background: '#FFFFFF', borderColor: '#EFEFEF' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: '#FFF0F4' }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: '#CF0F47' }}>{c.icon}</span>
                </div>
                <h3 className="font-semibold mb-1" style={{ color: '#111827' }}>{c.title}</h3>
                <p className="text-sm" style={{ color: '#6B7280' }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* ── Action buttons ── */}
          {orderId && (
            <div className="max-w-7xl mx-auto mt-8 mb-8 flex gap-4 justify-center">
              <button
                onClick={handleConfirmRoute}
                disabled={
                  (routeMode === 'single' ? !singleResult?.path_found : !multiResult?.route_found)
                  || isOrderConfirmed
                }
                className="px-8 py-3 rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center gap-2 text-white shadow-lg"
                style={{ background: '#CF0F47', opacity: ((routeMode === 'single' ? !singleResult?.path_found : !multiResult?.route_found) || isOrderConfirmed) ? 0.5 : 1 }}
              >
                <CheckCircleIcon className="w-5 h-5" />
                Confirm Route &amp; Start Picking
              </button>
              <button
                onClick={() => router.push('/admin/warehouses')}
                className="px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 border"
                style={{ background: '#FFFFFF', color: '#374151', borderColor: '#EFEFEF' }}
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
