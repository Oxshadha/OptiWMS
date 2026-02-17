"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { locationsApi, type Location } from "@/lib/api/locations";
import { materialsApi } from "@/lib/api/materials";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import { showToast } from "@/lib/utils/toast";

const CLASS_OPTIONS = ["AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"];

interface SlottingPlannerModalProps {
  isOpen: boolean;
  warehouseId?: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function SlottingPlannerModal({ isOpen, warehouseId, onClose, onUpdated }: SlottingPlannerModalProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; materialCode: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedLocationCode, setSelectedLocationCode] = useState("");
  const [savingRackId, setSavingRackId] = useState<string | null>(null);
  const [deletingRackId, setDeletingRackId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !warehouseId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [locs, mats] = await Promise.all([
          locationsApi.getStorageLocationsByWarehouse(warehouseId),
          materialsApi.getAll(),
        ]);
        setLocations(locs);
        setMaterials(mats.map((m) => ({ id: m.id, materialCode: m.materialCode, description: m.description })));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [isOpen, warehouseId]);

  const rackRows = useMemo(() => {
    const map = new Map<string, { rackId: string; locationIds: string[]; rackClass: string; zone: string }>();
    for (const loc of locations) {
      const zone = (loc.area || "C").toUpperCase();
      const row = (loc.rowNumber || "01").padStart(2, "0");
      const bay = (loc.bayNumber || "01").padStart(2, "0");
      const rackId = `${zone}-${row}-${bay}`;
      if (!map.has(rackId)) {
        map.set(rackId, {
          rackId,
          locationIds: [],
          rackClass: (loc.amalgamatedClass || "CM").toUpperCase(),
          zone,
        });
      }
      map.get(rackId)!.locationIds.push(loc.id);
    }
    return Array.from(map.values()).sort((a, b) => a.rackId.localeCompare(b.rackId));
  }, [locations]);

  const updateRackClass = async (rackId: string, locationIds: string[], value: string) => {
    try {
      setSavingRackId(rackId);
      await Promise.all(
        locationIds.map((id) =>
          locationsApi.updateRack(id, {
            amalgamatedClass: value,
          })
        )
      );
      setLocations((prev) =>
        prev.map((loc) => (locationIds.includes(loc.id) ? { ...loc, amalgamatedClass: value } : loc))
      );
      showToast.success(`Updated ${rackId} to ${value}`);
      onUpdated?.();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update slot class");
    } finally {
      setSavingRackId(null);
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
    const [area, rowNumber, bayNumber] = rackId.split("-");
    if (!area || !rowNumber || !bayNumber) return;
    try {
      setDeletingRackId(rackId);
      const result = await locationsApi.deleteRack(warehouseId, area, rowNumber, bayNumber);
      setLocations((prev) =>
        prev.filter((loc) => {
          const zone = (loc.area || "C").toUpperCase();
          const row = (loc.rowNumber || "01").padStart(2, "0");
          const bay = (loc.bayNumber || "01").padStart(2, "0");
          return `${zone}-${row}-${bay}` !== rackId;
        })
      );
      showToast.success(result.message);
      onUpdated?.();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to delete rack");
    } finally {
      setDeletingRackId(null);
    }
  };

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
              AF/AM/AS = high-priority front classes, BF/BM/BS = medium, CF/CM/CS = slower/deeper storage.
            </div>
          </div>

          <div className="rounded-lg border border-base-300 p-3">
            <div className="font-semibold mb-3">Rack Class Mapping</div>
            <div className="max-h-72 overflow-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Rack</th>
                    <th>Class</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rackRows.map((rack) => (
                    <tr key={rack.rackId}>
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
                        <div className="flex gap-2">
                          <button
                            className="btn btn-xs btn-outline"
                            disabled={savingRackId === rack.rackId}
                            onClick={() =>
                              updateRackClass(
                                rack.rackId,
                                rack.locationIds,
                                (locations.find((loc) => loc.id === rack.locationIds[0])?.amalgamatedClass || rack.rackClass).toUpperCase()
                              )
                            }
                          >
                            {savingRackId === rack.rackId ? "Saving..." : "Save"}
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
                  ))}
                </tbody>
              </table>
            </div>
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
