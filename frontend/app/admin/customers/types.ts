export interface CustomerDisplay {
  id: string;
  originalId?: string;
  name: string;
  contact: string;
  phone: string;
  orders: number;
  status: string;
  joinDate: string;
}

export const statusClass = (s: string): string => {
  if (s === "Active") return "badge-success";
  if (s === "On Hold") return "badge-warning";
  return "badge-outline";
};
