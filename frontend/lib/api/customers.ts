import { apiClient } from './client';

export interface Customer {
  id: string;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  status: string;
}

export interface PagedCustomersResponse {
  data: Customer[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const customersApi = {
  getAll: async (): Promise<Customer[]> => {
    return apiClient.get<Customer[]>('/master/customers');
  },

  getById: async (id: string): Promise<Customer> => {
    return apiClient.get<Customer>(`/master/customers/${id}`);
  },

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    status,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    status?: string;
    q?: string;
  }): Promise<PagedCustomersResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (status) params.append("status", status);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedCustomersResponse>(`/master/customers/paged?${params.toString()}`);
  },

  create: async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    return apiClient.post<Customer>('/master/customers', customer);
  },

  update: async (id: string, customer: Partial<Customer>): Promise<Customer> => {
    return apiClient.put<Customer>(`/master/customers/${id}`, customer);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/master/customers/${id}`);
  },
};
