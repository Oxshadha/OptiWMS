import { apiClient } from './client';

export interface DeliveryPartner {
  id: string;
  code?: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  serviceType?: string;
  status?: string;
}

export const deliveryPartnersApi = {
  getAll: async (): Promise<DeliveryPartner[]> => {
    return apiClient.get<DeliveryPartner[]>('/delivery-partners');
  },

  getById: async (id: string): Promise<DeliveryPartner> => {
    return apiClient.get<DeliveryPartner>(`/delivery-partners/${id}`);
  },

  getShipments: async (id: string): Promise<any[]> => {
    return apiClient.get<any[]>(`/delivery-partners/${id}/shipments`);
  },

  getMetrics: async (id: string): Promise<any> => {
    return apiClient.get<any>(`/delivery-partners/${id}/metrics`);
  },

  create: async (partner: Omit<DeliveryPartner, 'id'>): Promise<DeliveryPartner> => {
    return apiClient.post<DeliveryPartner>('/delivery-partners', partner);
  },

  update: async (id: string, partner: Partial<DeliveryPartner>): Promise<DeliveryPartner> => {
    return apiClient.put<DeliveryPartner>(`/delivery-partners/${id}`, partner);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/delivery-partners/${id}`);
  },
};

