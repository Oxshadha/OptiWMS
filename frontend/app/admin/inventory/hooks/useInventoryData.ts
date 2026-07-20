import { useMemo } from "react";
import { inventoryApi } from "@/lib/api/inventory";
import {
  useInvalidateAdminList,
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
      activeStock,
      searchQuery.trim() || "",
      sortBy || "sku",
      sortDirection,
    ],
    queryFn: () =>
      inventoryApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: sortBy || "sku",
        sortDir: sortDirection,
        warehouseId: effectiveWarehouse,
        materialType: materialTypeFilter,
        stockState: activeStock.toLowerCase() as "all" | "low" | "available",
        q: searchQuery.trim() || undefined,
      }),
  });

  const summaryQuery = usePagedAdminQuery({
    queryKey: [
      "admin-inventory",
      "summary",
      effectiveWarehouse || "all",
      materialTypeFilter || "all",
    ],
    queryFn: () =>
      inventoryApi.getSummary({
        warehouseId: effectiveWarehouse,
        materialType: materialTypeFilter,
      }),
  });

  const materialsQuery = useReferenceMaterials();
  const warehousesQuery = useReferenceWarehouses();
  const invalidateInventoryList = useInvalidateAdminList(["admin-inventory"]);

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

  const queryError = inventoryQuery.error || summaryQuery.error || materialsQuery.error || warehousesQuery.error;
  const error = queryError ? "Failed to load inventory data. Please try again." : null;
  const isLoading =
    (inventoryQuery.isPending && !inventoryQuery.data) ||
    (materialsQuery.isPending && !materialsQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const isFetching =
    inventoryQuery.isFetching ||
    summaryQuery.isFetching ||
    materialsQuery.isFetching ||
    warehousesQuery.isFetching;

  const reload = async () => {
    await invalidateInventoryList();
  };

  const filteredInventory = inventoryItems;

  const inStockItems = useMemo(
    () => inventoryItems.filter((item) => item.qty > 0),
    [inventoryItems]
  );

  const totalItems = summaryQuery.data?.totalItems ?? inventoryQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(inventoryQuery.data?.totalPages ?? 1, 1);
  const totalElements = inventoryQuery.data?.totalElements ?? 0;

  const lowStockItems = summaryQuery.data?.lowStockItems ?? 0;
  const availableItems = summaryQuery.data?.inStockItems ?? 0;

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
