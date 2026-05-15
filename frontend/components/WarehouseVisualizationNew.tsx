'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WNode { id: string; row: number; col: number; type: string; walkable: boolean; }
interface WEdge { from: string; to: string; cost: number; }
interface PStep { node_id: string; row: number; col: number; cost: number; }
interface Props {
  nodes: WNode[]; edges: WEdge[]; path: PStep[];
  start?: string; end?: string; blocked?: string[];
}

const CW = 80, CH = 48, AH = 38, PAD = 72;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

interface Bay { id: string; area: string; rowK: string; bay: string; }

function buildLayout(nodes: WNode[]) {
  const racks = nodes.filter(n => n.type === 'rack');
  const entry = nodes.find(n => n.type === 'entry' || n.id === 'ENTRY');
  const exit  = nodes.find(n => n.type === 'exit'  || n.id === 'EXIT');
  const bays: Bay[] = racks.map(n => {
    const p = n.id.split('-');
    // Handle both "A-01-07" (backend) and "A1","B2" (sample) formats
    let area: string, rowK: string, bay: string;
    if (p.length >= 3 && p[1] && p[2] && !isNaN(Number(p[1])) && !isNaN(Number(p[2]))) {
      // Format: A-01-07
      area = p[0]; rowK = `${p[0]}-${p[1]}`; bay = p[2];
    } else if (p.length === 2 && p[1] && !isNaN(Number(p[1]))) {
      // Format: A-1 or B-2
      area = p[0]; rowK = `${p[0]}-01`; bay = p[1].padStart(2, '0');
    } else {
      // Format: A1, B2 (no separator) or unknown
      const match = n.id.match(/^([A-Za-z]+)(\d+)$/);
      area = match ? match[1] : n.id; rowK = `${area}-01`; bay = match ? match[2].padStart(2, '0') : '01';
    }
    return { id: n.id, area, rowK, bay };
  }).sort((a, b) => a.rowK !== b.rowK ? a.rowK.localeCompare(b.rowK) : a.bay.localeCompare(b.bay));

  const rows = new Map<string, Bay[]>();
  for (const b of bays) {
    if (!rows.has(b.rowK)) rows.set(b.rowK, []);
    rows.get(b.rowK)!.push(b);
  }
  const rowKeys = Array.from(rows.keys());
  const maxBays = Math.max(...Array.from(rows.values()).map(v => v.length), 1);
  return { rows, rowKeys, maxBays, entry, exit };
}

function nodePos(id: string, rowKeys: string[], rows: Map<string, Bay[]>, maxBays: number) {
  if (id === 'ENTRY') return { x: PAD + CW / 2, y: PAD - 36 };
  if (id === 'EXIT')  return { x: PAD + (maxBays - 1) * CW + CW / 2, y: PAD + rowKeys.length * (CH + AH) + 20 };
  for (let ri = 0; ri < rowKeys.length; ri++) {
    const bays = rows.get(rowKeys[ri])!;
    const bi = bays.findIndex(b => b.id === id);
    if (bi >= 0) return { x: PAD + bi * CW + CW / 2, y: PAD + ri * (CH + AH) + CH / 2 };
  }
  return null;
}

export default function WarehouseVisualization({ nodes = [], edges = [], path = [], start, end, blocked = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [zoom, setZoom]   = useState(0.9);
  const [pan, setPan]     = useState({ x: 20, y: 20 });
  const [drag, setDrag]   = useState(false);
  const [ds, setDs]       = useState({ x: 0, y: 0 });
  const [hov, setHov]     = useState<string | null>(null);
  const pset = new Set(path.map(p => p.node_id));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const { rows, rowKeys, maxBays } = buildLayout(nodes);

    // ── Background ──
    ctx.fillStyle = '#F7F7F7';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // ── Floor ──
    const fw = PAD + maxBays * CW + 20;
    const fh = PAD + rowKeys.length * (CH + AH) + 60;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(PAD - 16, PAD - 50, fw - PAD + 16, fh - PAD + 50);
    // Floor border
    ctx.strokeStyle = '#EFEFEF';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD - 16, PAD - 50, fw - PAD + 16, fh - PAD + 50);

    // ── Column numbers (bay headers) ──
    const firstRow = rows.get(rowKeys[0]);
    if (firstRow) {
      firstRow.forEach((_, bi) => {
        ctx.fillStyle = '#475569'; ctx.font = '9px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${String(bi + 1).padStart(2, '0')}`, PAD + bi * CW + CW / 2, PAD - 56);
      });
    }

    // ── Aisle corridors ──
    for (let ri = 0; ri < rowKeys.length; ri++) {
      const ay = PAD + ri * (CH + AH) + CH;
      ctx.fillStyle = '#F7F7F7';
      ctx.fillRect(PAD - 16, ay, maxBays * CW + 16, AH);
      // Safety stripes (brand crimson, subtle)
      ctx.fillStyle = '#CF0F47';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(PAD - 16, ay, maxBays * CW + 16, AH);
      ctx.globalAlpha = 1;
      // Top stripe
      ctx.fillStyle = '#CF0F47';
      ctx.fillRect(PAD - 16, ay, maxBays * CW + 16, 2);
      ctx.fillRect(PAD - 16, ay + AH - 2, maxBays * CW + 16, 2);
      // Label
      ctx.fillStyle = '#9CA3AF'; ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`AISLE ${ri + 1}`, PAD - 12, ay + AH / 2);
    }

    // ── Path line ──
    if (path.length > 1) {
      ctx.strokeStyle = '#CF0F47'; ctx.lineWidth = 3;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([10, 5]); ctx.globalAlpha = 0.8;
      ctx.beginPath();
      let started = false;
      for (const s of path) {
        const p = nodePos(s.node_id, rowKeys, rows, maxBays);
        if (!p) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // ── Rack rows ──
    for (let ri = 0; ri < rowKeys.length; ri++) {
      const rk = rowKeys[ri];
      const bays = rows.get(rk)!;
      const ry = PAD + ri * (CH + AH);

      // Row label
      ctx.fillStyle = '#6B7280'; ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(rk, PAD - 20, ry + CH / 2);

      // Row back-plate (light card)
      ctx.fillStyle = '#EFEFEF';
      ctx.fillRect(PAD - 3, ry - 3, bays.length * CW + 6, CH + 6);

      bays.forEach((bay, bi) => {
        const bx = PAD + bi * CW, by = ry;
        const onPath = pset.has(bay.id);
        const isStart = bay.id === start, isEnd = bay.id === end;
        const isBlock = blocked.includes(bay.id), isHov = hov === bay.id;

        // Bay fill — brand palette
        ctx.fillStyle = isStart ? '#CF0F47'
          : isEnd   ? '#7C0026'
          : isBlock ? '#6D28D9'
          : onPath  ? '#FFDEDE'   // secondary (light pink)
          : isHov   ? '#FFF0F4'   // hover tint
          : '#FFFFFF';            // base-100 white
        rr(ctx, bx + 3, by + 3, CW - 6, CH - 6, 5); ctx.fill();

        // Border
        ctx.strokeStyle = isStart || isEnd ? '#CF0F47'
          : onPath ? '#CF0F47'
          : isHov  ? '#CF0F47'
          : '#D1D5DB';   // base-300
        ctx.lineWidth = (isStart || isEnd || onPath || isHov) ? 2 : 1;
        ctx.stroke();

        // Shelf lines
        ctx.strokeStyle = '#EFEFEF'; ctx.lineWidth = 1;
        for (let s = 1; s <= 2; s++) {
          const sy = by + 3 + s * ((CH - 6) / 3);
          ctx.beginPath(); ctx.moveTo(bx + 8, sy); ctx.lineTo(bx + CW - 8, sy); ctx.stroke();
        }

        // Label — dark text on light bays, white on crimson bays
        const lbl = bay.id;
        ctx.fillStyle = (isStart || isEnd) ? '#FFFFFF' : '#1F2937';
        ctx.font = `bold ${lbl.length > 8 ? 7.5 : 9}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lbl, bx + CW / 2, by + CH / 2);
      });
    }

    // ── Path waypoint numbers ──
    if (path.length > 1) {
      path.forEach((s, i) => {
        const p = nodePos(s.node_id, rowKeys, rows, maxBays);
        if (!p) return;
        ctx.fillStyle = '#CF0F47';
        ctx.beginPath(); ctx.arc(p.x + 26, p.y - 17, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, p.x + 26, p.y - 17);
      });
    }

    // ── ENTRY badge ──
    ctx.fillStyle = pset.has('ENTRY') ? '#CF0F47' : '#111827';
    rr(ctx, PAD - 3, PAD - 44, 88, 26, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ENTRY', PAD + 41, PAD - 31);

    // ── EXIT badge ──
    const exX = PAD + (maxBays - 2) * CW;
    const exY = PAD + rowKeys.length * (CH + AH) + 14;
    ctx.fillStyle = pset.has('EXIT') ? '#CF0F47' : '#7C0026';
    rr(ctx, exX, exY, 88, 26, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', exX + 44, exY + 13);

    ctx.restore();

    // ── Fixed legend (light bg) ──
    const leg = [
      { c: '#FFFFFF', b: '#D1D5DB', l: 'Rack Bay' },
      { c: '#CF0F47', b: '#CF0F47', l: 'Path'     },
      { c: '#CF0F47', b: '#CF0F47', l: 'Start'    },
      { c: '#7C0026', b: '#7C0026', l: 'End'       },
      { c: '#111827', b: '#111827', l: 'Entry'     },
      { c: '#7C0026', b: '#7C0026', l: 'Exit'      },
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fillRect(0, 0, leg.length * 76 + 10, 28);
    ctx.strokeStyle = '#EFEFEF'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, leg.length * 76 + 10, 28);
    leg.forEach((item, i) => {
      ctx.fillStyle = item.c;
      ctx.fillRect(8 + i * 76, 7, 13, 13);
      ctx.strokeStyle = item.b; ctx.lineWidth = 1;
      ctx.strokeRect(8 + i * 76, 7, 13, 13);
      ctx.fillStyle = '#374151'; ctx.font = '11px system-ui';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(item.l, 25 + i * 76, 8);
    });
  }, [nodes, path, start, end, blocked, hov, zoom, pan, pset]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const w = wrapRef.current; if (!w) return;
    const ro = new ResizeObserver(() => draw()); ro.observe(w);
    return () => ro.disconnect();
  }, [draw]);

  function hitTest(cx: number, cy: number) {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (cx - rect.left - pan.x) / zoom;
    const my = (cy - rect.top  - pan.y) / zoom;
    const { rows, rowKeys } = buildLayout(nodes);
    let found: string | null = null;
    for (let ri = 0; ri < rowKeys.length; ri++) {
      const bays = rows.get(rowKeys[ri])!;
      const ry = PAD + ri * (CH + AH);
      bays.forEach((bay, bi) => {
        if (mx >= PAD + bi * CW && mx <= PAD + (bi + 1) * CW && my >= ry && my <= ry + CH) found = bay.id;
      });
    }
    setHov(found);
  }

  const zoomTo = (d: 'in' | 'out' | 'reset') => {
    if (d === 'reset') { setZoom(0.9); setPan({ x: 20, y: 20 }); return; }
    setZoom(z => Math.max(0.25, Math.min(4, d === 'in' ? z * 1.2 : z / 1.2)));
  };

  return (
    <div className="flex flex-col h-full rounded-2xl shadow-sm overflow-hidden border" style={{ background: '#FFFFFF', borderColor: '#EFEFEF' }}>
      <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ background: '#111827' }}>
        <div>
          <h2 className="text-white text-base font-bold">Warehouse Floor Plan</h2>
          <p className="text-gray-400 text-xs">Drag to pan &middot; Scroll to zoom &middot; {nodes.filter(n => n.type === 'rack').length} rack bays</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => zoomTo('in')} className="w-7 h-7 rounded text-white font-bold text-lg" style={{ background: '#1F2937' }}>+</button>
          <button onClick={() => zoomTo('reset')} className="text-gray-400 text-xs w-12 text-center">{Math.round(zoom * 100)}%</button>
          <button onClick={() => zoomTo('out')} className="w-7 h-7 rounded text-white font-bold text-lg" style={{ background: '#1F2937' }}>&minus;</button>
        </div>
      </div>

      <div ref={wrapRef} className="flex-1 relative overflow-hidden" style={{ minHeight: 460 }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: drag ? 'grabbing' : 'grab' }}
          onMouseDown={e => { setDrag(true); setDs({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }}
          onMouseMove={e => { if (drag) setPan({ x: e.clientX - ds.x, y: e.clientY - ds.y }); else hitTest(e.clientX, e.clientY); }}
          onMouseUp={() => setDrag(false)}
          onMouseLeave={() => { setDrag(false); setHov(null); }}
          onWheel={e => { e.preventDefault(); zoomTo(e.deltaY < 0 ? 'in' : 'out'); }}
        />
        {hov && (
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(255,255,255,0.97)', border: '1px solid #EFEFEF', borderRadius: 8, padding: '6px 12px', color: '#111827', fontSize: 13, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: '#CF0F47', verticalAlign: 'middle', marginRight: 4 }}>inventory_2</span>
            <strong>{hov}</strong>{pset.has(hov) && <span style={{ color: '#CF0F47', marginLeft: 8, fontWeight: 600 }}>On Path</span>}
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 py-2 flex gap-5 text-xs border-t" style={{ background: '#F7F7F7', borderColor: '#EFEFEF', color: '#6B7280' }}>
        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm" style={{ color: '#CF0F47' }}>shelves</span> {nodes.filter(n => n.type === 'rack').length} Rack Bays</span>
        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm" style={{ color: '#CF0F47' }}>route</span> {path.length} path nodes</span>
        {path.length > 0 && <span style={{ color: '#CF0F47', fontWeight: 600 }}>Route Active</span>}
      </div>
    </div>
  );
}
