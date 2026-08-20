"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { locationsApi, type Location } from "@/lib/api/locations";
import { materialsApi } from "@/lib/api/materials";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import { showToast } from "@/lib/utils/toast";
import {
  deriveRackIdFromLocation,
  locationMatchesRack,
  normalizeArea,
  parseRackId,
} from "@/lib/utils/location-identity";

const CLASS_OPTIONS = ["AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"];

const PLANNER_STALE_TIME_MS = 5 * 60 * 1000;
const PLANNER_GC_TIME_MS = 30 * 60 * 1000;

interface SlottingPlannerModalProps {
  isOpen: boolean;
  warehouseId?: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function SlottingPlannerModal({ isOpen, warehouseId, onClose, onUpdated }: SlottingPlannerModalProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; materialCode: string; description: string }>>([]);
  const queryClient = useQueryClient();
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedLocationCode, setSelectedLocationCode] = useState("");
  const [savingRackId, setSavingRackId] = useState<string | null>(null);
  const [deletingRackId, setDeletingRackId] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkTargetZone, setBulkTargetZone] = useState<"ALL" | "A" | "B" | "C" | "D">("ALL");
  const [bulkCapacity, setBulkCapacity] = useState<number>(100);
  const [bulkMaxWeightKg, setBulkMaxWeightKg] = useState<number>(1000);
  const [bulkMaxVolumeCm3, setBulkMaxVolumeCm3] = useState<number>(1000000);
  const [bulkMaxLpnCount, setBulkMaxLpnCount] = useState<number>(1);
  const [bulkMaxPalletCapacity, setBulkMaxPalletCapacity] = useState<number>(10);
  const [useLevelProfileForBulk, setUseLevelProfileForBulk] = useState<boolean>(false);
  const [expandedRackId, setExpandedRackId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [bulkLevelProfile, setBulkLevelProfile] = useState<
    Array<{ level: number; capacity: number; maxWeightKg: number; maxVolumeCm3: number; maxLpnCount: number }>
  >([
    { level: 1, capacity: 120, maxWeightKg: 1000, maxVolumeCm3: 1200000, maxLpnCount: 2 },
    { level: 2, capacity: 110, maxWeightKg: 900, maxVolumeCm3: 1100000, maxLpnCount: 2 },
    { level: 3, capacity: 100, maxWeightKg: 800, maxVolumeCm3: 1000000, maxLpnCount: 2 },
    { level: 4, capacity: 90, maxWeightKg: 700, maxVolumeCm3: 900000, maxLpnCount: 1 },
    { level: 5, capacity: 80, maxWeightKg: 600, maxVolumeCm3: 800000, maxLpnCount: 1 },
  ]);

  // Cached through React Query so reopening the planner is instant instead of refetching
  // every storage location again. Local edits still live in `locations` state.
  const plannerQuery = useQuery({
    queryKey: ["slotting-planner-locations", warehouseId ?? "none"],
    queryFn: async () => {
      const [locs, mats] = await Promise.all([
        locationsApi.getStorageLocationsByWarehouse(warehouseId!),
        materialsApi.getAll(),
      ]);
      return { locations: locs, materials: mats };
    },
    enabled: Boolean(isOpen && warehouseId),
    staleTime: PLANNER_STALE_TIME_MS,
    gcTime: PLANNER_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!plannerQuery.data) return;
    setLocations(plannerQuery.data.locations);
    setMaterials(
      plannerQuery.data.materials.map((m) => ({
        id: m.id,
        materialCode: m.materialCode,
        description: m.description,
      }))
    );
  }, [plannerQuery.data]);

  useEffect(() => {
    if (plannerQuery.isError) {
      showToast.error("Failed to load slotting data. Close and reopen the planner to retry.");
    }
  }, [plannerQuery.isError]);

  const loading = plannerQuery.isPending && Boolean(isOpen && warehouseId);

  const rackRows = useMemo(() => {
    const map = new Map<string, {
      rackId: string;
      locationIds: string[];
      rackClass: string;
      zone: string;
      capacity?: number;
      maxWeightKg?: number;
      maxVolumeCm3?: number;
      maxLpnCount?: number;
      maxPalletCapacity?: number;
    }>();
    for (const loc of locations) {
      const rackId = deriveRackIdFromLocation(loc);
      const zone = normalizeArea(loc.area);
      if (!map.has(rackId)) {
        map.set(rackId, {
          rackId,
          locationIds: [],
          rackClass: (loc.amalgamatedClass || "CM").toUpperCase(),
          zone,
          capacity: loc.capacity !== undefined ? Number(loc.capacity) : undefined,
          maxWeightKg: loc.maxWeightKg !== undefined ? Number(loc.maxWeightKg) : undefined,
          maxVolumeCm3: loc.maxVolumeCm3 !== undefined ? Number(loc.maxVolumeCm3) : undefined,
          maxLpnCount: loc.maxLpnCount !== undefined ? Number(loc.maxLpnCount) : undefined,
          maxPalletCapacity: loc.maxPalletCapacity !== undefined ? Number(loc.maxPalletCapacity) : undefined,
        });
      }
      map.get(rackId)!.locationIds.push(loc.id);
    }
    return Array.from(map.values()).sort((a, b) => a.rackId.localeCompare(b.rackId));
  }, [locations]);

  const updateRackSettings = async (
    rackId: string,
    locationIds: string[],
    payload: {
      amalgamatedClass: string;
      capacity?: number;
      maxWeightKg?: number;
      maxVolumeCm3?: number;
      maxLpnCount?: number;
      maxPalletCapacity?: number;
    }
  ) => {
    try {
      setSavingRackId(rackId);
      await Promise.all(
        locationIds.map((id) =>
          locationsApi.updateRack(id, {
            amalgamatedClass: payload.amalgamatedClass,
            capacity: payload.capacity,
            maxWeightKg: payload.maxWeightKg,
            maxVolumeCm3: payload.maxVolumeCm3,
            maxLpnCount: payload.maxLpnCount,
            maxPalletCapacity: payload.maxPalletCapacity,
          })
        )
      );
      setLocations((prev) =>
        prev.map((loc) =>
          locationIds.includes(loc.id)
            ? {
                ...loc,
                amalgamatedClass: payload.amalgamatedClass,
                capacity: payload.capacity,
                maxWeightKg: payload.maxWeightKg,
                maxVolumeCm3: payload.maxVolumeCm3,
                maxLpnCount: payload.maxLpnCount,
                maxPalletCapacity: payload.maxPalletCapacity,
              }
            : loc
        )
      );
      showToast.success(`Updated ${rackId}`);
      onUpdated?.();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update rack settings");
    } finally {
      setSavingRackId(null);
    }
  };

  const saveRackByLocation = async (rackId: string, locationIds: string[]) => {
    try {
      setSavingRackId(rackId);
      const targetLocations = locations.filter((loc) => locationIds.includes(loc.id));
      await Promise.all(
        targetLocations.map((loc) =>
          locationsApi.updateRack(loc.id, {
            amalgamatedClass: (loc.amalgamatedClass || "CM").toUpperCase(),
            capacity: Number(loc.capacity ?? 0),
            maxWeightKg: Number(loc.maxWeightKg ?? 0),
            maxVolumeCm3: Number(loc.maxVolumeCm3 ?? 0),
            maxLpnCount: Number(loc.maxLpnCount ?? 0),
            maxPalletCapacity: Number(loc.maxPalletCapacity ?? 0),
          })
        )
      );
      showToast.success(`Updated ${rackId}`);
      onUpdated?.();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to save rack settings");
    } finally {
      setSavingRackId(null);
    }
  };

  const applyBulkCapacity = async () => {
    if (!warehouseId) {
      showToast.error("Select a warehouse first");
      return;
    }
    try {
      setBulkApplying(true);
      const targets = rackRows.filter((rack) => bulkTargetZone === "ALL" || rack.zone === bulkTargetZone);
      if (targets.length === 0) {
        showToast.error("No racks found for selected target");
        return;
      }

      // One transactional request. This used to fire a PUT per bin, which on a
      // warehouse-wide apply meant tens of thousands of parallel requests and left the
      // page unresponsive until they all settled.
      const defaults = {
        capacity: bulkCapacity,
        maxWeightKg: bulkMaxWeightKg,
        maxVolumeCm3: bulkMaxVolumeCm3,
        maxLpnCount: bulkMaxLpnCount,
        maxPalletCapacity: bulkMaxPalletCapacity,
      };

      const result = await locationsApi.applyCapacityProfile({
        warehouseId,
        zone: bulkTargetZone,
        defaults,
        levels: useLevelProfileForBulk
          ? bulkLevelProfile.map((profile) => ({
              level: profile.level,
              attributes: {
                capacity: Number(profile.capacity ?? bulkCapacity),
                maxWeightKg: Number(profile.maxWeightKg ?? bulkMaxWeightKg),
                maxVolumeCm3: Number(profile.maxVolumeCm3 ?? bulkMaxVolumeCm3),
                maxLpnCount: Number(profile.maxLpnCount ?? bulkMaxLpnCount),
                maxPalletCapacity: bulkMaxPalletCapacity,
              },
            }))
          : undefined,
      });

      setLocations((prev) =>
        prev.map((loc) => {
          const zone = (loc.area || "C").toUpperCase();
          if (bulkTargetZone !== "ALL" && zone !== bulkTargetZone) return loc;
          const levelProfile = bulkLevelProfile.find((profile) => profile.level === (loc.levelNumber ?? 0));
          return {
            ...loc,
            capacity: useLevelProfileForBulk
              ? Number(levelProfile?.capacity ?? bulkCapacity)
              : bulkCapacity,
            maxWeightKg: useLevelProfileForBulk
              ? Number(levelProfile?.maxWeightKg ?? bulkMaxWeightKg)
              : bulkMaxWeightKg,
            maxVolumeCm3: useLevelProfileForBulk
              ? Number(levelProfile?.maxVolumeCm3 ?? bulkMaxVolumeCm3)
              : bulkMaxVolumeCm3,
            maxLpnCount: useLevelProfileForBulk
              ? Number(levelProfile?.maxLpnCount ?? bulkMaxLpnCount)
              : bulkMaxLpnCount,
            maxPalletCapacity: bulkMaxPalletCapacity,
          };
        })
      );

      showToast.success(
        `Applied capacity profile to ${targets.length} rack(s) — ${result.updatedLocations} bin(s) updated.`
      );
      // Drop the cached snapshot so reopening the planner shows the applied profile.
      void queryClient.invalidateQueries({ queryKey: ["slotting-planner-locations", warehouseId] });
      onUpdated?.();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to apply bulk capacities");
    } finally {
      setBulkApplying(false);
    }
  };

  const assignMaterial = async () => {
    if (!warehouseId || !selectedMaterialId || !selectedLocationCode) {
      showToast.error("Select material and location first");
      return;
    }
    try {
      await materialDefaultLocationsApi.assignDefaultLocation(
        selectedMaterialId,
        warehouseId,
        selectedLocationCode,
        1
      );
      showToast.success("Material assigned to location");
      onUpdated?.();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to assign material");
    }
  };

  const deleteRack = async (rackId: string) => {
    if (!warehouseId) return;
    const parsed = parseRackId(rackId);
    if (!parsed) return;
    const { area, row: rowNumber, bay: bayNumber } = parsed;
    try {
      setDeletingRackId(rackId);
      const result = await locationsApi.deleteRack(warehouseId, area, rowNumber, bayNumber);
      setLocations((prev) =>
        prev.filter((loc) => !locationMatchesRack(loc, rackId))
      );
      showToast.success(result.message);
      onUpdated?.();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to delete rack");
    } finally {
      setDeletingRackId(null);
    }
  };

  const totalPages = Math.ceil(rackRows.length / pageSize);
  const paginatedRacks = useMemo(() => {
    return rackRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [rackRows, currentPage]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Slotting Rules Planner" size="xl">
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-base-300 p-3 bg-base-100">
            <div className="font-semibold mb-2">Amalgamated Classes</div>
            <div className="text-xs text-base-content/70">
              A* = high-volume products, B* = medium-volume products, C* = low-volume products.
              F = fast-moving, M = medium-moving, S = slow-moving.
            </div>
          </div>

          <div className="rounded-lg border border-base-300 p-3">
            <div className="font-semibold mb-3">Bulk Capacity Assigner</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="form-control">
                <span className="label-text text-xs">Target</span>
                <select
                  className="select select-bordered"
                  value={bulkTargetZone}
                  onChange={(e) => setBulkTargetZone(e.target.value as "ALL" | "A" | "B" | "C" | "D")}
                >
                  <option value="ALL">All Racks</option>
                  <option value="A">Zone A</option>
                  <option value="B">Zone B</option>
                  <option value="C">Zone C</option>
                  <option value="D">Zone D</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Units Capacity</span>
                <input className="input input-bordered" type="number" min={1} value={bulkCapacity} onChange={(e) => setBulkCapacity(Number(e.target.value) || 0)} />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Max Weight (kg)</span>
                <input className="input input-bordered" type="number" min={0} value={bulkMaxWeightKg} onChange={(e) => setBulkMaxWeightKg(Number(e.target.value) || 0)} />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Max Volume (cm3)</span>
                <input className="input input-bordered" type="number" min={0} value={bulkMaxVolumeCm3} onChange={(e) => setBulkMaxVolumeCm3(Number(e.target.value) || 0)} />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Max LPN Count</span>
                <input className="input input-bordered" type="number" min={0} value={bulkMaxLpnCount} onChange={(e) => setBulkMaxLpnCount(Number(e.target.value) || 0)} />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Max Pallet Capacity</span>
                <input className="input input-bordered" type="number" min={0} value={bulkMaxPalletCapacity} onChange={(e) => setBulkMaxPalletCapacity(Number(e.target.value) || 0)} />
              </label>
            </div>
            <button className="btn btn-primary mt-3" onClick={() => void applyBulkCapacity()} disabled={bulkApplying}>
              {bulkApplying ? "Applying..." : "Apply Capacity Profile"}
            </button>
            <div className="form-control mt-3">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={useLevelProfileForBulk}
                  onChange={(e) => setUseLevelProfileForBulk(e.target.checked)}
                />
                <span className="label-text text-xs">Use per-level profile (L1..L5) instead of one value for all levels</span>
              </label>
            </div>
            {useLevelProfileForBulk && (
              <div className="overflow-auto mt-2">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Max units</th>
                      <th>Max weight (kg)</th>
                      <th>Max volume (cm³)</th>
                      <th>LPN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkLevelProfile.map((profile, idx) => (
                      <tr key={profile.level}>
                        <td>L{profile.level}</td>
                        <td>
                          <input
                            type="number"
                            className="input input-bordered input-xs w-20"
                            value={profile.capacity}
                            onChange={(e) =>
                              setBulkLevelProfile((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, capacity: Number(e.target.value) || 0 } : row))
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input input-bordered input-xs w-24"
                            value={profile.maxWeightKg}
                            onChange={(e) =>
                              setBulkLevelProfile((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, maxWeightKg: Number(e.target.value) || 0 } : row))
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input input-bordered input-xs w-28"
                            value={profile.maxVolumeCm3}
                            onChange={(e) =>
                              setBulkLevelProfile((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, maxVolumeCm3: Number(e.target.value) || 0 } : row))
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input input-bordered input-xs w-16"
                            value={profile.maxLpnCount}
                            onChange={(e) =>
                              setBulkLevelProfile((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, maxLpnCount: Number(e.target.value) || 0 } : row))
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-base-300 p-3">
            <div className="font-semibold mb-3">Rack Class Mapping</div>
            <div className="max-h-72 overflow-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Rack</th>
                    <th>Class</th>
                    <th>Units</th>
                    <th>Weight kg</th>
                    <th>Volume cm3</th>
                    <th>LPN</th>
                    <th>Pallets</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRacks.map((rack) => (
                    <Fragment key={rack.rackId}>
                    <tr>
                      <td className="font-mono">{rack.rackId}</td>
                      <td>
                        <select
                          className="select select-bordered select-sm"
                          value={rack.rackClass}
                          onChange={(e) =>
                            setLocations((prev) =>
                              prev.map((loc) =>
                                rack.locationIds.includes(loc.id) ? { ...loc, amalgamatedClass: e.target.value } : loc
                              )
                            )
                          }
                        >
                          {CLASS_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input input-bordered input-sm w-24"
                          value={rack.capacity ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            setLocations((prev) =>
                              prev.map((loc) => (rack.locationIds.includes(loc.id) ? { ...loc, capacity: value } : loc))
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input input-bordered input-sm w-28"
                          value={rack.maxWeightKg ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            setLocations((prev) =>
                              prev.map((loc) => (rack.locationIds.includes(loc.id) ? { ...loc, maxWeightKg: value } : loc))
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input input-bordered input-sm w-32"
                          value={rack.maxVolumeCm3 ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            setLocations((prev) =>
                              prev.map((loc) => (rack.locationIds.includes(loc.id) ? { ...loc, maxVolumeCm3: value } : loc))
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input input-bordered input-sm w-20"
                          value={rack.maxLpnCount ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            setLocations((prev) =>
                              prev.map((loc) => (rack.locationIds.includes(loc.id) ? { ...loc, maxLpnCount: value } : loc))
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input input-bordered input-sm w-24"
                          value={rack.maxPalletCapacity ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            setLocations((prev) =>
                              prev.map((loc) => (rack.locationIds.includes(loc.id) ? { ...loc, maxPalletCapacity: value } : loc))
                            );
                          }}
                        />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-xs btn-outline"
                            disabled={savingRackId === rack.rackId}
                            onClick={() => void saveRackByLocation(rack.rackId, rack.locationIds)}
                          >
                            {savingRackId === rack.rackId ? "Saving..." : "Save"}
                          </button>
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={() => setExpandedRackId((prev) => (prev === rack.rackId ? null : rack.rackId))}
                          >
                            {expandedRackId === rack.rackId ? "Hide Levels" : "Edit Levels"}
                          </button>
                          <button
                            className="btn btn-xs btn-outline btn-error"
                            disabled={deletingRackId === rack.rackId}
                            onClick={() => void deleteRack(rack.rackId)}
                          >
                            {deletingRackId === rack.rackId ? "Deleting..." : "Delete Rack"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRackId === rack.rackId && (
                      <tr>
                        <td colSpan={8}>
                          <div className="rounded border border-base-300 p-2 bg-base-200">
                            <div className="text-xs font-semibold mb-2">Per-level capacity overrides (applies to both bins A/B on that level)</div>
                            <div className="overflow-auto">
                              <table className="table table-xs">
                                <thead>
                                  <tr>
                                    <th>Level</th>
                                    <th>Units</th>
                                    <th>Weight kg</th>
                                    <th>Volume cm3</th>
                                    <th>LPN</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from(
                                    new Set(
                                      locations
                                        .filter((loc) => rack.locationIds.includes(loc.id))
                                        .map((loc) => loc.levelNumber || 0)
                                    )
                                  )
                                    .sort((a, b) => a - b)
                                    .map((level) => {
                                      const levelLocations = locations.filter(
                                        (loc) => rack.locationIds.includes(loc.id) && (loc.levelNumber || 0) === level
                                      );
                                      const sample = levelLocations[0];
                                      return (
                                        <tr key={`${rack.rackId}-L${level}`}>
                                          <td>L{level}</td>
                                          <td>
                                            <input
                                              type="number"
                                              className="input input-bordered input-xs w-20"
                                              value={Number(sample?.capacity ?? 0)}
                                              onChange={(e) => {
                                                const value = Number(e.target.value) || 0;
                                                setLocations((prev) =>
                                                  prev.map((loc) =>
                                                    rack.locationIds.includes(loc.id) && (loc.levelNumber || 0) === level
                                                      ? { ...loc, capacity: value }
                                                      : loc
                                                  )
                                                );
                                              }}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="number"
                                              className="input input-bordered input-xs w-24"
                                              value={Number(sample?.maxWeightKg ?? 0)}
                                              onChange={(e) => {
                                                const value = Number(e.target.value) || 0;
                                                setLocations((prev) =>
                                                  prev.map((loc) =>
                                                    rack.locationIds.includes(loc.id) && (loc.levelNumber || 0) === level
                                                      ? { ...loc, maxWeightKg: value }
                                                      : loc
                                                  )
                                                );
                                              }}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="number"
                                              className="input input-bordered input-xs w-28"
                                              value={Number(sample?.maxVolumeCm3 ?? 0)}
                                              onChange={(e) => {
                                                const value = Number(e.target.value) || 0;
                                                setLocations((prev) =>
                                                  prev.map((loc) =>
                                                    rack.locationIds.includes(loc.id) && (loc.levelNumber || 0) === level
                                                      ? { ...loc, maxVolumeCm3: value }
                                                      : loc
                                                  )
                                                );
                                              }}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="number"
                                              className="input input-bordered input-xs w-16"
                                              value={Number(sample?.maxLpnCount ?? 0)}
                                              onChange={(e) => {
                                                const value = Number(e.target.value) || 0;
                                                setLocations((prev) =>
                                                  prev.map((loc) =>
                                                    rack.locationIds.includes(loc.id) && (loc.levelNumber || 0) === level
                                                      ? { ...loc, maxLpnCount: value }
                                                      : loc
                                                  )
                                                );
                                              }}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-3">
                <div className="text-xs text-base-content/60">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, rackRows.length)} of {rackRows.length} racks
                </div>
                <div className="join">
                  <button
                    className="join-item btn btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    «
                  </button>
                  <button className="join-item btn btn-sm no-animation">Page {currentPage} of {totalPages}</button>
                  <button
                    className="join-item btn btn-sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-base-300 p-3">
            <div className="font-semibold mb-3">Assign Product to Location</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="select select-bordered"
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
              >
                <option value="">Select Material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.materialCode} - {m.description}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered"
                value={selectedLocationCode}
                onChange={(e) => setSelectedLocationCode(e.target.value)}
              >
                <option value="">Select Location</option>
                {locations
                  .slice()
                  .sort((a, b) => a.locationCode.localeCompare(b.locationCode))
                  .map((loc) => (
                    <option key={loc.id} value={loc.locationCode}>
                      {loc.locationCode} ({(loc.amalgamatedClass || "CM").toUpperCase()})
                    </option>
                  ))}
              </select>
              <button className="btn btn-primary" onClick={() => void assignMaterial()}>
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
