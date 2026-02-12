"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { AdminRole, isValidAdminRole } from "@/lib/admin-roles";
import { WorkerRole, isValidWorkerRole } from "@/lib/worker-roles";
import { logger } from "@/lib/utils/logger";

export type UserRole = AdminRole | WorkerRole | null;

export interface AuthUser {
  id: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  warehouseId?: string;
  warehouseName?: string;
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  role: UserRole;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  checkRouteAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_ROLES: string[] = ['admin', 'warehouse_manager', 'inbound_coordinator'];
const WORKER_ROLES: string[] = ['forklift_operator', 'picker', 'packer', 'receiver', 'quality_checker'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Load authentication state on mount
  useEffect(() => {
    loadAuthState();
  }, []);

  // Listen for token changes (cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        logger.debug('[AuthContext] Token changed in another tab');
        if (e.newValue) {
          loadAuthState();
        } else {
          setUser(null);
        }
      }
    };

    const handleTokenChange = () => {
      logger.debug('[AuthContext] Token change detected (same tab)');
      loadAuthState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tokenChanged', handleTokenChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenChanged', handleTokenChange);
    };
  }, []);

  const loadAuthState = async () => {
    try {
      setIsLoading(true);
      
      const token = authApi.getAccessToken();
      if (!token) {
        logger.debug('[AuthContext] No token found');
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Fetch current user from API
      try {
        const userInfo = await authApi.getCurrentUser();
        logger.debug('[AuthContext] Fetched user info:', userInfo);

        // Fetch full user details. Some worker roles may not have /api/users/{id} permission.
        let fullUser: Awaited<ReturnType<typeof usersApi.getById>> | null = null;
        try {
          fullUser = await usersApi.getById(userInfo.userId);
        } catch (err) {
          logger.warn('[AuthContext] Falling back to /auth/me user payload (users endpoint unavailable):', err);
        }
        
        // Determine if user is admin or worker
        // Normalize role (remove ROLE_ prefix if present, like "role_admin" -> "admin")
        let normalizedRole = userInfo.role?.toLowerCase() || '';
        if (normalizedRole.startsWith('role_')) {
          normalizedRole = normalizedRole.substring(5); // Remove "role_" prefix
        }
        const isAdminRole = ADMIN_ROLES.includes(normalizedRole);
        const isWorkerRole = WORKER_ROLES.includes(normalizedRole);

        if (!isAdminRole && !isWorkerRole) {
          logger.warn('[AuthContext] Unknown role:', userInfo.role);
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Get warehouse name if applicable
        let warehouseName: string | undefined;
        if (fullUser?.warehouseId) {
          try {
            const { warehousesApi } = await import('@/lib/api/warehouses');
            const warehouse = await warehousesApi.getById(fullUser.warehouseId);
            warehouseName = warehouse.name;
          } catch (err) {
            logger.error('[AuthContext] Error fetching warehouse:', err);
          }
        }

        const authUser: AuthUser = {
          id: fullUser?.id || userInfo.userId,
          userId: fullUser?.id || userInfo.userId,
          username: fullUser?.username || userInfo.username,
          email: fullUser?.email || userInfo.email,
          name: fullUser
            ? (`${fullUser.firstName || ''} ${fullUser.lastName || ''}`.trim() || fullUser.username)
            : (userInfo.name || userInfo.username),
          role: (isAdminRole ? normalizedRole as AdminRole : normalizedRole as WorkerRole) || null,
          warehouseId: fullUser?.warehouseId || userInfo.warehouseId,
          warehouseName,
          avatar: fullUser?.avatarUrl,
        };

        setUser(authUser);
      } catch (error) {
        logger.error('[AuthContext] Error loading auth state:', error);
        // Token might be invalid
        if (error instanceof Error && error.message.includes('401')) {
          // Clear invalid token
          await authApi.logout();
        }
        setUser(null);
      }
    } catch (error) {
      logger.error('[AuthContext] Error in loadAuthState:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Clear existing tokens before login
      await authApi.logout();
      
      const response = await authApi.login({ username, password });
      
      if (!response.success) {
        return { success: false, error: response.message || 'Login failed' };
      }

      // Reload auth state to get user info
      await loadAuthState();
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
    } catch (error) {
      logger.error('[AuthContext] Error during logout:', error);
      // Clear state anyway
      setUser(null);
    }
  };

  const refreshAuth = async () => {
    await loadAuthState();
  };

  // Helper function to normalize role (remove role_ prefix)
  const normalizeRole = (role: string | null | undefined): string => {
    if (!role) return '';
    let normalized = role.toLowerCase();
    if (normalized.startsWith('role_')) {
      normalized = normalized.substring(5); // Remove "role_" prefix
    }
    return normalized;
  };

  const checkRouteAccess = (path: string): boolean => {
    if (!user || !user.role) {
      return false;
    }

    const normalizedRole = normalizeRole(user.role);

    // Admin routes
    if (path.startsWith('/admin')) {
      return ADMIN_ROLES.includes(normalizedRole);
    }

    // Worker routes
    if (path.startsWith('/worker')) {
      return WORKER_ROLES.includes(normalizedRole);
    }

    // Public routes (login pages, etc.)
    if (path === '/admin/login' || path === '/worker/login' || path === '/') {
      return true;
    }

    return false;
  };

  const isAdmin = user ? ADMIN_ROLES.includes(normalizeRole(user.role)) : false;
  const isWorker = user ? WORKER_ROLES.includes(normalizeRole(user.role)) : false;

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isAdmin,
    isWorker,
    role: user?.role || null,
    login,
    logout,
    refreshAuth,
    checkRouteAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
