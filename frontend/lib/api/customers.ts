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
  status?: string;
}

export const customersApi = {
  getAll: async (): Promise<Customer[]> => {
    return apiClient.get<Customer[]>('/customers');
  },

  getById: async (id: string): Promise<Customer> => {
    return apiClient.get<Customer>(`/customers/${id}`);
  },

  create: async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    return apiClient.post<Customer>('/customers', customer);
  },

  update: async (id: string, customer: Partial<Customer>): Promise<Customer> => {
    return apiClient.put<Customer>(`/customers/${id}`, customer);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/customers/${id}`);
  },
};

