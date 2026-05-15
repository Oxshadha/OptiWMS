'use client';

import React, { useState } from 'react';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/20/solid';

interface ControlPanelProps {
  nodes: Array<{ id: string; type: string }>;
  onOptimize: (start: string, end: string, constraints: any) => void;
  isLoading: boolean;
  pathLength?: number;
  totalCost?: number;
  executionTime?: number;
}

export default function ControlPanel({
  nodes = [],
  onOptimize,
  isLoading = false,
  pathLength,
  totalCost,
  executionTime
}: ControlPanelProps) {
  const [startNode, setStartNode] = useState<string>('');
  const [endNode, setEndNode] = useState<string>('');
  const [workerType, setWorkerType] = useState<'picker' | 'forklift'>('picker');
  const [avoidCongestion, setAvoidCongestion] = useState(false);
  const [avoidNarrowAisles, setAvoidNarrowAisles] = useState(false);

  // Filter nodes by type for dropdowns
  const rackNodes = nodes.filter(n => n.type === 'rack' || n.type === 'bin');
  const allNodes = nodes;

  const handleOptimize = () => {
    if (!startNode || !endNode) {
      alert('Please select both start and end locations');
      return;
    }

    if (startNode === endNode) {
      alert('Start and end locations must be different');
      return;
    }

    onOptimize(startNode, endNode, {
      worker_type: workerType,
      avoid_congestion: avoidCongestion,
      avoid_narrow_aisles: avoidNarrowAisles
    });
  };

  return (
    <div className="flex flex-col h-full rounded-2xl shadow-sm overflow-hidden border" style={{ background: '#FFFFFF', borderColor: '#EFEFEF' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ background: '#111827' }}>
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-xl" style={{ color: '#CF0F47' }}>route</span>
          Path Optimizer
        </h2>
        <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>Configure your picking route</p>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Start Location */}
        <div>
          <label className="block text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#374151' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#CF0F47' }}>location_on</span>
            Start Location
          </label>
          <select
            value={startNode}
            onChange={(e) => setStartNode(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg transition-all outline-none"
            style={{ borderColor: '#D1D5DB', color: '#111827' }}
            onFocus={e => (e.target.style.borderColor = '#CF0F47')}
            onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
          >
            <option value="">Select start location...</option>
            {allNodes.map(node => (
              <option key={node.id} value={node.id}>
                {node.id} ({node.type})
              </option>
            ))}
          </select>
        </div>

        {/* End Location */}
        <div>
          <label className="block text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#374151' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#CF0F47' }}>flag</span>
            End Location
          </label>
          <select
            value={endNode}
            onChange={(e) => setEndNode(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg transition-all outline-none"
            style={{ borderColor: '#D1D5DB', color: '#111827' }}
            onFocus={e => (e.target.style.borderColor = '#CF0F47')}
            onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
          >
            <option value="">Select destination...</option>
            {rackNodes.map(node => (
              <option key={node.id} value={node.id}>
                {node.id} ({node.type})
              </option>
            ))}
          </select>
        </div>

        {/* Worker Type */}
        <div>
          <label className="block text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#374151' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#CF0F47' }}>person</span>
            Worker Type
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio" name="workerType" value="picker"
                checked={workerType === 'picker'}
                onChange={(e) => setWorkerType(e.target.value as 'picker')}
                className="w-4 h-4" style={{ accentColor: '#CF0F47' }}
              />
              <span className="text-sm" style={{ color: '#374151' }}>Picker (foot)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio" name="workerType" value="forklift"
                checked={workerType === 'forklift'}
                onChange={(e) => setWorkerType(e.target.value as 'forklift')}
                className="w-4 h-4" style={{ accentColor: '#CF0F47' }}
              />
              <span className="text-sm" style={{ color: '#374151' }}>Forklift</span>
            </label>
          </div>
        </div>

        {/* Constraints */}
        <div className="p-4 rounded-lg space-y-3" style={{ background: '#F7F7F7', border: '1px solid #EFEFEF' }}>
          <label className="block text-sm font-semibold flex items-center gap-1.5" style={{ color: '#374151' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#CF0F47' }}>tune</span>
            Constraints
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox" checked={avoidCongestion}
              onChange={(e) => setAvoidCongestion(e.target.checked)}
              className="w-4 h-4 rounded" style={{ accentColor: '#CF0F47' }}
            />
            <span className="text-sm" style={{ color: '#374151' }}>Avoid congestion</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox" checked={avoidNarrowAisles}
              onChange={(e) => setAvoidNarrowAisles(e.target.checked)}
              className="w-4 h-4 rounded" style={{ accentColor: '#CF0F47' }}
            />
            <span className="text-sm" style={{ color: '#374151' }}>Avoid narrow aisles</span>
          </label>
        </div>
      </div>

      {/* Results */}
      {(pathLength !== undefined || totalCost !== undefined) && (
        <div className="border-t px-6 py-4" style={{ borderColor: '#EFEFEF', background: '#FFF0F4' }}>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>Path Length</p>
              <p className="text-lg font-bold" style={{ color: '#CF0F47' }}>{pathLength}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>Total Cost</p>
              <p className="text-lg font-bold" style={{ color: '#CF0F47' }}>{totalCost?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>Time (ms)</p>
              <p className="text-lg font-bold" style={{ color: '#CF0F47' }}>{executionTime?.toFixed(0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="border-t p-6" style={{ borderColor: '#EFEFEF', background: '#FFFFFF' }}>
        <button
          onClick={handleOptimize}
          disabled={isLoading || !startNode || !endNode}
          className="w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-white"
          style={{
            background: isLoading || !startNode || !endNode ? '#D1D5DB' : '#CF0F47',
            color: isLoading || !startNode || !endNode ? '#9CA3AF' : '#FFFFFF',
            cursor: isLoading || !startNode || !endNode ? 'not-allowed' : 'pointer',
            boxShadow: (!isLoading && startNode && endNode) ? '0 2px 8px rgba(207,15,71,0.3)' : 'none',
          }}
        >
          {isLoading && <ArrowPathIcon className="w-5 h-5 animate-spin" />}
          <span className="material-symbols-outlined text-xl">{isLoading ? 'hourglass_empty' : 'alt_route'}</span>
          {isLoading ? 'Optimizing...' : 'Optimize Route'}
        </button>
      </div>
    </div>
  );
}
