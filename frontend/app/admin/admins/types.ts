import { AdminRole } from "@/lib/admin-roles";

export interface AdminDisplay {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  warehouseId?: string;
  warehouseName: string;
  lastLogin: string;
  avatar?: string;
  createdAt: string;
  status: string;
}

export const statusConfig = {
  active: { label: "Active", class: "badge-success" },
  inactive: { label: "Inactive", class: "badge-error" },
  suspended: { label: "Suspended", class: "badge-warning" },
};
