"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  AdminRole,
  hasPermission,
  canAccessRoute,
  getRoutePermissions,
  getRoleDisplayName,
} from "@/lib/admin-roles";
import { getFromStore, updateInStore, STORES, initDB } from "@/lib/indexeddb";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";

export interface AdminData {
  id: string;
  name: string;
  email: string;
  role: AdminRole | null;
  avatar?: string;
  warehouseId?: string; // For warehouse managers - the warehouse they're assigned to
  warehouseName?: string; // For warehouse managers - the warehouse name
}

interface AdminContextType {
  admin: AdminData | null;
  setAdmin: (admin: AdminData | null) => void;
  role: AdminRole | null;
  hasPermission: (route: string, permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
  getRoutePermissions: (route: string) => string[];
  isLoading: boolean;
  clearAdmin: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const ADMIN_DATA_KEY = "current_admin";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdminState] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  // Load admin data from IndexedDB on mount
  useEffect(() => {
    // Always load on mount to check for token
    loadAdminFromStorage();
  }, []);

  // Listen for storage changes from other tabs (e.g., when user logs in/out in another tab)
  // Also listen for custom events from the same tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Storage event only fires in OTHER tabs, not the current one
      if (e.key === 'accessToken') {
        console.log('[AdminContext] Token changed in another tab, reloading admin data');
        if (e.newValue) {
          // New token set - reload admin data (will validate role)
          loadAdminFromStorage();
        } else {
          // Token removed - clear admin state
          console.log('[AdminContext] Token removed in another tab, clearing admin state');
          setAdminState(null);
        }
      }
    };

    // Also listen for custom events from the same tab (when login happens in current tab)
    const handleTokenChange = () => {
      console.log('[AdminContext] Token change detected (same tab), reloading admin data');
      loadAdminFromStorage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tokenChanged', handleTokenChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenChanged', handleTokenChange);
    };
  }, []);

  // Reload admin data when navigating to admin routes (e.g., after login)
  // Also check localStorage token as a fallback
  useEffect(() => {
    // Skip on login page
    if (pathname === "/admin/login") {
      return;
    }
    
    // If we have a token but no admin data, try to load from storage/API
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
    
    if (pathname?.startsWith("/admin")) {
      if (!admin && hasToken) {
        // We have a token but no admin data - try loading from storage/API
        console.log("[AdminContext] Has token but no admin - reloading from storage/API");
        loadAdminFromStorage();
      } else if (!admin && !hasToken && isLoading) {
        // No token and no admin - ensure loading is false
        console.log("[AdminContext] No token and no admin - setting loading to false");
        setIsLoading(false);
      } else if (admin && isLoading) {
        // We have admin but still loading - set to false
        console.log("[AdminContext] Has admin but still loading - setting to false");
        setIsLoading(false);
      }
    }
  }, [pathname, admin, isLoading]);

  const loadAdminFromStorage = async () => {
    try {
      console.log("[AdminContext] Starting loadAdminFromStorage");
      
      // Check if we have a token - if yes, we're authenticated even without IndexedDB
      const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
      console.log("[AdminContext] Has token:", hasToken);
      
      // If we have admin state already, don't reload
      if (admin) {
        console.log("[AdminContext] Admin already in state, skipping load");
        setIsLoading(false);
        return;
      }
      
      // Ensure IndexedDB is initialized
      try {
        await initDB();
        console.log("[AdminContext] IndexedDB initialized");
      } catch (dbError) {
        console.error("[AdminContext] IndexedDB init error:", dbError);
        // Continue anyway - we can work without IndexedDB if we have a token
      }
      
      try {
        const stored = await getFromStore<AdminData & { key: string }>(
          STORES.ADMIN_DATA,
          ADMIN_DATA_KEY
        );
        if (stored) {
          console.log("[AdminContext] Loaded admin from storage:", {
            role: stored.role,
            name: stored.name,
          });
          // Remove the 'key' property before setting state
          const { key, ...adminData } = stored;
          setAdminState(adminData);
          setIsLoading(false);
          return;
        }
      } catch (storeError) {
        console.error("[AdminContext] Error reading from store:", storeError);
        // Continue - IndexedDB might not be available
      }
      
      // If we have a token but no stored admin, fetch from API
      if (hasToken) {
        console.log("[AdminContext] Has token but no stored admin - fetching from API");
        try {
          const userInfo = await authApi.getCurrentUser();
          console.log("[AdminContext] Fetched user info from API:", userInfo);
          
          // Check if user is an admin role (include inbound_coordinator)
          const adminRoles = ['admin', 'warehouse_manager', 'inbound_coordinator'];
          // Normalize role (remove ROLE_ prefix if present, like "role_admin" -> "admin")
          let userRole = userInfo.role?.toLowerCase() || '';
          if (userRole.startsWith('role_')) {
            userRole = userRole.substring(5); // Remove "role_" prefix
          }
          
          if (adminRoles.includes(userRole)) {
            // Fetch full user details
            const fullUser = await usersApi.getById(userInfo.userId);
            
            const adminData: AdminData = {
              id: fullUser.id,
              name: `${fullUser.firstName || ''} ${fullUser.lastName || ''}`.trim() || fullUser.username,
              email: fullUser.email || userInfo.email,
              role: fullUser.role as AdminRole,
              warehouseId: fullUser.warehouseId,
              avatar: fullUser.avatarUrl,
            };
            
            // If warehouse manager, get warehouse name
            if (adminData.warehouseId) {
              try {
                const { warehousesApi } = await import('@/lib/api/warehouses');
                const warehouse = await warehousesApi.getById(adminData.warehouseId);
                adminData.warehouseName = warehouse.name;
              } catch (err) {
                console.error("[AdminContext] Error fetching warehouse:", err);
              }
            }
            
            setAdminState(adminData);
            
            // Save to IndexedDB in background
            try {
              await updateInStore(STORES.ADMIN_DATA, {
                key: ADMIN_DATA_KEY,
                ...adminData,
              });
            } catch (err) {
              console.error("[AdminContext] Error saving to IndexedDB:", err);
            }
          } else {
            console.log("[AdminContext] User is not an admin role:", userInfo.role);
            console.log("[AdminContext] User is a worker - they should access /worker routes, not /admin routes");
            setAdminState(null);
            // Don't clear tokens - user is authenticated, just not an admin
            // They should be redirected to worker dashboard by the layout
          }
        } catch (apiError) {
          console.error("[AdminContext] Error fetching user from API:", apiError);
          // Token might be invalid - clear it
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
          setAdminState(null);
        }
      } else {
        console.log("[AdminContext] No token found - not authenticated");
        setAdminState(null);
      }
    } catch (error) {
      console.error("[AdminContext] Error loading admin from storage:", error);
      setAdminState(null);
    } finally {
      console.log("[AdminContext] Setting isLoading to false");
      setIsLoading(false);
    }
  };

  const setAdmin = async (newAdmin: AdminData | null) => {
    console.log("[AdminContext] setAdmin called:", { hasAdmin: !!newAdmin, role: newAdmin?.role });
    
    // Update state immediately (don't wait for IndexedDB)
    setAdminState(newAdmin);
    
    // CRITICAL: Set loading to false when admin is set
    if (newAdmin) {
      console.log("[AdminContext] Setting isLoading to false (admin set)");
      setIsLoading(false);
    }
    
    // Save to IndexedDB in background (non-blocking)
    if (newAdmin) {
      (async () => {
        try {
          // Ensure IndexedDB is initialized
          await initDB();
          await updateInStore(STORES.ADMIN_DATA, {
            key: ADMIN_DATA_KEY,
            id: newAdmin.id,
            name: newAdmin.name,
            email: newAdmin.email,
            role: newAdmin.role,
            avatar: newAdmin.avatar,
            warehouseId: newAdmin.warehouseId,
            warehouseName: newAdmin.warehouseName,
          });
        } catch (error) {
          console.error("Error saving admin to storage:", error);
          // Don't block login if IndexedDB fails - data is already in context
        }
      })();
    } else {
      (async () => {
        try {
          await initDB();
          const { deleteFromStore } = await import("@/lib/indexeddb");
          await deleteFromStore(STORES.ADMIN_DATA, ADMIN_DATA_KEY);
        } catch (error) {
          console.error("Error clearing admin from storage:", error);
        }
      })();
    }
  };

  const clearAdmin = () => {
    setAdmin(null);
  };

  const checkPermission = (route: string, permission: string): boolean => {
    return hasPermission(admin?.role || null, route, permission as any);
  };

  const checkRouteAccess = (route: string): boolean => {
    return canAccessRoute(admin?.role || null, route);
  };

  const getPermissions = (route: string): string[] => {
    return getRoutePermissions(admin?.role || null, route);
  };

  const value: AdminContextType = {
    admin,
    setAdmin,
    role: admin?.role || null,
    hasPermission: checkPermission,
    canAccessRoute: checkRouteAccess,
    getRoutePermissions: getPermissions,
    isLoading,
    clearAdmin,
  };

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextType {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
