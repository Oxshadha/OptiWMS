"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Material } from "@/lib/api/materials";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import { locationsApi } from "@/lib/api/locations";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";

interface AssignBinLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  warehouseId: string | null;
  onSuccess?: () => void;
}

export function AssignBinLocationModal({
  isOpen,
  onClose,
  material,
  warehouseId: initialWarehouseId,
  onSuccess,
}: AssignBinLocationModalProps) {
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId || "");
  const [locationCode, setLocationCode] = useState<string>("");
  const [priority, setPriority] = useState<number>(1);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [storageLocations, setStorageLocations] = useState<Array<{ locationCode: string; area: string; rowNumber: string; bayNumber: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingLocations, setExistingLocations] = useState<Array<{ locationCode: string; priority: number }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData.map(w => ({ id: w.id, name: w.name })));
        
        if (warehousesData.length > 0 && !warehouseId) {
          setWarehouseId(warehousesData[0].id);
        }
      } catch (err) {
        console.error("Failed to load warehouses:", err);
        showToast.error("Failed to load warehouses");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, warehouseId]);

  // Load storage locations when warehouse is selected
  useEffect(() => {
    if (!warehouseId || !isOpen) return;

    const loadLocations = async () => {
      try {
        setIsLoading(true);
        // Get only storage locations (exclude staging, receiving, shipment, packing)
        const locations = await locationsApi.getStorageLocationsByWarehouse(warehouseId);
        setStorageLocations(locations.map(loc => ({
          locationCode: loc.locationCode,
          area: loc.area || "",
          rowNumber: loc.rowNumber || "",
          bayNumber: loc.bayNumber || "",
        })));

        // Load existing default locations for this material
        try {
          const existing = await materialDefaultLocationsApi.getDefaultLocations(material.id, warehouseId);
          setExistingLocations(existing.map(loc => ({
            locationCode: loc.locationCode,
            priority: loc.priority,
          })));
        } catch (err) {
          // Material may not have default locations yet
          setExistingLocations([]);
        }
      } catch (err) {
        console.error("Failed to load locations:", err);
        showToast.error("Failed to load storage locations");
      } finally {
        setIsLoading(false);
      }
    };

    loadLocations();
  }, [warehouseId, material.id, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!warehouseId || !locationCode) {
      showToast.error("Please select warehouse and location");
      return;
    }

    try {
      setIsSubmitting(true);
      await materialDefaultLocationsApi.assignDefaultLocation(
        material.id,
        warehouseId,
        locationCode,
        priority,
        material.materialType || undefined
      );
      showToast.success(`Bin location ${locationCode} assigned to ${material.materialCode}`);
      onSuccess?.(); // Call success callback to refresh locations
      onClose();
      // Reset form
      setLocationCode("");
      setPriority(1);
    } catch (err: any) {
      console.error("Failed to assign location:", err);
      showToast.error(err?.response?.data?.message || "Failed to assign bin location");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLocation = async (locCode: string) => {
    if (!warehouseId) return;
    
    try {
      await materialDefaultLocationsApi.removeDefaultLocation(material.id, warehouseId, locCode);
      showToast.success(`Location ${locCode} removed`);
      onSuccess?.(); // Call success callback to refresh locations
      // Reload existing locations
      const existing = await materialDefaultLocationsApi.getDefaultLocations(material.id, warehouseId);
      setExistingLocations(existing.map(loc => ({
        locationCode: loc.locationCode,
        priority: loc.priority,
      })));
    } catch (err: any) {
      console.error("Failed to remove location:", err);
      showToast.error("Failed to remove location");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Bin Location - ${material.materialCode}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warehouse Selection */}
        <div>
          <label className="label">
            <span className="label-text font-medium">Warehouse</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
          >
            <option value="">Select warehouse</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>

        {/* Existing Locations */}
        {existingLocations.length > 0 && (
          <div>
            <label className="label">
              <span className="label-text font-medium">Current Bin Locations</span>
            </label>
            <div className="space-y-2">
              {existingLocations.map((loc) => (
                <div key={loc.locationCode} className="flex items-center justify-between p-2 bg-base-200 rounded">
                  <div>
                    <span className="font-mono font-semibold">{loc.locationCode}</span>
                    <span className="text-xs text-base-content/60 ml-2">Priority: {loc.priority}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-error"
                    onClick={() => handleRemoveLocation(loc.locationCode)}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location Selection */}
        {warehouseId && (
          <div>
            <label className="label">
              <span className="label-text font-medium">Bin Location</span>
              <span className="label-text-alt text-primary">Storage locations only</span>
            </label>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner"></span>
              </div>
            ) : (
              <select
                className="select select-bordered w-full"
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                required
              >
                <option value="">Select bin location</option>
                {storageLocations.map((loc) => (
                  <option key={loc.locationCode} value={loc.locationCode}>
                    {loc.locationCode} ({loc.area}-{loc.rowNumber}-{loc.bayNumber})
                  </option>
                ))}
              </select>
            )}
            {storageLocations.length === 0 && !isLoading && (
              <div className="alert alert-warning mt-2">
                <span className="text-xs">No storage locations found. Please create storage locations first.</span>
              </div>
            )}
          </div>
        )}

        {/* Priority */}
        <div>
          <label className="label">
            <span className="label-text font-medium">Priority</span>
            <span className="label-text-alt">1 = primary, 2 = secondary, etc.</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            min="1"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
            required
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!warehouseId || !locationCode || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner"></span>
                Assigning...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check</span>
                Assign Location
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface BulkAssignBinLocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BulkAssignBinLocationsModal({ isOpen, onClose, onSuccess }: BulkAssignBinLocationsModalProps) {
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadWarehouses = async () => {
      try {
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData.map(w => ({ id: w.id, name: w.name })));
        if (warehousesData.length > 0) {
          setWarehouseId(warehousesData[0].id);
        }
      } catch (err) {
        console.error("Failed to load warehouses:", err);
        showToast.error("Failed to load warehouses");
      }
    };

    loadWarehouses();
  }, [isOpen]);

  const handleBulkAssign = async () => {
    if (!warehouseId) {
      showToast.error("Please select warehouse");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await materialDefaultLocationsApi.assignAllMaterials(warehouseId);
      if (result.success) {
        showToast.success(result.message || "Bin locations assigned to all materials and inventory updated");
      } else {
        showToast.error(result.message || "Failed to assign bin locations");
      }
      onSuccess?.(); // Call success callback to refresh locations
      onClose();
    } catch (err: any) {
      console.error("Failed to bulk assign:", err);
      showToast.error(err?.response?.data?.message || err?.message || "Failed to assign bin locations");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Assign Bin Locations">
      <div className="space-y-4">
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <div>
            <p className="font-semibold">Assign Default Bin Locations</p>
            <p className="text-sm mt-1">
              This will assign default bin locations to all materials in the selected warehouse.
              Materials will be distributed across available storage locations.
            </p>
            <p className="text-sm mt-2 font-semibold text-primary">
              ⚠️ This will also update inventory location_code for existing in-stock items.
            </p>
          </div>
        </div>

        <div>
          <label className="label">
            <span className="label-text font-medium">Warehouse</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
          >
            <option value="">Select warehouse</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleBulkAssign}
            disabled={!warehouseId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner"></span>
                Assigning...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">location_on</span>
                Assign to All Materials
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
