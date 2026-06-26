"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { RackUnit, RackStatus } from "@/lib/types/warehouse-layout";
import { locationsApi, type Location } from "@/lib/api/locations";
import { logger } from "@/lib/utils/logger";
import { locationMatchesRack, parseRackId } from "@/lib/utils/location-identity";

interface RackEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  rack: RackUnit | null;
  warehouseId: string;
  onUpdate: (updatedRack: RackUnit) => void;
}

type LevelSummary = {
  level: number;
  binCount: number;
  maxWeightKg: number | null;
  maxVolumeCm3: number | null;
  maxUnits: number | null;
  utilizationPct: number | null;
};

function buildLevelSummary(locations: Location[]): LevelSummary[] {
  const byLevel = new Map<number, Location[]>();
  for (const loc of locations) {
    const level = loc.levelNumber ?? 1;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(loc);
  }
  const summaries: LevelSummary[] = [];
  for (let level = 1; level <= 5; level++) {
    const bins = byLevel.get(level) ?? [];
    if (bins.length === 0) {
      summaries.push({ level, binCount: 0, maxWeightKg: null, maxVolumeCm3: null, maxUnits: null, utilizationPct: null });
      continue;
    }
    const maxWeight = Math.max(...bins.map((b) => b.maxWeightKg ?? 0));
    const maxVolume = Math.max(...bins.map((b) => b.maxVolumeCm3 ?? 0));
    const maxUnits = Math.max(...bins.map((b) => b.capacity ?? 0));
    const utilSamples = bins
      .filter((b) => b.maxPalletCapacity && b.maxPalletCapacity > 0)
      .map((b) => ((b.currentPalletCount ?? 0) / b.maxPalletCapacity!) * 100);
    const utilizationPct = utilSamples.length
      ? Math.round(utilSamples.reduce((a, b) => a + b, 0) / utilSamples.length)
      : null;
    summaries.push({
      level,
      binCount: bins.length,
      maxWeightKg: maxWeight || null,
      maxVolumeCm3: maxVolume || null,
      maxUnits: maxUnits || null,
      utilizationPct,
    });
  }
  return summaries;
}

export function RackEditModal({
  isOpen,
  onClose,
  rack,
  warehouseId,
  onUpdate,
}: RackEditModalProps) {
  const [status, setStatus] = useState<RackStatus>("active");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [amalgamatedClass, setAmalgamatedClass] = useState("CM");
  const [isSaving, setIsSaving] = useState(false);
  const [levelSummary, setLevelSummary] = useState<LevelSummary[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(false);

  useEffect(() => {
    if (rack) {
      setStatus(rack.status);
      setDescription(rack.description || "");
      setNotes(rack.notes || "");
      setAmalgamatedClass((rack.amalgamatedClass || "CM").toUpperCase());
    }
  }, [rack]);

  useEffect(() => {
    if (!isOpen || !rack || !warehouseId) {
      setLevelSummary([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingCaps(true);
        const parsed = parseRackId(rack.id);
        if (!parsed) return;
        const allLocations = await locationsApi.getByWarehouse(warehouseId);
        const rackLocations = allLocations.filter((loc) => locationMatchesRack(loc, rack.id));
        if (!cancelled) setLevelSummary(buildLevelSummary(rackLocations));
      } catch (e) {
        logger.error("Failed to load rack capacity summary", e);
      } finally {
        if (!cancelled) setLoadingCaps(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, rack, warehouseId]);

  const hasMissingCaps = useMemo(
    () => levelSummary.some((l) => l.binCount > 0 && (l.maxWeightKg == null || l.maxVolumeCm3 == null)),
    [levelSummary]
  );

  if (!isOpen || !rack) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      logger.debug("Saving rack:", rack.id, "Status:", status);
      
      // Rack ID is in format "area-row-bay" (e.g., "A-01-01")
      // We need to find all locations in this rack and update them
      const parsed = parseRackId(rack.id);
      if (!parsed) {
        throw new Error(`Invalid rack ID format: ${rack.id}. Expected format: area-row-bay`);
      }

      logger.debug("Parsed rack ID:", parsed);

      const allLocations = await locationsApi.getByWarehouse(warehouseId);
      logger.debug(`Found ${allLocations.length} total locations for warehouse`);

      const rackLocations = allLocations.filter((loc) => locationMatchesRack(loc, rack.id));
      
      logger.debug(`Found ${rackLocations.length} locations for rack ${rack.id}`);
      
      if (rackLocations.length === 0) {
        logger.error("No locations found. Available locations sample:", 
          allLocations.slice(0, 5).map(l => `${l.area}-${l.rowNumber}-${l.bayNumber}`));
        throw new Error(`No locations found for rack ${rack.id}. Please check the rack identifier.`);
      }
      
      // Update all locations in this rack with the rack properties
      const updatePromises = rackLocations.map(async (location) => {
        try {
          logger.debug(`Updating location ${location.id} (${location.locationCode})`);
          const updateData: any = {};
          updateData.rackStatus = status.toString();
          updateData.amalgamatedClass = amalgamatedClass;
          updateData.description = description.trim();
          updateData.notes = notes.trim();
          
          logger.debug("Update data:", updateData);
          return await locationsApi.updateRack(location.id, updateData);
        } catch (err: any) {
          logger.error(`Failed to update location ${location.id}:`, err);
          logger.error("Error details:", err?.response?.data || err?.message);
          throw err;
        }
      });
      
      await Promise.all(updatePromises);
      logger.debug("Successfully updated all locations in rack");
      
      // Update local rack object
      const updatedRack: RackUnit = {
        ...rack,
        status,
        amalgamatedClass,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      onUpdate(updatedRack);
      onClose();
    } catch (error: any) {
      logger.error("Failed to update rack:", error);
      const errorMessage = error?.message || "Failed to update rack. Please try again.";
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const statusOptions: {
    value: RackStatus;
    label: string;
    chipColor: string;
    chipTextColor: string;
    optionBgColor: string;
    borderColor: string;
    icon: string;
    description: string;
  }[] = [
    { 
      value: "active", 
      label: "Active", 
      chipColor: "#22C55E",
      chipTextColor: "#052E16",
      optionBgColor: "#F0FDF4",
      borderColor: "#16A34A",
      icon: "check_circle",
      description: "Rack is operational and available for use"
    },
    { 
      value: "maintenance", 
      label: "Maintenance", 
      chipColor: "#FEF3C7",
      chipTextColor: "#78350F",
      optionBgColor: "#FFFBEB",
      borderColor: "#D97706",
      icon: "build",
      description: "Rack needs repair or attention - use with caution"
    },
    { 
      value: "reserved", 
      label: "Reserved", 
      chipColor: "#E0F2FE",
      chipTextColor: "#0C4A6E",
      optionBgColor: "#F0F9FF",
      borderColor: "#0369A1",
      icon: "lock",
      description: "Rack is set aside for specific purpose"
    },
    { 
      value: "out_of_service", 
      label: "Out of Service", 
      chipColor: "#FEE2E2",
      chipTextColor: "#991B1B",
      optionBgColor: "#FEF2F2",
      borderColor: "#DC2626",
      icon: "warning",
      description: "Rack is not available - do not use"
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="card-surface p-6 max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-base-content">
              Edit Rack: {rack.id}
            </h2>
            <p className="text-sm text-base-content/70 mt-1">
              Zone: {rack.zone} | Aisle: {rack.aisle.toString().padStart(2, "0")} | Bay: {rack.bay.toString().padStart(2, "0")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-circle btn-sm btn-ghost"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Status */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rack Status *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as RackStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="space-y-2 mt-3">
              {statusOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center gap-3 p-2 rounded-lg border-2 transition-all ${
                    status === option.value
                      ? ""
                      : "bg-base-100 border-base-300"
                  }`}
                  style={{
                    cursor: "pointer",
                    ...(status === option.value
                      ? { borderColor: option.borderColor, backgroundColor: option.optionBgColor }
                      : {}),
                  }}
                  onClick={() => setStatus(option.value)}
                >
                  <span
                    className="badge badge-sm"
                    style={{ backgroundColor: option.chipColor, color: option.chipTextColor }}
                  >
                    <span className="material-symbols-outlined text-xs mr-1">{option.icon}</span>
                    {option.label}
                  </span>
                  <span className="text-xs text-base-content/70 flex-1">
                    {option.description}
                  </span>
                  {status === option.value && (
                    <span className="material-symbols-outlined text-primary text-sm">
                      check_circle
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Slotting Class</span>
              <span className="label-text-alt text-base-content/50">AF / AM / AS / BF / BM / BS / CF / CM / CS</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={amalgamatedClass}
              onChange={(e) => setAmalgamatedClass(e.target.value)}
            >
              {["AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Read-only L1–L5 capacity summary */}
          <div className="border border-base-300 rounded-lg p-4 bg-base-200/40">
            <div className="flex items-center justify-between mb-2">
              <span className="label-text font-medium">Level capacity (read-only)</span>
              <Link
                href="/admin/warehouses"
                className="link link-primary text-xs"
              >
                Edit capacity in Slotting Planner →
              </Link>
            </div>
            {loadingCaps ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                {hasMissingCaps && (
                  <p className="text-xs text-warning mb-2">Some levels are missing weight/volume caps.</p>
                )}
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th>Bins</th>
                        <th>Max wt (kg)</th>
                        <th>Max vol (cm³)</th>
                        <th>Max units</th>
                        <th>Util %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelSummary.map((row) => (
                        <tr key={row.level}>
                          <td>L{row.level}</td>
                          <td>{row.binCount || "—"}</td>
                          <td>{row.maxWeightKg ?? "—"}</td>
                          <td>{row.maxVolumeCm3 != null ? row.maxVolumeCm3.toLocaleString() : "—"}</td>
                          <td>{row.maxUnits ?? "—"}</td>
                          <td>{row.utilizationPct != null ? `${row.utilizationPct}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Description</span>
              <span className="label-text-alt text-base-content/50">
                What's typically stored in this rack
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="e.g., Electronics storage - High value items"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Notes</span>
              <span className="label-text-alt text-base-content/50">
                Additional information or special instructions
              </span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-24"
              placeholder="e.g., Requires temperature control, Fragile items only"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="btn btn-ghost flex-1"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary flex-1"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
