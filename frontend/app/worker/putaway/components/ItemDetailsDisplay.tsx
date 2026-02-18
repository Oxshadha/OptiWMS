"use client";

import { useEffect, useState } from "react";
import { formatMaterialDisplay, isUUID } from "@/lib/utils/material-display";
import { logger } from "@/lib/utils/logger";
import { inventoryApi } from "@/lib/api/inventory";

export function ItemDetailsDisplay({
  materialId,
  materialCode,
  materialName,
  warehouseId,
  existingLocations,
}: {
  materialId: string;
  materialCode?: string | null;
  materialName?: string | null;
  warehouseId?: string;
  existingLocations?: string[];
}) {
  const [itemName, setItemName] = useState<string>("Loading...");
  const [itemSku, setItemSku] = useState<string>("Loading...");
  const [inventoryLocations, setInventoryLocations] = useState<string[]>([]);

  useEffect(() => {
    const loadMaterial = async (retryCount = 0) => {
      if (materialName || materialCode) {
        setItemName(materialName || materialCode || "Item");
        setItemSku(materialCode || `MAT-${materialId.slice(0, 8).toUpperCase()}`);
      }
      try {
        const { materialsApi } = await import("@/lib/api/materials");
        const material = await materialsApi.getById(materialId);
        const display = formatMaterialDisplay(
          material.materialCode,
          material.description,
          material.id
        );
        setItemName(display.name || material.description || material.materialCode || "Item");
        setItemSku(display.sku || material.materialCode || "N/A");
      } catch (err) {
        logger.error("Failed to load material:", err);

        if (retryCount < 2) {
          setTimeout(() => {
            void loadMaterial(retryCount + 1);
          }, 1000 * Math.pow(2, retryCount));
          return;
        }

        setItemName(materialName || "Item details unavailable");
        setItemSku(materialCode || `MAT-${materialId.slice(0, 8).toUpperCase()}`);
      }
    };

    void loadMaterial();
  }, [materialId, materialCode, materialName]);

  useEffect(() => {
    const loadInventoryLocations = async () => {
      if (!warehouseId || !materialId) {
        return;
      }
      try {
        const items = await inventoryApi.getByMaterial(materialId);
        const locations = items
          .filter((i) => i.warehouseId === warehouseId && i.locationCode)
          .map((i) => i.locationCode as string);
        setInventoryLocations(Array.from(new Set(locations)));
      } catch (err) {
        logger.warn("Failed to load inventory locations for material:", err);
      }
    };
    void loadInventoryLocations();
  }, [materialId, warehouseId]);

  const effectiveLocations =
    existingLocations && existingLocations.length > 0
      ? existingLocations
      : inventoryLocations;

  return (
    <div className="p-3 bg-base-200 rounded-lg mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-base-content/60">inventory</span>
        <span className="text-sm text-base-content/60">Product</span>
      </div>
      <div className="font-semibold text-base-content">{itemName}</div>
      {itemSku && itemSku !== "N/A" && !isUUID(itemSku) && (
        <div className="text-xs text-base-content/60 mt-1">
          <span className="font-mono font-semibold text-primary">SKU: {itemSku}</span>
        </div>
      )}
      {effectiveLocations.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-base-content/60 mb-1">Current inventory locations</div>
          <div className="flex flex-wrap gap-1">
            {effectiveLocations.slice(0, 5).map((loc) => (
              <span key={loc} className="badge badge-outline badge-sm font-mono">
                {loc}
              </span>
            ))}
            {effectiveLocations.length > 5 && (
              <span className="badge badge-ghost badge-sm">+{effectiveLocations.length - 5}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
