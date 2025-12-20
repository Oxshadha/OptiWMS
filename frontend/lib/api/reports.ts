import { apiClient } from './client';

export interface Report {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  [key: string]: any;
}

export const reportsApi = {
  getAll: async (): Promise<Report[]> => {
    return apiClient.get<Report[]>('/reports');
  },

  getById: async (id: string): Promise<Report> => {
    return apiClient.get<Report>(`/reports/${id}`);
  },

  generate: async (reportType: string, parameters: Record<string, any>): Promise<Report> => {
    return apiClient.post<Report>('/reports/generate', { reportType, parameters });
  },

  schedule: async (reportType: string, schedule: string, parameters: Record<string, any>): Promise<Report> => {
    return apiClient.post<Report>('/reports/schedule', { reportType, schedule, parameters });
  },

  download: async (id: string): Promise<Blob> => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
    const username = 'admin';
    const password = 'admin123';
    const credentials = btoa(`${username}:${password}`);
    
    const response = await fetch(`${API_BASE_URL}/reports/${id}/download`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.statusText}`);
    }

    return response.blob();
  },
};

