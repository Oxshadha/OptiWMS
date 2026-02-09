import { apiClient } from './client';

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  notificationType: string; // order, inventory, cycle_count, task, anomaly, shipment, return, system
  read: boolean;
  actionUrl?: string;
  metadata?: string; // JSON string
  createdAt: string;
}

export interface CreateNotificationRequest {
  userId?: string; // null for broadcast
  title: string;
  message: string;
  notificationType: string;
  actionUrl?: string;
  metadata?: string; // JSON string
}

export const notificationsApi = {
  getAll: async (userId: string, read?: boolean): Promise<Notification[]> => {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (read !== undefined) params.append('read', read.toString());
    return apiClient.get<Notification[]>(`/notifications?${params.toString()}`);
  },

  getUnreadCount: async (userId: string): Promise<number> => {
    const response = await apiClient.get<{ count: number }>(`/notifications/unread-count?userId=${userId}`);
    return response.count;
  },

  create: async (request: CreateNotificationRequest): Promise<Notification> => {
    return apiClient.post<Notification>('/notifications', request);
  },

  markAsRead: async (id: string): Promise<Notification> => {
    return apiClient.put<Notification>(`/notifications/${id}/read`, {});
  },

  markAllAsRead: async (userId: string): Promise<void> => {
    return apiClient.put<void>(`/notifications/mark-all-read?userId=${userId}`, {});
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/notifications/${id}`);
  },
};

