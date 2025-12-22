/**
 * AI Service Status Indicator Component
 * Shows the status of AI services with fallback handling
 */

"use client";

import { AIServiceId, AIServiceConfig } from '@/lib/ai-services/registry';
import { useAIService } from '@/hooks/useAIService';
import clsx from 'clsx';

interface AIServiceStatusProps {
  serviceId: AIServiceId;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AIServiceStatus({ 
  serviceId, 
  showLabel = false, 
  size = 'md',
  className 
}: AIServiceStatusProps) {
  const { service, isAvailable, hasAccess, isLoading } = useAIService(serviceId);

  if (!hasAccess || !service) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={clsx("flex items-center gap-2", className)}>
        <span className="loading loading-spinner loading-xs"></span>
        {showLabel && <span className="text-xs">Checking...</span>}
      </div>
    );
  }

  const statusColors = {
    available: 'bg-success',
    degraded: 'bg-warning',
    unavailable: 'bg-error',
    unknown: 'bg-base-300',
  };

  const statusLabels = {
    available: 'Available',
    degraded: 'Degraded',
    unavailable: 'Unavailable',
    unknown: 'Unknown',
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div 
        className={clsx(
          "rounded-full",
          sizeClasses[size],
          statusColors[service.status] || statusColors.unknown
        )}
        title={statusLabels[service.status] || 'Unknown'}
      />
      {showLabel && (
        <span className="text-xs text-base-content/60">
          {service.name}: {statusLabels[service.status] || 'Unknown'}
        </span>
      )}
    </div>
  );
}

interface AIServiceFallbackProps {
  serviceId: AIServiceId;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component that shows fallback content when AI service is unavailable
 */
export function AIServiceFallback({ serviceId, fallback, children }: AIServiceFallbackProps) {
  const { isAvailable, hasAccess } = useAIService(serviceId);

  if (!hasAccess) {
    return null;
  }

  if (!isAvailable) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

