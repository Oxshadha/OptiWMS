import type { StatusTone } from "@/components/StatusChip";

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

export const customerStatusTone = (s: string): StatusTone => {
  if (s === "Active") return "success";
  if (s === "On Hold") return "warning";
  return "neutral";
};
