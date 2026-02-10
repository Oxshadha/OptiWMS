export interface DeliveryPartnerDisplay {
  id: string;
  partnerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  serviceAreas: string[];
  type: "local" | "foreign";
  rating: number;
  costPerDelivery: number;
  currencyCode?: string;
  status: string;
}
