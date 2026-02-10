"use client";

import { useEffect, useState } from "react";
import { formatMaterialDisplay, isUUID } from "@/lib/utils/material-display";
import { logger } from "@/lib/utils/logger";

export function ItemDetailsDisplay({ materialId }: { materialId: string }) {
  const [itemName, setItemName] = useState<string>("Loading...");
  const [itemSku, setItemSku] = useState<string>("N/A");

  useEffect(() => {
    const loadMaterial = async (retryCount = 0) => {
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

        setItemName(`Item (Material ID: ${materialId.substring(0, 8)}...)`);
        setItemSku("N/A");
      }
    };

    void loadMaterial();
  }, [materialId]);

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
    </div>
  );
}
