"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Material } from "@/lib/api/materials";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import { warehousesApi } from "@/lib/api/warehouses";
import { logger } from "@/lib/utils/logger";

interface MaterialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAssignLocation: () => void;
}

export function MaterialDetailModal({
  isOpen,
  onClose,
  material,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onAssignLocation,
}: MaterialDetailModalProps) {
  const displayName = material.description?.split(",")[0]?.trim() || material.description || "—";
  const [defaultLocations, setDefaultLocations] = useState<Array<{ locationCode: string; priority: number; warehouseName: string }>>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadDefaultLocations = async () => {
      try {
        setIsLoadingLocations(true);
        const warehouses = await warehousesApi.getAll();
        const locationsByWarehouse = await Promise.all(
          warehouses.map(async (wh) => {
            try {
              const locations = await materialDefaultLocationsApi.getDefaultLocations(material.id, wh.id);
              return locations.map(loc => ({
                locationCode: loc.locationCode,
                priority: loc.priority,
                warehouseName: wh.name,
              }));
            } catch (err) {
              return [];
            }
          })
        );
        setDefaultLocations(locationsByWarehouse.flat());
      } catch (err) {
        logger.error("Failed to load default locations:", err);
      } finally {
        setIsLoadingLocations(false);
      }
    };

    loadDefaultLocations();
  }, [isOpen, material.id]);

  const typeMap: Record<string, string> = {
    raw_material: "Raw Material",
    product: "Product",
    packaging_material: "Packaging",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Material: ${material.materialCode}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">
              <span className="label-text font-medium">Product Code</span>
            </label>
            <div className="font-mono font-semibold text-primary">{material.materialCode}</div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Category</span>
            </label>
            <div>{typeMap[material.materialType || "raw_material"] || material.materialType || "—"}</div>
          </div>
          <div className="col-span-2">
            <label className="label">
              <span className="label-text font-medium">Product Name</span>
            </label>
            <div>{displayName}</div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Typical Unit Size</span>
            </label>
            <div className="uppercase">{material.unitType || "—"}</div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Storage Type</span>
            </label>
            <div className="capitalize">{material.storageType || "—"}</div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Units Per Carton</span>
            </label>
            <div>{material.palletSpaces != null ? material.palletSpaces : "—"}</div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Carton Weight (kg)</span>
            </label>
            <div>
              {material.weightKg != null ? material.weightKg : "—"}
            </div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Length (cm)</span>
            </label>
            <div>{material.lengthCm != null ? material.lengthCm : "—"}</div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Width (cm)</span>
            </label>
            <div>{material.widthCm != null ? material.widthCm : "—"}</div>
          </div>
          <div>
            <label className="label">
              <span className="label-text font-medium">Height (cm)</span>
            </label>
            <div>{material.heightCm != null ? material.heightCm : "—"}</div>
          </div>
          <div className="col-span-2">
            <label className="label">
              <span className="label-text font-medium">Default Bin Locations</span>
            </label>
            {isLoadingLocations ? (
              <div className="flex justify-center py-2">
                <span className="loading loading-spinner"></span>
              </div>
            ) : defaultLocations.length > 0 ? (
              <div className="space-y-2">
                {defaultLocations.map((loc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-base-200 rounded">
                    <div>
                      <span className="font-mono font-semibold text-primary">{loc.locationCode}</span>
                      <span className="text-xs text-base-content/60 ml-2">
                        {loc.warehouseName} (Priority: {loc.priority})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-base-content/60 text-sm">No bin locations assigned</div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {canEdit && (
            <button
              className="btn btn-primary btn-sm"
              onClick={onAssignLocation}
            >
              <span className="material-symbols-outlined">location_on</span>
              Assign Bin Location
            </button>
          )}
          {canEdit && (
            <button
              className="btn btn-outline btn-sm"
              onClick={onEdit}
            >
              <span className="material-symbols-outlined">edit</span>
              Edit
            </button>
          )}
          {canDelete && (
            <button
              className="btn btn-outline btn-sm btn-error"
              onClick={onDelete}
            >
              <span className="material-symbols-outlined">delete</span>
              Delete
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
