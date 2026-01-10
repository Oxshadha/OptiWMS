"use client";

import { useState, useEffect } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { materialsApi, Material } from "@/lib/api/materials";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { supplyPlansApi, SupplyPlan } from "@/lib/api/supply-plans";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

export default function SupplyPlansPage() {
  const { admin, role } = useAdmin();
  const [supplyPlans, setSupplyPlans] = useState<SupplyPlan[]>([]);
  const [materials, setMaterials] = useState<Map<string, Material>>(new Map());
  const [warehouses, setWarehouses] = useState<Map<string, Warehouse>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMaterial, selectedWarehouse]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load materials and warehouses
      const [materialsData, warehousesData] = await Promise.all([
        materialsApi.getAll(),
        warehousesApi.getAll(),
      ]);

      const materialsMap = new Map<string, Material>();
      materialsData.forEach((m) => materialsMap.set(m.id, m));
      setMaterials(materialsMap);

      const warehousesMap = new Map<string, Warehouse>();
      warehousesData.forEach((w) => warehousesMap.set(w.id, w));
      setWarehouses(warehousesMap);

      // Load supply plans from API
      const filters: any = { planYear: selectedYear };
      if (selectedMaterial !== "all") filters.materialId = selectedMaterial;
      if (selectedWarehouse !== "all") filters.warehouseId = selectedWarehouse;
      
      const plansData = await supplyPlansApi.getAll(filters);
      setSupplyPlans(plansData);
      
    } catch (error: any) {
      logger.error("[SupplyPlans] Failed to load data:", error);
      showToast.error("Failed to load supply plans");
    } finally {
      setIsLoading(false);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const filteredPlans = supplyPlans.filter((plan) => {
    if (plan.planYear !== selectedYear) return false;
    if (selectedMaterial !== "all" && plan.materialId !== selectedMaterial) return false;
    if (selectedWarehouse !== "all" && plan.warehouseId !== selectedWarehouse) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Supply Plans</h1>
          <p className="text-base-content/60 mt-1">
            Monthly supply forecasts and planning
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
        <div className="flex flex-wrap gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Year</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Material</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
            >
              <option value="all">All Materials</option>
              {Array.from(materials.values()).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.materialCode} - {m.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              <option value="all">All Warehouses</option>
              {Array.from(warehouses.values()).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Supply Plans Table */}
      {isLoading ? (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-8 text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/60">Loading supply plans...</p>
        </div>
      ) : supplyPlans.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-6xl text-base-content/20 mb-4">
            calendar_month
          </span>
          <h3 className="text-xl font-semibold text-base-content mb-2">
            No Supply Plans Found
          </h3>
          <p className="text-base-content/60 mb-4">
            Supply plans will appear here once the API endpoint is implemented.
          </p>
          <p className="text-sm text-base-content/40">
            Supply plans are imported from CSV and stored in the database.
            <br />
            API endpoint: <code className="bg-base-200 px-2 py-1 rounded">GET /api/planning/supply-plans</code>
          </p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="bg-base-200">
                <tr>
                  <th>Material</th>
                  <th>Warehouse</th>
                  <th>Month</th>
                  <th>Planned Quantity</th>
                  <th>Actual Quantity</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const material = materials.get(plan.materialId);
                  const warehouse = warehouses.get(plan.warehouseId);
                  const plannedQty = parseFloat(plan.plannedQuantity || "0");
                  const actualQty = plan.actualQuantity ? parseFloat(plan.actualQuantity) : null;
                  const variance = plan.variance ? parseFloat(plan.variance) : (actualQty !== null ? actualQty - plannedQty : null);
                  
                  return (
                    <tr key={plan.id} className="hover:bg-base-200/50">
                      <td>
                        <div>
                          <div className="font-semibold">{material?.materialCode || "N/A"}</div>
                          <div className="text-sm text-base-content/60">
                            {material?.description || "Unknown"}
                          </div>
                        </div>
                      </td>
                      <td>{warehouse?.name || "Unknown"}</td>
                      <td>{monthNames[plan.planMonth - 1]} {plan.planYear}</td>
                      <td className="font-mono">{plannedQty.toLocaleString()}</td>
                      <td className="font-mono">
                        {actualQty !== null ? actualQty.toLocaleString() : "—"}
                      </td>
                      <td>
                        {variance !== null ? (
                          <span className={`font-mono ${variance >= 0 ? "text-success" : "text-error"}`}>
                            {variance >= 0 ? "+" : ""}{variance.toLocaleString()}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
