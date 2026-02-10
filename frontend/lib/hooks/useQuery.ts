import { logger } from "@/lib/utils/logger";
/**
 * Custom React Query hooks for OptiWMS
 * Provides type-safe, cached data fetching with automatic refetch
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "@/lib/api/materials";
import { warehousesApi } from "@/lib/api/warehouses";
import { inventoryApi } from "@/lib/api/inventory";
import { customersApi } from "@/lib/api/customers";
import { suppliersApi } from "@/lib/api/suppliers";
import { usersApi } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";

// ===== Query Keys (for cache management) =====
export const queryKeys = {
  materials: {
    all: ["materials"] as const,
    detail: (id: string) => ["materials", id] as const,
  },
  warehouses: {
    all: ["warehouses"] as const,
    detail: (id: string) => ["warehouses", id] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    byWarehouse: (warehouseId: string) => ["inventory", "warehouse", warehouseId] as const,
  },
  customers: {
    all: ["customers"] as const,
    detail: (id: string) => ["customers", id] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    detail: (id: string) => ["suppliers", id] as const,
  },
  users: {
    all: ["users"] as const,
    detail: (id: string) => ["users", id] as const,
  },
};

// ===== Materials Hooks =====

export function useMaterials() {
  return useQuery({
    queryKey: queryKeys.materials.all,
    queryFn: async () => {
      logger.debug("[useMaterials] Fetching materials from API...");
      try {
        const data = await materialsApi.getAll();
        logger.debug("[useMaterials] Received materials:", data?.length || 0, "items");
        if (data && data.length > 0) {
          logger.debug("[useMaterials] First material:", data[0]);
        }
        return data;
      } catch (error) {
        logger.error("[useMaterials] Error fetching materials:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        showToast.error(`Failed to load materials: ${message}`);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}

export function useMaterial(id: string) {
  return useQuery({
    queryKey: queryKeys.materials.detail(id),
    queryFn: () => materialsApi.getById(id),
    enabled: !!id, // Only fetch if id exists
  });
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: materialsApi.create,
    onSuccess: () => {
      // Invalidate and refetch materials list
      queryClient.invalidateQueries({ queryKey: queryKeys.materials.all });
      showToast.success("Material created successfully");
    },
    onError: (error: any) => {
      showToast.error(error.message || "Failed to create material");
    },
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      materialsApi.update(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific material and list
      queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.materials.all });
      showToast.success("Material updated successfully");
    },
    onError: (error: any) => {
      showToast.error(error.message || "Failed to update material");
    },
  });
}

export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: materialsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials.all });
      showToast.success("Material deleted successfully");
    },
    onError: (error: any) => {
      showToast.error(error.message || "Failed to delete material");
    },
  });
}

// ===== Warehouses Hooks =====

export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.warehouses.all,
    queryFn: () => warehousesApi.getAll(),
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: queryKeys.warehouses.detail(id),
    queryFn: () => warehousesApi.getById(id),
    enabled: !!id,
  });
}

// ===== Inventory Hooks =====

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory.all,
    queryFn: () => inventoryApi.getAll(),
  });
}

export function useInventoryByWarehouse(warehouseId: string) {
  return useQuery({
    queryKey: queryKeys.inventory.byWarehouse(warehouseId),
    queryFn: () => inventoryApi.getByWarehouse(warehouseId),
    enabled: !!warehouseId,
  });
}

// ===== Customers Hooks =====

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.all,
    queryFn: () => customersApi.getAll(),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      showToast.success("Customer created successfully");
    },
    onError: (error: any) => {
      showToast.error(error.message || "Failed to create customer");
    },
  });
}

// ===== Suppliers Hooks =====

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers.all,
    queryFn: () => suppliersApi.getAll(),
  });
}

// ===== Users Hooks =====

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => usersApi.getAll(),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersApi.getById(id),
    enabled: !!id,
  });
}

// ===== Generic Cache Utilities =====

/**
 * Hook to manually invalidate queries (force refetch)
 */
export function useInvalidateQuery() {
  const queryClient = useQueryClient();
  
  return (queryKey: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey });
  };
}

/**
 * Hook to prefetch data (load in background)
 */
export function usePrefetch() {
  const queryClient = useQueryClient();
  
  return {
    prefetchMaterials: () => 
      queryClient.prefetchQuery({
        queryKey: queryKeys.materials.all,
        queryFn: () => materialsApi.getAll(),
      }),
    prefetchWarehouses: () =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.warehouses.all,
        queryFn: () => warehousesApi.getAll(),
      }),
  };
}
