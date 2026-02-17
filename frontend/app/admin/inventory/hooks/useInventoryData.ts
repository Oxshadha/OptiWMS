import { useCallback, useEffect, useMemo, useState } from "react";
import { inventoryApi } from "@/lib/api/inventory";
import { materialsApi } from "@/lib/api/materials";
import { warehousesApi } from "@/lib/api/warehouses";
import { InventoryDisplayItem } from "../types";
import { logger } from "@/lib/utils/logger";

type SortBy = "name" | "sku" | "qty" | "location" | null;
type SortDirection = "asc" | "desc";

const normalizeSearchText = (value?: string | null) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

interface UseInventoryDataParams {
  isWarehouseManager: boolean;
  assignedWarehouseId?: string;
  activeItemType: string;
  activeStock: "All" | "Low" | "Available";
  activeWarehouse: string;
  searchQuery: string;
  sortBy: SortBy;
  sortDirection: SortDirection;
}

export function useInventoryData({
  isWarehouseManager,
  assignedWarehouseId,
  activeItemType,
  activeStock,
  activeWarehouse,
  searchQuery,
  sortBy,
  sortDirection,
}: UseInventoryDataParams) {
  const [inventoryItems, setInventoryItems] = useState<InventoryDisplayItem[]>([]);
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let materialTypeFilter: string | undefined = undefined;
      if (activeItemType === "Raw Material") {
        materialTypeFilter = "raw_material";
      } else if (activeItemType === "Packaging") {
        materialTypeFilter = "packaging_material";
      } else if (activeItemType === "Product") {
        materialTypeFilter = "product";
      }

      const [inventoryData, materialsData, warehousesData] = await Promise.all([
        inventoryApi.getAll(materialTypeFilter),
        materialsApi.getAll(),
        warehousesApi.getAll(),
      ]);

      const materialsMap = new Map();
      materialsData.forEach((m) => {
        materialsMap.set(m.id, {
          materialCode: m.materialCode,
          description: m.description,
          materialType: m.materialType,
        });
      });

      const warehousesMap = new Map();
      warehousesData.forEach((w) => {
        warehousesMap.set(w.id, w.name);
      });
      setWarehouses(warehousesMap);

      const grouped = new Map<string, {
        id: string;
        materialId: string;
        warehouseId: string;
        qty: number;
        availableQty: number;
        status: string;
        materialType?: string;
        reorderPoint?: string;
        bufferStock?: string;
        maxStock?: string;
        minStock?: string;
        moq?: string;
        leadTimeDays?: number;
        stackingQuantity?: number;
        bufferDays?: number;
        leadTimeMonths?: string;
        ropInDays?: string;
        varianceDemand?: string;
        varianceLeadTimeDemand?: string;
        difference?: string;
        orderDeliveryDays?: number;
        orderQuantity?: string;
        palletRequirement?: string;
        locations: Set<string>;
      }>();

      inventoryData.forEach((item) => {
        const key = `${item.materialId}::${item.warehouseId}`;
        const qty = Math.ceil(parseFloat(item.quantity) || 0);
        const availableQty = Math.ceil(parseFloat(item.availableQuantity) || 0);
        const existing = grouped.get(key);
        if (existing) {
          existing.qty += qty;
          existing.availableQty += availableQty;
          if (item.locationCode) {
            existing.locations.add(item.locationCode);
          }
        } else {
          grouped.set(key, {
            id: item.id,
            materialId: item.materialId,
            warehouseId: item.warehouseId,
            qty,
            availableQty,
            status: item.status,
            materialType: item.materialType,
            reorderPoint: item.reorderPoint,
            bufferStock: item.bufferStock,
            maxStock: item.maxStock,
            minStock: item.minStock,
            moq: item.moq,
            leadTimeDays: item.leadTimeDays,
            stackingQuantity: item.stackingQuantity,
            bufferDays: item.bufferDays,
            leadTimeMonths: item.leadTimeMonths,
            ropInDays: item.ropInDays,
            varianceDemand: item.varianceDemand,
            varianceLeadTimeDemand: item.varianceLeadTimeDemand,
            difference: item.difference,
            orderDeliveryDays: item.orderDeliveryDays,
            orderQuantity: item.orderQuantity,
            palletRequirement: item.palletRequirement,
            locations: new Set(item.locationCode ? [item.locationCode] : []),
          });
        }
      });

      const displayItems: InventoryDisplayItem[] = Array.from(grouped.values()).map((item) => {
        const material = materialsMap.get(item.materialId);
        const warehouseName = warehousesMap.get(item.warehouseId) || "Unknown";
        const qty = item.qty;
        const availableQty = item.availableQty;

        let status: "Available" | "Low" | "Out of Stock" = "Available";
        const reorderPoint = item.reorderPoint ? parseFloat(item.reorderPoint) : null;
        const bufferStock = item.bufferStock ? parseFloat(item.bufferStock) : null;

        if (item.status === "non_moving") {
          status = "Out of Stock";
        } else if (qty === 0) {
          status = "Out of Stock";
        } else if (reorderPoint != null && qty <= reorderPoint) {
          status = "Low";
        } else if (bufferStock != null && qty <= bufferStock) {
          status = "Low";
        } else if (qty < 10 || availableQty < 10) {
          status = "Low";
        }

        const materialType = item.materialType || material?.materialType || "raw_material";
        let itemType: "Product" | "Raw Material" | "Packaging";
        if (materialType.toLowerCase().includes("packaging")) {
          itemType = "Packaging";
        } else if (materialType.toLowerCase().includes("product")) {
          itemType = "Product";
        } else {
          itemType = "Raw Material";
        }

        const allLocations = Array.from(item.locations).filter(Boolean).sort();
        return {
          id: item.id,
          sku: material?.materialCode || item.materialId,
          name: material?.description || "Unknown Material",
          qty,
          location: allLocations.length > 0 ? allLocations[0] : "N/A",
          locations: allLocations,
          status,
          warehouseName,
          itemType,
          materialId: item.materialId,
          warehouseId: item.warehouseId,
          reorderPoint: item.reorderPoint,
          bufferStock: item.bufferStock,
          maxStock: item.maxStock,
          minStock: item.minStock,
          moq: item.moq,
          leadTimeDays: item.leadTimeDays,
          stackingQuantity: item.stackingQuantity,
          bufferDays: item.bufferDays,
          leadTimeMonths: item.leadTimeMonths,
          ropInDays: item.ropInDays,
          varianceDemand: item.varianceDemand,
          varianceLeadTimeDemand: item.varianceLeadTimeDemand,
          difference: item.difference,
          orderDeliveryDays: item.orderDeliveryDays,
          orderQuantity: item.orderQuantity,
          palletRequirement: item.palletRequirement,
        };
      });

      setInventoryItems(displayItems);
    } catch (err) {
      logger.error("Failed to load inventory data", err);
      setError("Failed to load inventory data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [activeItemType]);

  useEffect(() => {
    void loadData();
  }, [loadData, assignedWarehouseId]);

  const inventoryForWarehouse =
    isWarehouseManager && assignedWarehouseId
      ? inventoryItems.filter((item) => item.warehouseId === assignedWarehouseId)
      : inventoryItems;

  const inStockItems = useMemo(
    () => inventoryForWarehouse.filter((item) => item.qty > 0),
    [inventoryForWarehouse]
  );

  const filteredInventory = useMemo(() => {
    let filtered = inStockItems.filter((item) => {
      const matchesItemType =
        activeItemType === "All" ||
        (activeItemType === "Product" && item.itemType === "Product") ||
        (activeItemType === "Raw Material" && item.itemType === "Raw Material") ||
        (activeItemType === "Packaging" && item.itemType === "Packaging");
      const matchesStock =
        activeStock === "All" ||
        (activeStock === "Low" && item.status === "Low") ||
        (activeStock === "Available" && item.status === "Available");
      const matchesWarehouse = activeWarehouse === "All" || item.warehouseId === activeWarehouse;
      const query = searchQuery.trim().toLowerCase();
      const normalizedQuery = normalizeSearchText(searchQuery);
      if (!query) return matchesItemType && matchesStock && matchesWarehouse;
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query) ||
        (item.locations || []).some((loc) => loc.toLowerCase().includes(query)) ||
        item.status.toLowerCase().includes(query) ||
        item.warehouseName.toLowerCase().includes(query) ||
        item.qty.toString().includes(query) ||
        normalizeSearchText(item.name).includes(normalizedQuery) ||
        normalizeSearchText(item.sku).includes(normalizedQuery) ||
        normalizeSearchText(item.location).includes(normalizedQuery) ||
        (item.locations || []).some((loc) => normalizeSearchText(loc).includes(normalizedQuery)) ||
        normalizeSearchText(item.warehouseName).includes(normalizedQuery);
      return matchesItemType && matchesStock && matchesWarehouse && matchesSearch;
    });

    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number = a[sortBy];
        let bVal: string | number = b[sortBy];
        if (sortBy === "qty") {
          aVal = Number(aVal);
          bVal = Number(bVal);
        } else {
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    inStockItems,
    activeItemType,
    activeStock,
    activeWarehouse,
    searchQuery,
    sortBy,
    sortDirection,
  ]);

  const totalItems = Math.ceil(inStockItems.reduce((sum, item) => sum + item.qty, 0));
  const lowStockItems = inStockItems.filter((item) => item.status === "Low").length;
  const availableItems = inStockItems.filter((item) => item.status === "Available").length;

  return {
    warehouses,
    filteredInventory,
    totalItems,
    lowStockItems,
    availableItems,
    isLoading,
    error,
    reload: loadData,
  };
}
