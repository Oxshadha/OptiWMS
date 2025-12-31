import { apiClient } from './client';

// Report DTO
export interface Report {
  id: string;
  reportName: string;
  reportType: string;
  description: string | null;
  reportConfig: string | null;
  generatedAt: string | null;
  fileSizeBytes: number | null;
  filePath: string | null;
  createdBy: string | null;
}

// Scheduled Report DTO
export interface ScheduledReport {
  id: string;
  reportType: string;
  frequency: string;
  scheduledTime: string | null;
  emailRecipients: string[];
  isActive: boolean;
  lastGeneratedAt: string | null;
  nextGenerationAt: string | null;
  createdBy: string | null;
}

// Request DTOs
export interface GenerateReportRequest {
  reportName: string;
  reportType: string;
  description?: string;
  reportConfig?: string;
  createdBy?: string;
}

export interface ScheduleReportRequest {
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  scheduledTime: string; // Format: "HH:mm:ss"
  emailRecipients: string[];
  isActive?: boolean;
  createdBy?: string;
}

export interface CreateCustomReportRequest {
  reportName: string;
  reportType: string;
  description?: string;
  reportConfig?: string; // JSON string with custom configuration
  createdBy?: string;
}

export const reportsApi = {
  // Get all reports
  getAllReports: async (
    type?: string,
    status?: string
  ): Promise<Report[]> => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<Report[]>(`/reports${query}`);
  },

  // Get report by ID
  getReportById: async (id: string): Promise<Report> => {
    return apiClient.get<Report>(`/reports/${id}`);
  },

  // Generate report
  generateReport: async (request: GenerateReportRequest): Promise<Report> => {
    return apiClient.post<Report>('/reports/generate', request);
  },

  // Download report
  downloadReport: async (id: string): Promise<string> => {
    return apiClient.get<string>(`/reports/${id}/download`);
  },

  // Get all scheduled reports
  getAllScheduledReports: async (type?: string): Promise<ScheduledReport[]> => {
    const params = type ? `?type=${type}` : '';
    return apiClient.get<ScheduledReport[]>(`/reports/scheduled${params}`);
  },

  // Get scheduled report by ID
  getScheduledReportById: async (id: string): Promise<ScheduledReport> => {
    return apiClient.get<ScheduledReport>(`/reports/scheduled/${id}`);
  },

  // Schedule report
  scheduleReport: async (request: ScheduleReportRequest): Promise<ScheduledReport> => {
    return apiClient.post<ScheduledReport>('/reports/schedule', request);
  },

  // Update scheduled report
  updateScheduledReport: async (
    id: string,
    request: ScheduleReportRequest
  ): Promise<ScheduledReport> => {
    return apiClient.put<ScheduledReport>(`/reports/scheduled/${id}`, request);
  },

  // Delete scheduled report
  deleteScheduledReport: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/reports/scheduled/${id}`);
  },

  // Create custom report
  createCustomReport: async (request: CreateCustomReportRequest): Promise<Report> => {
    return apiClient.post<Report>('/reports/custom', request);
  },
};

