export interface SupplierDisplay {
  id: string;
  supplierCode: string;
  name: string;
  country: string;
  type: "local" | "foreign";
  contactPerson: string;
  email: string;
  phone: string;
  productsSupplied: number;
  leadTimeDays: number;
  rating: number;
  status: string;
}
