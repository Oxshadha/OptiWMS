import { apiClient } from './client';

export interface DeliveryPartner {
  id: string;
  partnerCode: string;
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  currencyCode?: string; // e.g., "USD", "LKR", "EUR"
  serviceAreas?: string; // JSON string
  rating?: string;
  costPerDelivery?: string;
  status: string;
  totalShipments?: number;
  onTimeDeliveryRate?: string;
}

export const deliveryPartnersApi = {
  getAll: async (status?: string): Promise<DeliveryPartner[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<DeliveryPartner[]>(`/delivery-partners${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<DeliveryPartner> => {
    return apiClient.get<DeliveryPartner>(`/delivery-partners/${id}`);
  },

  getByPartnerCode: async (partnerCode: string): Promise<DeliveryPartner> => {
    return apiClient.get<DeliveryPartner>(`/delivery-partners/code/${partnerCode}`);
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

