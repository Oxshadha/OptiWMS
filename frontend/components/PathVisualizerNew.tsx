'use client';

import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, CheckCircleIcon } from '@heroicons/react/20/solid';

interface PathStep {
  node_id: string;
  row: number;
  col: number;
  cost: number;
}

interface PathVisualizerProps {
  path: PathStep[];
  totalCost: number;
  executionTime: number;
  message: string;
  pathFound: boolean;
}

export default function PathVisualizer({
  path = [],
  totalCost = 0,
  executionTime = 0,
  message = '',
  pathFound = false
}: PathVisualizerProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4">
        <h2 className="text-white text-lg font-bold">
          {pathFound ? '✅ Optimal Route Found' : '❌ Route Not Found'}
        </h2>
        <p className="text-blue-100 text-sm">{message}</p>
      </div>

      {/* Stats Cards */}
      {pathFound && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b border-blue-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-600 uppercase">Steps</p>
              <p className="text-2xl font-bold text-blue-600">{path.length}</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-600 uppercase">Total Cost</p>
              <p className="text-2xl font-bold text-cyan-600">{totalCost.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-600 uppercase">Time</p>
              <p className="text-2xl font-bold text-indigo-600">{executionTime.toFixed(1)}ms</p>
            </div>
          </div>
        </div>
      )}

      {/* Path Steps */}
      <div className="flex-1 overflow-y-auto">
        {pathFound && path.length > 0 ? (
          <div className="p-4 space-y-2">
            {path.map((step, index) => (
              <div key={index}>
                {/* Step Header */}
                <button
                  onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                  className="w-full bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-50 hover:to-cyan-50 p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{step.node_id}</p>
                        <p className="text-xs text-gray-600">
                          Position: ({step.row}, {step.col})
                        </p>
                      </div>
                    </div>
                    <div className="text-right mr-2">
                      <p className="text-sm font-semibold text-gray-900">
                        Cost: {step.cost.toFixed(2)}
                      </p>
                      {index === path.length - 1 && (
                        <p className="text-xs text-green-600 font-semibold">✓ Destination</p>
                      )}
                    </div>
                    <ChevronDownIcon
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedStep === index ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedStep === index && (
                  <div className="bg-gray-50 border border-gray-200 border-t-0 rounded-b-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 font-semibold">Node ID</p>
                        <p className="text-gray-900">{step.node_id}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-semibold">Row / Col</p>
                        <p className="text-gray-900">{step.row} / {step.col}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-semibold">G Cost (actual)</p>
                        <p className="text-gray-900">{step.cost.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-semibold">Step Distance</p>
                        <p className="text-gray-900">
                          {index > 0
                            ? (step.cost - path[index - 1].cost).toFixed(2)
                            : '0.00'}
                        </p>
                      </div>
                    </div>

                    {/* Connection to next */}
                    {index < path.length - 1 && (
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <p className="text-xs text-gray-600 font-semibold">

NEXT STEP</p>
                        <p className="text-sm text-gray-900 mt-1">
                          → {path[index + 1].node_id}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg font-semibold mb-2">No path available</p>
              <p className="text-sm">Optimize a route to see the path steps</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {pathFound && path.length > 0 && (
        <div className="border-t border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Estimated Time:</span>{' '}
            <span className="text-emerald-700 font-semibold">
              ~{Math.round(totalCost * 1.5)} seconds
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Based on average walking speed of 1.4 m/s
          </p>
        </div>
      )}
    </div>
  );
}
