'use client';

import React, { useState } from 'react';
import { TurnByTurnStep, StopSegment } from '@/lib/pathfinding-client';

interface TurnByTurnNavProps {
  steps?: TurnByTurnStep[];
  segments?: StopSegment[];
  totalCost: number;
  estimatedSeconds: number;
  mode: 'single' | 'multi';
}

const DIRECTION_ICONS: Record<string, string> = {
  North: 'arrow_upward',
  South: 'arrow_downward',
  East: 'arrow_forward',
  West: 'arrow_back',
  'North-East': 'north_east',
  'North-West': 'north_west',
  'South-East': 'south_east',
  'South-West': 'south_west',
  Start: 'play_arrow',
  Arrive: 'flag',
  Straight: 'arrow_upward',
};

// All steps use brand tint colors
const STEP_BG = '#FFF0F4';
const STEP_TEXT = '#CF0F47';

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function StepRow({ step, isLast }: { step: TurnByTurnStep; isLast: boolean }) {
  const icon = DIRECTION_ICONS[step.direction] || 'arrow_upward';
  return (
    <div className="flex items-start gap-3 group">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: STEP_BG, color: STEP_TEXT }}
        >
          {step.step_number}
        </div>
        {!isLast && <div className="w-0.5 h-6 my-0.5" style={{ background: '#EFEFEF' }} />}
      </div>
      {/* Content */}
      <div className="flex-1 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ color: '#CF0F47' }}>{icon}</span>
          <p className="text-sm font-medium" style={{ color: '#111827' }}>{step.instruction}</p>
        </div>
        <div className="flex gap-3 mt-1">
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {step.from_node} &rarr; {step.to_node}
          </span>
          {step.distance > 0 && (
            <span className="text-xs" style={{ color: '#9CA3AF' }}>{step.distance.toFixed(1)} units</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TurnByTurnNav({
  steps = [],
  segments = [],
  totalCost,
  estimatedSeconds,
  mode,
}: TurnByTurnNavProps) {
  const [activeSegment, setActiveSegment] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const displaySteps = mode === 'multi' && segments.length > 0
    ? segments[activeSegment]?.turn_by_turn ?? []
    : steps;

  const totalSegmentStops = segments.length;

  return (
    <div className="flex flex-col rounded-2xl shadow-sm overflow-hidden h-full border" style={{ background: '#FFFFFF', borderColor: '#EFEFEF' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ background: '#111827' }}>
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-xl" style={{ color: '#CF0F47' }}>near_me</span>
          Turn-by-Turn Navigation
        </h2>
        <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
          {mode === 'multi'
            ? `Multi-stop route · ${totalSegmentStops} segment${totalSegmentStops !== 1 ? 's' : ''}`
            : 'Single-path route'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-0 border-b" style={{ borderColor: '#EFEFEF' }}>
        <div className="px-4 py-3 text-center border-r" style={{ borderColor: '#EFEFEF' }}>
          <p className="text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>Steps</p>
          <p className="text-xl font-bold" style={{ color: '#CF0F47' }}>
            {mode === 'multi'
              ? segments.reduce((a, s) => a + s.turn_by_turn.length, 0)
              : steps.length}
          </p>
        </div>
        <div className="px-4 py-3 text-center border-r" style={{ borderColor: '#EFEFEF' }}>
          <p className="text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>Travel Cost</p>
          <p className="text-xl font-bold" style={{ color: '#CF0F47' }}>{totalCost.toFixed(1)}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>Est. Time</p>
          <p className="text-xl font-bold" style={{ color: '#39BE7D' }}>{formatTime(estimatedSeconds)}</p>
        </div>
      </div>

      {/* Segment tabs (multi-stop only) */}
      {mode === 'multi' && segments.length > 0 && (
        <div className="flex overflow-x-auto border-b" style={{ borderColor: '#EFEFEF', background: '#F7F7F7' }}>
          {segments.map((seg, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSegment(idx)}
              className="flex-shrink-0 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2"
              style={{
                borderBottomColor: activeSegment === idx ? '#CF0F47' : 'transparent',
                color: activeSegment === idx ? '#CF0F47' : '#6B7280',
                background: activeSegment === idx ? '#FFFFFF' : 'transparent',
              }}
            >
              {idx + 1}. {seg.from_stop} &rarr; {seg.to_stop}
            </button>
          ))}
        </div>
      )}

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {displaySteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: '#9CA3AF' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#FFF0F4' }}>
              <span className="material-symbols-outlined text-3xl" style={{ color: '#CF0F47' }}>map</span>
            </div>
            <p className="font-semibold" style={{ color: '#374151' }}>No navigation steps yet</p>
            <p className="text-sm mt-1">Run the optimizer to generate turn-by-turn directions</p>
          </div>
        ) : (
          <div>
            {displaySteps.map((step, idx) => (
              <StepRow
                key={step.step_number}
                step={step}
                isLast={idx === displaySteps.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Progress footer (multi-stop) */}
      {mode === 'multi' && segments.length > 0 && (
        <div className="border-t px-5 py-3" style={{ borderColor: '#EFEFEF', background: '#F7F7F7' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#374151' }}>
              Segment {activeSegment + 1} of {segments.length}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#CF0F47' }}>
              {segments[activeSegment]?.segment_cost.toFixed(1)} cost
            </span>
          </div>
          <div className="flex gap-1.5">
            {segments.map((_, i) => (
              <div
                key={i}
                onClick={() => setActiveSegment(i)}
                className="h-1.5 flex-1 rounded-full cursor-pointer transition-colors"
                style={{ background: i <= activeSegment ? '#CF0F47' : '#EFEFEF' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
