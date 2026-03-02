import { apiClient } from './client';
import { logger } from "@/lib/utils/logger";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  userId?: string;
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  warehouseId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export interface UserInfo {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: string;
  warehouseId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dashboardSettings?: string;
}

export const authApi = {
  login: async (request: LoginRequest): Promise<LoginResponse> => {
    // CRITICAL: Clear any existing tokens before login to prevent token conflicts
    // This ensures we don't use an old token from a different user/role
    logger.log('[AuthAPI] Clearing existing tokens before login');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Login endpoint doesn't require authentication
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = 'Login failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData?.message || errorData?.detail || errorData?.error || `Login failed: ${response.status}`;
      } catch (e) {
        const errorText = await response.text().catch(() => '');
        errorMessage = errorText || `Login failed: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Store new tokens (only if login was successful)
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      logger.log('[AuthAPI] New access token stored');
      // Dispatch custom event to notify other tabs AND current tab
      // Note: storage event only fires in OTHER tabs, not the current one
      window.dispatchEvent(new CustomEvent('tokenChanged'));
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
      logger.log('[AuthAPI] New refresh token stored');
    }

    return data;
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Token refresh failed' }));
      throw new Error(error.error || 'Token refresh failed');
    }

    const data = await response.json();
    
    // Update stored tokens
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }

    return data;
  },

  getCurrentUser: async (): Promise<UserInfo> => {
    return apiClient.get<UserInfo>('/auth/me');
  },

  logout: async () => {
    logger.log('[AuthAPI] Logging out...');
    
    // Clear tokens from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    logger.log('[AuthAPI] Tokens cleared from localStorage');
    // Dispatch custom event to notify other tabs AND current tab
    window.dispatchEvent(new CustomEvent('tokenChanged'));
    
    // Clear IndexedDB data (both admin and worker)
    if (typeof window !== 'undefined') {
      try {
        const { initDB, deleteFromStore, STORES } = await import('@/lib/indexeddb');
        await initDB();
        
        // Clear admin data
        try {
          await deleteFromStore(STORES.ADMIN_DATA, 'admin_data');
          logger.log('[AuthAPI] Admin data cleared from IndexedDB');
        } catch (error) {
          logger.error('[AuthAPI] Error clearing admin data:', error);
        }
        
        // Clear worker data
        try {
          await deleteFromStore(STORES.WORKER_DATA, 'current_worker');
          logger.log('[AuthAPI] Worker data cleared from IndexedDB');
        } catch (error) {
          logger.error('[AuthAPI] Error clearing worker data:', error);
        }
      } catch (error) {
        logger.error('[AuthAPI] Error during logout cleanup:', error);
        // Continue anyway - tokens are already cleared
      }
    }
    
    logger.log('[AuthAPI] Logout complete');
  },

  getAccessToken: (): string | null => {
    return localStorage.getItem('accessToken');
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem('refreshToken');
  },

  updatePreferences: async (
    preferences: { blindReceivingMode?: boolean; dashboardSettings?: Record<string, any> }
  ): Promise<{ success: boolean; blindReceivingMode?: boolean; dashboardSettings?: string }> => {
    try {
      return await apiClient.put<{ success: boolean; blindReceivingMode?: boolean; dashboardSettings?: string }>('/auth/me/preferences', preferences);
    } catch (error: any) {
      // Provide more helpful error message for 404
      if (error.message && error.message.includes('404')) {
        throw new Error('Preferences endpoint not found. Please ensure the backend server has been restarted with the latest code.');
      }
      throw error;
    }
  },
};
