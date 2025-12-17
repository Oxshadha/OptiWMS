"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  showCloseButton?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
  full: "max-w-full mx-4",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  className,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={clsx(
          "bg-base-100 rounded-xl border border-base-300 w-full",
          sizeClasses[size],
          "max-h-[90vh] overflow-y-auto",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-base-300">
            {title && <h2 className="text-2xl font-bold text-base-content">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center p-4 border-b border-base-300">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                currentStep >= index + 1
                  ? "bg-primary text-primary-content"
                  : "bg-base-300 text-base-content/60"
              )}
            >
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={clsx(
                  "w-16 h-1 mx-2",
                  currentStep > index + 1 ? "bg-primary" : "bg-base-300"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

