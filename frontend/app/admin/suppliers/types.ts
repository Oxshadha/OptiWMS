export interface SupplierDisplay {
  id: string;
  supplierCode: string;
  name: string;
  country: string;
  type: "local" | "foreign";
  contactPerson: string;
  email: string;
  phone: string;
  leadTimeDays: number | null;
  rating: number | null;
  status: string;
}
