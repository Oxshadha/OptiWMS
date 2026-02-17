import type { StatusTone } from "@/components/StatusChip";

export interface MaterialTypeChip {
  label: string;
  tone: StatusTone;
  className?: string;
}

export function getMaterialTypeChip(value?: string | null): MaterialTypeChip {
  const normalized = (value || "raw_material").toLowerCase().trim();

  if (normalized === "product" || normalized === "finished_good" || normalized === "finished_goods") {
    return { label: "Product", tone: "success" };
  }

  if (normalized === "packaging_material" || normalized === "packing_material" || normalized === "packaging") {
    return { label: "Packaging", tone: "neutral", className: "border-base-content/35" };
  }

  return { label: "Raw Material", tone: "info" };
}
