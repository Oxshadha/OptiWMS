"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  showDot?: boolean;
  className?: string;
  children?: ReactNode;
}

export function StatusChip({
  label,
  tone = "neutral",
  showDot = false,
  className,
  children,
}: StatusChipProps) {
  return (
    <span className={clsx("status-chip", `status-chip--${tone}`, className)}>
      {showDot && <span className="status-chip__dot" aria-hidden="true" />}
      {label}
      {children}
    </span>
  );
}
