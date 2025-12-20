import { apiClient } from './client';

export interface UserInfo {
  username: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  username: string;
  role: string;
}

export const authApi = {
  getCurrentUser: async (): Promise<UserInfo> => {
    return apiClient.get<UserInfo>('/auth/me');
  },

  login: async (username: string, password: string): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/login', { username, password });
  },
};

