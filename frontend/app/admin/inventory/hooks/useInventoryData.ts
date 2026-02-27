import { useCallback, useEffect, useMemo, useState } from "react";
import { inventoryApi } from "@/lib/api/inventory";
import { materialsApi } from "@/lib/api/materials";
import { warehousesApi } from "@/lib/api/warehouses";
import { InventoryDisplayItem } from "../types";
import { logger } from "@/lib/utils/logger";

type SortBy = "name" | "sku" | "qty" | "location" | null;
type SortDirection = "asc" | "desc";

interface UseInventoryDataParams {
  isWarehouseManager: boolean;
  assignedWarehouseId?: string;
  activeItemType: string;
  activeStock: "All" | "Low" | "Available";
  activeWarehouse: string;
  searchQuery: string;
  sortBy: SortBy;
  sortDirection: SortDirection;
  currentPage: number;
  itemsPerPage: number;
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
  currentPage,
  itemsPerPage,
}: UseInventoryDataParams) {
  const [inventoryItems, setInventoryItems] = useState<InventoryDisplayItem[]>([]);
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    try {
      setIsFetching(true);
      if (!hasLoadedOnce) {
        setIsLoading(true);
      }
      setError(null);

      let materialTypeFilter: string | undefined;
      if (activeItemType === "Raw Material") {
        materialTypeFilter = "raw_material";
      } else if (activeItemType === "Packaging") {
        materialTypeFilter = "packaging_material";
      } else if (activeItemType === "Product") {
        materialTypeFilter = "product";
      }

      const effectiveWarehouse =
        isWarehouseManager && assignedWarehouseId
          ? assignedWarehouseId
          : activeWarehouse !== "All"
            ? activeWarehouse
            : undefined;

      const [inventoryPage, materialsData, warehousesData] = await Promise.all([
        inventoryApi.getPaged({
          page: currentPage - 1,
          size: itemsPerPage,
          sortBy: "id",
          sortDir: "desc",
          warehouseId: effectiveWarehouse,
          materialType: materialTypeFilter,
          q: searchQuery.trim() || undefined,
        }),
        materialsApi.getAll(),
        warehousesApi.getAll(),
      ]);

      const materialsMap = new Map<string, { materialCode?: string; description?: string; materialType?: string }>();
      materialsData.forEach((m) => {
        materialsMap.set(m.id, {
          materialCode: m.materialCode,
          description: m.description,
          materialType: m.materialType,
        });
      });

      const warehousesMap = new Map<string, string>();
      warehousesData.forEach((w) => {
        warehousesMap.set(w.id, w.name);
      });
      setWarehouses(warehousesMap);

      const mapped: InventoryDisplayItem[] = inventoryPage.data.map((item) => {
        const material = materialsMap.get(item.materialId);
        const warehouseName = warehousesMap.get(item.warehouseId) || "Unknown";
        const qty = Math.ceil(parseFloat(item.quantity) || 0);
        const availableQty = Math.ceil(parseFloat(item.availableQuantity) || 0);

        let status: "Available" | "Low" | "Out of Stock" = "Available";
        const reorderPoint = item.reorderPoint ? parseFloat(item.reorderPoint) : null;
        const bufferStock = item.bufferStock ? parseFloat(item.bufferStock) : null;
        if (item.status === "non_moving" || qty === 0) {
          status = "Out of Stock";
        } else if (reorderPoint != null && qty <= reorderPoint) {
          status = "Low";
        } else if (bufferStock != null && qty <= bufferStock) {
          status = "Low";
        } else if (qty < 10 || availableQty < 10) {
          status = "Low";
        }

        const materialType = item.materialType || material?.materialType || "raw_material";
        let itemType: "Product" | "Raw Material" | "Packaging" = "Raw Material";
        if (materialType.toLowerCase().includes("packaging")) {
          itemType = "Packaging";
        } else if (materialType.toLowerCase().includes("product")) {
          itemType = "Product";
        }

        const location = item.locationCode || "N/A";
        return {
          id: item.id,
          sku: material?.materialCode || item.materialId,
          name: material?.description || "Unknown Material",
          qty,
          location,
          locations: item.locationCode ? [item.locationCode] : [],
          batches: item.batchNumber ? [item.batchNumber] : [],
          nearestExpiryDate: item.expiryDate,
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

      setInventoryItems(mapped);
      setTotalElements(inventoryPage.totalElements);
      setTotalPages(Math.max(inventoryPage.totalPages, 1));
      setHasLoadedOnce(true);
    } catch (err) {
      logger.error("Failed to load inventory data", err);
      setError("Failed to load inventory data. Please try again.");
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [
    activeItemType,
    activeWarehouse,
    assignedWarehouseId,
    currentPage,
    hasLoadedOnce,
    isWarehouseManager,
    itemsPerPage,
    searchQuery,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const inStockItems = useMemo(
    () => inventoryItems.filter((item) => item.qty > 0),
    [inventoryItems]
  );

  const filteredInventory = useMemo(() => {
    let filtered = inStockItems.filter((item) => {
      const matchesStock =
        activeStock === "All" ||
        (activeStock === "Low" && item.status === "Low") ||
        (activeStock === "Available" && item.status === "Available");
      return matchesStock;
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
  }, [inStockItems, activeStock, sortBy, sortDirection]);

  const totalItems = totalElements;
  const lowStockItems = inStockItems.filter((item) => item.status === "Low").length;
  const availableItems = inStockItems.filter((item) => item.status === "Available").length;

  return {
    warehouses,
    filteredInventory,
    totalItems,
    lowStockItems,
    availableItems,
    isLoading,
    isFetching,
    error,
    totalPages,
    totalElements,
    reload: loadData,
  };
}
