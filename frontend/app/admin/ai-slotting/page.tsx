"use client";

import React, { useState } from 'react';
import { AISlottingService, SlottingOptimizationRequest, SlottingOptimizationResponse } from '@/lib/services/aiSlottingService';
import { warehousesApi, type Warehouse } from '@/lib/api/warehouses';
import { useEffect } from 'react';

export default function AISlottingOptimizationPage() {
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [populationSize, setPopulationSize] = useState<number>(20);
  const [generations, setGenerations] = useState<number>(50);
  const [mutationRate, setMutationRate] = useState<number>(0.05);
  const [availableWarehouses, setAvailableWarehouses] = useState<Warehouse[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SlottingOptimizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWarehouses() {
      try {
        const warehouses = await warehousesApi.getAll();
        if (cancelled) return;
        setAvailableWarehouses(warehouses);
        if (!warehouseId && warehouses.length > 0) {
          setWarehouseId(warehouses[0].id);
        }
      } catch {
        if (!cancelled) {
          setAvailableWarehouses([]);
        }
      }
    }

    void loadWarehouses();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const request: SlottingOptimizationRequest = {
        warehouse_id: warehouseId,
        population_size: populationSize,
        generations: generations,
        mutation_rate: mutationRate
      };

      const response = await AISlottingService.optimizeSlotting(request);
      setResult(response);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during optimization.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-base-100 min-h-screen text-base-content">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-primary">Advanced Solver Lab</h1>
        <p className="text-lg opacity-80 mt-2">
          Admin-only GA experimentation for large re-slotting scenarios. Daily manager decisions should use Action Center and Slotting Planner.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Panel */}
        <div className="card bg-base-200 shadow-xl lg:col-span-1">
          <div className="card-body">
            <h2 className="card-title text-accent border-b border-base-300 pb-2">GA Engine Settings</h2>
            
            <div className="form-control w-full mt-4">
              <label className="label">
                <span className="label-text font-semibold">Select Warehouse</span>
              </label>
              <select 
                className="select select-bordered w-full focus:outline-primary"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {availableWarehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>

            <div className="form-control w-full mt-4">
              <label className="label">
                <span className="label-text font-semibold">Population Size: {populationSize}</span>
              </label>
              <input 
                type="range" min="10" max="100" step="10" 
                value={populationSize} 
                onChange={(e) => setPopulationSize(parseInt(e.target.value))}
                className="range range-primary range-sm" 
              />
            </div>

            <div className="form-control w-full mt-4">
              <label className="label">
                <span className="label-text font-semibold">Generations: {generations}</span>
              </label>
              <input 
                type="range" min="10" max="200" step="10" 
                value={generations} 
                onChange={(e) => setGenerations(parseInt(e.target.value))}
                className="range range-accent range-sm" 
              />
            </div>

            <div className="form-control w-full mt-4">
              <label className="label">
                <span className="label-text font-semibold">Mutation Rate: {(mutationRate * 100).toFixed(0)}%</span>
              </label>
              <input 
                type="range" min="0.01" max="0.2" step="0.01" 
                value={mutationRate} 
                onChange={(e) => setMutationRate(parseFloat(e.target.value))}
                className="range range-secondary range-sm" 
              />
            </div>

            <div className="card-actions justify-end mt-8">
              <button 
                className={`btn btn-primary w-full shadow-lg ${isLoading ? 'btn-disabled' : ''}`}
                onClick={handleOptimize}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Running GA Engine...
                  </>
                ) : (
                  'Run GA Solver'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {error && (
            <div className="alert alert-error shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}

          {!result && !error && !isLoading && (
            <div className="card bg-base-200 h-full flex items-center justify-center opacity-60 p-10 text-center border-dashed border-2 border-base-300">
              <p>Configure the GA solver to test alternative assignments. Approved WMS location plans are created in Slotting Planner.</p>
            </div>
          )}

          {result && (
            <>
              {/* Stats Card */}
              <div className="stats shadow bg-primary text-primary-content w-full">
                <div className="stat place-items-center">
                  <div className="stat-title text-primary-content opacity-80">Final Best Fitness Score</div>
                  <div className="stat-value text-4xl">{result.best_fitness.toLocaleString()}</div>
                  <div className="stat-desc text-primary-content opacity-80">Maximized by evaluating {generations} generations</div>
                </div>
              </div>

              {/* Data Table */}
              <div className="card bg-base-200 shadow-xl overflow-hidden">
                <div className="card-body p-0">
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                      <thead className="bg-neutral text-neutral-content">
                        <tr>
                          <th>Material Code</th>
                          <th>Recommended Location Code</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.assignments.map((assignment, index) => (
                          <tr key={index} className="hover">
                            <td className="font-semibold text-primary">{assignment.material_code}</td>
                            <td>{assignment.location_code}</td>
                            <td><div className="badge badge-success gap-2">Ready to Apply</div></td>
                          </tr>
                        ))}
                        {result.assignments.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center py-6 opacity-60">No assignments were generated.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
