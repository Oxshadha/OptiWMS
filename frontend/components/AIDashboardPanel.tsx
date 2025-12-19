/**
 * AI Dashboard Panel Component
 * Placeholder component for AI service dashboards
 * Can be easily replaced when AI services are implemented
 */

"use client";

import { AIServiceId } from "@/lib/ai-services/registry";
import { useAIService } from "@/hooks/useAIService";
import { AIServiceFallback, AIServiceStatus } from "./AIServiceStatus";
import clsx from "clsx";

interface AIDashboardPanelProps {
  serviceId: AIServiceId;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function AIDashboardPanel({
  serviceId,
  title,
  description,
  children,
  className,
}: AIDashboardPanelProps) {
  const { service, isAvailable, hasAccess, isLoading } =
    useAIService(serviceId);

  if (!hasAccess) {
    return null;
  }

  return (
    <div
      className={clsx("card bg-base-100 border border-base-300 p-6", className)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
            {title}
            <AIServiceStatus serviceId={serviceId} size="sm" />
          </h3>
          {description && (
            <p className="text-sm text-base-content/60 mt-1">{description}</p>
          )}
        </div>
      </div>

      <AIServiceFallback
        serviceId={serviceId}
        fallback={
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-base-content/30 mb-2">
              psychology
            </span>
            <p className="text-sm text-base-content/60">
              AI service is currently unavailable. Core WMS functionality
              continues to work normally.
            </p>
            {service && (
              <p className="text-xs text-base-content/40 mt-2">
                Service: {service.name}
              </p>
            )}
          </div>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          children || (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-base-content/30 mb-2">
                auto_awesome
              </span>
              <p className="text-sm text-base-content/60">
                AI service is available. Dashboard content will be displayed
                here.
              </p>
              <p className="text-xs text-base-content/40 mt-2">
                This is a placeholder. Replace with actual AI dashboard
                components.
              </p>
            </div>
          )
        )}
      </AIServiceFallback>
    </div>
  );
}

/**
 * Helper component to show AI service status badge
 */
export function AIServiceStatusBadge({
  serviceId,
}: {
  serviceId: AIServiceId;
}) {
  const { service, isAvailable, hasAccess } = useAIService(serviceId);

  if (!hasAccess || !service) {
    return null;
  }

  return (
    <div className="badge badge-sm" data-status={service.status}>
      {service.name}
    </div>
  );
}
