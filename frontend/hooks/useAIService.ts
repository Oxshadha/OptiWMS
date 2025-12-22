/**
 * React hook for AI service integration
 * Provides easy access to AI services with status checking
 */

import { useState, useEffect } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { 
  AIServiceId, 
  AIServiceConfig, 
  hasAIServiceAccess,
  getAIService,
  isAIServiceAvailable,
} from '@/lib/ai-services/registry';
import { checkAIServiceHealth, AIResponse } from '@/lib/ai-services/client';

export interface UseAIServiceReturn {
  service: AIServiceConfig | undefined;
  isAvailable: boolean;
  hasAccess: boolean;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook to use an AI service
 */
export function useAIService(serviceId: AIServiceId): UseAIServiceReturn {
  const { role } = useAdmin();
  const [service, setService] = useState<AIServiceConfig | undefined>(() => getAIService(serviceId));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasAccess = hasAIServiceAccess(role, serviceId);
  const isAvailable = service ? isAIServiceAvailable(serviceId) : false;

  const refreshStatus = async () => {
    if (!service) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const status = await checkAIServiceHealth(serviceId);
      setService({
        ...service,
        status,
        enabled: status === 'available' || status === 'degraded',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check service status');
      setService({
        ...service,
        status: 'unavailable',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (service && hasAccess) {
      refreshStatus();
    } else {
      setIsLoading(false);
    }
  }, [serviceId, hasAccess]);

  return {
    service,
    isAvailable,
    hasAccess,
    isLoading,
    error,
    refreshStatus,
  };
}

/**
 * Hook to use multiple AI services
 */
export function useAIServices(serviceIds: AIServiceId[]) {
  const { role } = useAdmin();
  const [services, setServices] = useState<Record<string, AIServiceConfig>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      setIsLoading(true);
      const serviceMap: Record<string, AIServiceConfig> = {};
      
      for (const serviceId of serviceIds) {
        if (hasAIServiceAccess(role, serviceId)) {
          const service = getAIService(serviceId);
          if (service) {
            try {
              const status = await checkAIServiceHealth(serviceId);
              serviceMap[serviceId] = {
                ...service,
                status,
                enabled: status === 'available' || status === 'degraded',
              };
            } catch {
              serviceMap[serviceId] = {
                ...service,
                status: 'unavailable',
              };
            }
          }
        }
      }
      
      setServices(serviceMap);
      setIsLoading(false);
    };

    loadServices();
  }, [serviceIds, role]);

  return {
    services,
    isLoading,
    hasAccess: (serviceId: AIServiceId) => hasAIServiceAccess(role, serviceId),
  };
}

