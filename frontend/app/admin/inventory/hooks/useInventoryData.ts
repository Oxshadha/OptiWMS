import { useMemo } from "react";
import { inventoryApi } from "@/lib/api/inventory";
import {
  usePagedAdminQuery,
  useReferenceMaterials,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";
import { InventoryDisplayItem } from "../types";

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
  const materialTypeFilter = useMemo(() => {
    if (activeItemType === "Raw Material") {
      return "raw_material";
    }
    if (activeItemType === "Packaging") {
      return "packaging_material";
    }
    if (activeItemType === "Product") {
      return "product";
    }
    return undefined;
  }, [activeItemType]);

  const effectiveWarehouse = useMemo(
    () =>
      isWarehouseManager && assignedWarehouseId
        ? assignedWarehouseId
        : activeWarehouse !== "All"
          ? activeWarehouse
          : undefined,
    [activeWarehouse, assignedWarehouseId, isWarehouseManager]
  );

  const inventoryQuery = usePagedAdminQuery({
    queryKey: [
      "admin-inventory",
      "paged",
      currentPage,
      itemsPerPage,
      effectiveWarehouse || "all",
      materialTypeFilter || "all",
      searchQuery.trim() || "",
    ],
    queryFn: () =>
      inventoryApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "id",
        sortDir: "desc",
        warehouseId: effectiveWarehouse,
        materialType: materialTypeFilter,
        q: searchQuery.trim() || undefined,
      }),
  });

  const materialsQuery = useReferenceMaterials();
  const warehousesQuery = useReferenceWarehouses();

  const warehouses = useMemo(() => {
    const warehousesMap = new Map<string, string>();
    (warehousesQuery.data || []).forEach((warehouse) => {
      warehousesMap.set(warehouse.id, warehouse.name);
    });
    return warehousesMap;
  }, [warehousesQuery.data]);

  const inventoryItems = useMemo<InventoryDisplayItem[]>(() => {
    const materialsMap = new Map<string, { materialCode?: string; description?: string; materialType?: string }>();
    (materialsQuery.data || []).forEach((material) => {
      materialsMap.set(material.id, {
        materialCode: material.materialCode,
        description: material.description,
        materialType: material.materialType,
      });
    });

    return (inventoryQuery.data?.data || []).map((item) => {
      const material = materialsMap.get(item.materialId);
      const warehouseName = warehouses.get(item.warehouseId) || "Unknown";
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

      const resolvedMaterialType = item.materialType || material?.materialType || "raw_material";
      let itemType: "Product" | "Raw Material" | "Packaging" = "Raw Material";
      if (resolvedMaterialType.toLowerCase().includes("packaging")) {
        itemType = "Packaging";
      } else if (resolvedMaterialType.toLowerCase().includes("product")) {
        itemType = "Product";
      }

      const location = item.locationCode || "N/A";
      return {
        id: item.id,
        sku: material?.materialCode || item.materialId,
        name: material?.description || "Unknown Material",
        qty,
        availableQty,
        reservedQty: Math.ceil(parseFloat(item.reservedQuantity) || 0),
        location,
        locations: item.locationCode ? [item.locationCode] : [],
        batches: item.batchNumber ? [item.batchNumber] : [],
        nearestExpiryDate: item.expiryDate,
        lastMovementDate: item.lastMovementDate,
        daysSinceLastMovement: item.daysSinceLastMovement,
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
  }, [inventoryQuery.data, materialsQuery.data, warehouses]);

  const queryError = inventoryQuery.error || materialsQuery.error || warehousesQuery.error;
  const error = queryError ? "Failed to load inventory data. Please try again." : null;
  const isLoading =
    (inventoryQuery.isPending && !inventoryQuery.data) ||
    (materialsQuery.isPending && !materialsQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const isFetching =
    inventoryQuery.isFetching ||
    materialsQuery.isFetching ||
    warehousesQuery.isFetching;

  const reload = async () => {
    await Promise.all([
      inventoryQuery.refetch(),
      materialsQuery.refetch(),
      warehousesQuery.refetch(),
    ]);
  };

  const filteredInventory = useMemo(() => {
    const inStockItems = inventoryItems.filter((item) => item.qty > 0);

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
  }, [inventoryItems, activeStock, sortBy, sortDirection]);

  const inStockItems = useMemo(
    () => inventoryItems.filter((item) => item.qty > 0),
    [inventoryItems]
  );

  const totalItems = inventoryQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(inventoryQuery.data?.totalPages ?? 1, 1);
  const totalElements = inventoryQuery.data?.totalElements ?? 0;

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
    reload,
  };
}
