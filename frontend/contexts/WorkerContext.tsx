"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  WorkerRole,
  canAccessOperation,
  getAllowedOperations,
  getRoleDisplayName,
} from "@/lib/worker-roles";
import { getFromStore, updateInStore, STORES, initDB } from "@/lib/indexeddb";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { logger } from "@/lib/utils/logger";

export interface WorkerData {
  id: string;
  workerId: string;
  name: string;
  warehouse: string;
  warehouseId?: string; // Warehouse ID for API calls
  role: WorkerRole | null;
  avatar?: string;
  email?: string;
  phone?: string;
  deviceId?: string;
}

interface WorkerContextType {
  worker: WorkerData | null;
  setWorker: (worker: WorkerData | null) => void;
  role: WorkerRole | null;
  canAccess: (operation: string) => boolean;
  allowedOperations: string[];
  isLoading: boolean;
  clearWorker: () => void;
}

const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

const WORKER_DATA_KEY = "current_worker";

export function WorkerProvider({ children }: { children: ReactNode }) {
  const [worker, setWorkerState] = useState<WorkerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const prevPathnameRef = React.useRef<string | null>(null);

  // Load worker data from IndexedDB on mount
  useEffect(() => {
    loadWorkerFromStorage();
  }, []);

  // Listen for storage changes from other tabs (e.g., when user logs in/out in another tab)
  // Also listen for custom events from the same tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Storage event only fires in OTHER tabs, not the current one
      if (e.key === 'accessToken') {
        logger.debug('[WorkerContext] Token changed in another tab, reloading worker data');
        if (e.newValue) {
          // New token set - reload worker data (will validate role)
          loadWorkerFromStorage();
        } else {
          // Token removed - clear worker state
          logger.debug('[WorkerContext] Token removed in another tab, clearing worker state');
          setWorkerState(null);
        }
      }
    };

    // Also listen for custom events from the same tab (when login happens in current tab)
    const handleTokenChange = () => {
      logger.debug('[WorkerContext] Token change detected (same tab), reloading worker data');
      loadWorkerFromStorage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tokenChanged', handleTokenChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenChanged', handleTokenChange);
    };
  }, []);

  // Clear worker state (but not IndexedDB) when navigating TO login page
  // Only clear when we first arrive at login from another page, not when we're already on it
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;

    // Only clear if we're navigating TO login page from a non-login page
    // This prevents clearing when we're already on login and setting worker data
    if (
      pathname === "/worker/login" &&
      prevPathname !== "/worker/login" &&
      prevPathname !== null &&
      worker
    ) {
      logger.debug(
        "[WorkerContext] Clearing worker state on navigation to login page (keeping IndexedDB)",
        {
          from: prevPathname,
          to: pathname,
        }
      );
      setWorkerState(null);
    }

    // Always update the ref to track pathname changes
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
    }
  }, [pathname, worker]);

  // Reload worker data when navigating to worker routes (e.g., after login or page refresh)
  // Also check localStorage token as a fallback
  useEffect(() => {
    // Skip on login page
    if (pathname === "/worker/login") {
      return;
    }
    
    // If we have a token but no worker data, try to load from storage/API
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
    
    if (pathname?.startsWith("/worker")) {
      if (!worker && hasToken) {
        // We have a token but no worker data - try loading from storage/API
        logger.debug("[WorkerContext] Has token but no worker - reloading from storage/API");
        loadWorkerFromStorage();
      } else if (!worker && !hasToken && isLoading) {
        // No token and no worker - ensure loading is false
        logger.debug("[WorkerContext] No token and no worker - setting loading to false");
        setIsLoading(false);
      } else if (worker && isLoading) {
        // We have worker but still loading - set to false
        logger.debug("[WorkerContext] Has worker but still loading - setting to false");
        setIsLoading(false);
      }
    }
  }, [pathname, worker, isLoading]);

  const loadWorkerFromStorage = async () => {
    try {
      logger.debug(
        "[WorkerContext] Attempting to load worker with key:",
        WORKER_DATA_KEY
      );
      
      // Check if we have a token
      const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
      logger.debug("[WorkerContext] Has token:", hasToken);
      
      // Ensure IndexedDB is initialized
      try {
        await initDB();
      } catch (dbError) {
        logger.error("[WorkerContext] IndexedDB init error:", dbError);
      }
      
      try {
        const stored = await getFromStore<WorkerData & { key: string }>(
          STORES.WORKER_DATA,
          WORKER_DATA_KEY
        );
        logger.debug("[WorkerContext] Raw data from IndexedDB:", stored);
        if (stored) {
          logger.debug("[WorkerContext] Loaded worker from storage:", {
            role: stored.role,
            name: stored.name,
            key: stored.key,
            id: stored.id,
          });
          // Remove the 'key' property before setting state (key is only for IndexedDB)
          const { key, ...workerData } = stored;
          setWorkerState(workerData);
          setIsLoading(false);
          return;
        }
      } catch (storeError) {
        logger.error("[WorkerContext] Error reading from store:", storeError);
      }
      
      // If we have a token but no stored worker, fetch from API
      if (hasToken) {
        logger.debug("[WorkerContext] Has token but no stored worker - fetching from API");
        try {
          const userInfo = await authApi.getCurrentUser();
          logger.debug("[WorkerContext] Fetched user info from API:", userInfo);
          
          // Check if user is a worker role
          const workerRoles = [
            'forklift_operator', 'stacker_operator', 'powered_pallet_truck_operator',
            'unloading_worker', 'cycle_count_worker', 'picker', 'packer',
            'shipment_worker', 'returns_worker', 'vehicle_inspector', 'warehouse_safekeeping_worker'
          ];
          
          if (workerRoles.includes(userInfo.role?.toLowerCase())) {
            // Normalize role (remove ROLE_ prefix if present)
            let normalizedRole = userInfo.role.toLowerCase();
            if (normalizedRole.startsWith("role_")) {
              normalizedRole = normalizedRole.substring(5);
            }
            
            // Try to fetch full user details, but don't fail if workers don't have permission
            let workerData: WorkerData;
            try {
              const fullUser = await usersApi.getById(userInfo.userId);
              
              // Get warehouse name (non-blocking)
              let warehouseName = "Unknown Warehouse";
              if (fullUser.warehouseId) {
                try {
                  const { warehousesApi } = await import('@/lib/api/warehouses');
                  // Try to get warehouse by ID
                  try {
                    const warehouse = await warehousesApi.getById(fullUser.warehouseId);
                    warehouseName = warehouse.name;
                  } catch (err) {
                    // If getById fails, try to get all warehouses and find by ID
                    logger.debug("[WorkerContext] getById failed, trying getAll:", err);
                    try {
                      const warehouses = await warehousesApi.getAll();
                      const warehouse = warehouses.find(w => w.id === fullUser.warehouseId);
                      if (warehouse) {
                        warehouseName = warehouse.name;
                      } else {
                        logger.warn("[WorkerContext] Warehouse not found in list");
                        warehouseName = "Unknown Warehouse";
                      }
                    } catch (err2) {
                      logger.warn("[WorkerContext] Could not fetch warehouse name:", err2);
                      warehouseName = "Unknown Warehouse";
                    }
                  }
                } catch (err) {
                  // Workers may not have permission - use fallback
                  logger.warn("[WorkerContext] Could not fetch warehouse name (this is OK for workers):", err);
                  warehouseName = "Unknown Warehouse";
                }
              }
              
              workerData = {
                id: fullUser.id,
                workerId: fullUser.employeeId || fullUser.id.slice(0, 6),
                name: `${fullUser.firstName || ''} ${fullUser.lastName || ''}`.trim() || fullUser.username,
                warehouse: warehouseName,
                warehouseId: fullUser.warehouseId, // Store warehouse ID
                role: normalizedRole as WorkerRole,
                avatar: fullUser.avatarUrl,
                email: fullUser.email,
                phone: fullUser.phone,
                deviceId: fullUser.deviceId,
              };
            } catch (apiError: any) {
              // Workers don't have permission to access /api/users - use data from getCurrentUser
              logger.warn("[WorkerContext] Could not fetch full user details (workers may not have permission), using basic info:", apiError);
              
              // Get warehouse name and ID - try multiple methods
              let warehouseName = "Unknown";
              let warehouseId: string | undefined = userInfo.warehouseId;
              
              // If warehouseId is missing, try to find warehouse by name (fallback)
              // NOTE: This is a TEMPORARY fallback. Workers should have warehouseId set in database.
              if (!warehouseId) {
                logger.warn("[WorkerContext] ⚠️ No warehouseId in userInfo, trying fallback");
                try {
                  const { warehousesApi } = await import('@/lib/api/warehouses');
                  const warehouses = await warehousesApi.getAll();
                  logger.debug("[WorkerContext] Fetched warehouses for fallback:", warehouses.length);
                  
                  if (warehouses.length > 0) {
                    // Try to find "Colombo Main Warehouse" first, otherwise use first warehouse
                    const colomboWarehouse = warehouses.find(w => 
                      (w.name && w.name.toLowerCase().includes("colombo")) ||
                      w.code === "WH-001" ||
                      (w.name && w.name.toLowerCase().includes("main"))
                    );
                    
                    const selectedWarehouse = colomboWarehouse || warehouses[0];
                    warehouseId = selectedWarehouse.id;
                    warehouseName = selectedWarehouse.name;
                    logger.warn("[WorkerContext] ⚠️ Using fallback warehouse (worker should be assigned in database):", warehouseName, warehouseId);
                    logger.warn("[WorkerContext] ⚠️ Admin should assign worker to correct warehouse using: PUT /api/users/{id}/assign-warehouse");
                    logger.warn("[WorkerContext] ⚠️ Or via Admin UI: Workers → Edit → Select Warehouse → Update");
                  } else {
                    logger.error("[WorkerContext] ❌ No warehouses found in system!");
                    logger.error("[WorkerContext] ❌ Cannot set fallback warehouse - no warehouses exist!");
                  }
                } catch (err: any) {
                  logger.error("[WorkerContext] ❌ Could not fetch warehouses for fallback:", err?.message || err);
                  logger.error("[WorkerContext] ❌ Worker needs warehouseId assigned in database. Use: PUT /api/users/{id}/assign-warehouse");
                  // Don't set warehouseId if fallback fails - let the UI show the error
                }
              } else {
                // warehouseId exists - get warehouse name
                try {
                  const { warehousesApi } = await import('@/lib/api/warehouses');
                  // Try to get warehouse by ID
                  try {
                    const warehouse = await warehousesApi.getById(warehouseId);
                    warehouseName = warehouse.name;
                  } catch (err) {
                    // If getById fails, try to get all warehouses and find by ID
                    logger.debug("[WorkerContext] getById failed, trying getAll:", err);
                    try {
                      const warehouses = await warehousesApi.getAll();
                      const warehouse = warehouses.find(w => w.id === warehouseId);
                      if (warehouse) {
                        warehouseName = warehouse.name;
                      } else {
                        logger.warn("[WorkerContext] Warehouse not found in list");
                        warehouseName = "Unknown Warehouse";
                      }
                    } catch (err2) {
                      logger.warn("[WorkerContext] Could not fetch warehouse name:", err2);
                      warehouseName = "Unknown Warehouse";
                    }
                  }
                } catch (err) {
                  logger.warn("[WorkerContext] Could not fetch warehouse name (this is OK for workers):", err);
                  warehouseName = "Unknown Warehouse";
                }
              }
              
              // Build worker data from available info
              // Try to get employeeId from username if it looks like an employee ID
              let employeeId = "N/A";
              if (userInfo.username && (userInfo.username.startsWith("EMP-") || userInfo.username.match(/^[A-Z]{3}-\d+$/))) {
                employeeId = userInfo.username;
              } else {
                // Use first 6 chars of userId as fallback
                employeeId = userInfo.userId.slice(0, 6);
              }
              
              // CRITICAL: Ensure warehouseId is set (from userInfo or fallback)
              if (!warehouseId) {
                logger.error("[WorkerContext] ❌ CRITICAL: warehouseId is still undefined after fallback attempt!");
                logger.error("[WorkerContext] ❌ Worker MUST be assigned to warehouse in database.");
                logger.error("[WorkerContext] ❌ Admin should use: PUT /api/users/{id}/assign-warehouse");
              } else {
                logger.debug("[WorkerContext] ✅ warehouseId is set:", warehouseId, "warehouseName:", warehouseName);
              }
              
              workerData = {
                id: userInfo.userId,
                workerId: employeeId, // Use employeeId format, not UUID
                name: userInfo.name || "Worker",
                warehouse: warehouseName,
                warehouseId: warehouseId || undefined, // Use found warehouseId (from API or fallback) - explicitly set to undefined if null
                role: normalizedRole as WorkerRole,
                avatar: undefined,
                email: userInfo.email,
                phone: undefined,
                deviceId: undefined,
              };
            }
            
            setWorkerState(workerData);
            setIsLoading(false); // CRITICAL: Set loading to false when worker data is set
            logger.debug("[WorkerContext] Worker data set from API:", {
              workerId: workerData.workerId,
              name: workerData.name,
              role: workerData.role,
              warehouse: workerData.warehouse,
              warehouseId: workerData.warehouseId,
              hasWarehouseId: !!workerData.warehouseId
            });
            
            // Save to IndexedDB in background
            try {
              await updateInStore(STORES.WORKER_DATA, {
                key: WORKER_DATA_KEY,
                ...workerData,
              });
            } catch (err) {
              logger.error("[WorkerContext] Error saving to IndexedDB:", err);
            }
          } else {
            logger.debug("[WorkerContext] User is not a worker role:", userInfo.role);
            setWorkerState(null);
            setIsLoading(false); // Set loading to false even if not a worker
          }
        } catch (apiError) {
          logger.error("[WorkerContext] Error fetching user from API:", apiError);
          // Token might be invalid - clear it
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
          setWorkerState(null);
          setIsLoading(false); // Set loading to false on error
        }
      } else {
        logger.debug("[WorkerContext] No token found - not authenticated");
        setWorkerState(null);
      }
    } catch (error) {
      logger.error(
        "[WorkerContext] Error loading worker from storage:",
        error
      );
      setWorkerState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setWorker = async (newWorker: WorkerData | null) => {
    logger.debug("[WorkerContext] setWorker called:", { hasWorker: !!newWorker, role: newWorker?.role });
    
    // Update state immediately (don't wait for IndexedDB)
    setWorkerState(newWorker);
    
    // CRITICAL: Set loading to false when worker is set
    if (newWorker) {
      logger.debug("[WorkerContext] Setting isLoading to false (worker set)");
      setIsLoading(false);
    }
    
    // Save to IndexedDB in background (non-blocking)
    if (newWorker) {
      (async () => {
        try {
          // Ensure IndexedDB is initialized
          await initDB();
          const dataToSave = {
            key: WORKER_DATA_KEY,
            id: newWorker.id,
            workerId: newWorker.workerId,
            name: newWorker.name,
            warehouse: newWorker.warehouse,
            warehouseId: newWorker.warehouseId,
            role: newWorker.role,
            avatar: newWorker.avatar,
            email: newWorker.email,
            phone: newWorker.phone,
            deviceId: newWorker.deviceId,
          };
          logger.debug("[WorkerContext] Saving worker to storage:", {
            key: dataToSave.key,
            role: dataToSave.role,
            name: dataToSave.name,
          });

          await updateInStore(STORES.WORKER_DATA, dataToSave);
          logger.debug("[WorkerContext] Worker saved to storage successfully");
        } catch (error) {
          logger.error("[WorkerContext] Error saving worker to storage:", error);
          // Don't block login if IndexedDB fails - data is already in context
        }
      })();
    } else {
      (async () => {
        try {
          // Clear worker data from IndexedDB
          await initDB();
          const { deleteFromStore } = await import("@/lib/indexeddb");
          await deleteFromStore(STORES.WORKER_DATA, WORKER_DATA_KEY);
          logger.debug("[WorkerContext] Cleared worker from storage");
        } catch (error) {
          logger.error("[WorkerContext] Error clearing worker from storage:", error);
        }
      })();
    }
  };

  const clearWorker = () => {
    setWorker(null);
  };

  const canAccess = (operation: string): boolean => {
    return canAccessOperation(worker?.role || null, operation);
  };

  const allowedOperations = worker?.role
    ? getAllowedOperations(worker.role)
    : [];

  const value: WorkerContextType = {
    worker,
    setWorker,
    role: worker?.role || null,
    canAccess,
    allowedOperations,
    isLoading,
    clearWorker,
  };

  return (
    <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>
  );
}

export function useWorker(): WorkerContextType {
  const context = useContext(WorkerContext);
  if (context === undefined) {
    throw new Error("useWorker must be used within a WorkerProvider");
  }
  return context;
}
