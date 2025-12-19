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
import { getFromStore, updateInStore, STORES } from "@/lib/indexeddb";

export interface AdminData {
  id: string;
  name: string;
  email: string;
  role: AdminRole | null;
  avatar?: string;
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
    loadAdminFromStorage();
  }, []);

  // Reload admin data when navigating to admin routes (e.g., after login)
  useEffect(() => {
    if (pathname?.startsWith("/admin") && pathname !== "/admin/login") {
      loadAdminFromStorage();
    }
  }, [pathname]);

  const loadAdminFromStorage = async () => {
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
      } else {
        console.log("[AdminContext] No admin data found in storage");
      }
    } catch (error) {
      console.error("Error loading admin from storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setAdmin = async (newAdmin: AdminData | null) => {
    setAdminState(newAdmin);
    if (newAdmin) {
      try {
        await updateInStore(STORES.ADMIN_DATA, {
          key: ADMIN_DATA_KEY,
          id: newAdmin.id,
          name: newAdmin.name,
          email: newAdmin.email,
          role: newAdmin.role,
          avatar: newAdmin.avatar,
        });
      } catch (error) {
        console.error("Error saving admin to storage:", error);
      }
    } else {
      try {
        // Clear admin data
        const { deleteFromStore } = await import("@/lib/indexeddb");
        await deleteFromStore(STORES.ADMIN_DATA, ADMIN_DATA_KEY);
      } catch (error) {
        console.error("Error clearing admin from storage:", error);
      }
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
