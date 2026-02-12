import { apiClient } from './client';
import { logger } from "@/lib/utils/logger";

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
}

/**
 * Centralized Account Settings API
 * Works for all user types (admins, warehouse managers, workers)
 */
export const accountApi = {
  /**
   * Get current user profile
   */
  getCurrentUser: async (): Promise<UserProfile> => {
    logger.log('[AccountAPI] Fetching current user profile');
    const response = await apiClient.get<any>('/auth/me');

    logger.log('[AccountAPI] Current user fetched successfully');
    
    // Parse the response and split name
    const nameParts = response.name ? response.name.split(' ') : ['', ''];
    
    return {
      id: response.userId,
      username: response.username,
      email: response.email || '',
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: '', // Not included in /me response, will be loaded from profile update
      role: response.role,
    };
  },

  /**
   * Update profile information (name, email, phone)
   * Accessible to all authenticated users
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<{ success: boolean; message: string; user?: UserProfile }> => {
    logger.log('[AccountAPI] Updating profile');
    
    const response = await apiClient.put<{ success: boolean; message: string; user?: UserProfile }>('/auth/me/profile', data);

    logger.log('[AccountAPI] Profile updated successfully');
    return response;
  },

  /**
   * Change password (requires current password for verification)
   * Accessible to all authenticated users
   */
  changePassword: async (data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> => {
    logger.log('[AccountAPI] Changing password');
    
    const response = await apiClient.put<{ success: boolean; message: string }>('/auth/me/password', data);

    logger.log('[AccountAPI] Password changed successfully');
    return response;
  },
};
