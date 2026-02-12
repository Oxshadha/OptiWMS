export interface QualityCheckDisplay {
  id: string;
  checkId: string;
  inboundOrderNumber: string;
  productName: string;
  sku: string;
  quantityChecked: number;
  quantityPassed: number;
  quantityFailed: number;
  result: "passed" | "failed" | "partial";
  checkedByName: string;
  checkDate: string;
  approvedByName: string | null;
  approvalDate: string | null;
  warehouseName: string;
}

export const resultConfig = {
  passed: { label: "Passed", class: "badge-success" },
  failed: { label: "Failed", class: "badge-error" },
  partial: { label: "Partial", class: "badge-warning" },
};
