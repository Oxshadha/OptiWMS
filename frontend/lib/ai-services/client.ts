/**
 * AI Services API Client
 * 
 * Handles communication with AI microservices.
 * Designed to gracefully handle service unavailability.
 */

import { AIServiceId, AIServiceStatus } from './registry';

// AI Services Base URL
// Note: AI services are optional microservices - if not running, health checks will return 'unavailable'
// This is expected behavior - the core WMS works without AI services
const AI_SERVICES_BASE_URL = process.env.NEXT_PUBLIC_AI_SERVICES_URL || 'http://localhost:8081/ai-services';

export interface AIRequest {
  serviceId: AIServiceId;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  params?: Record<string, string>;
}

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  serviceStatus?: AIServiceStatus;
}

/**
 * Check AI service health
 */
export async function checkAIServiceHealth(serviceId: AIServiceId): Promise<AIServiceStatus> {
  try {
    // AI services are optional - fail gracefully if not available
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    const response = await fetch(`${AI_SERVICES_BASE_URL}/${serviceId}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal, // Abort if timeout
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return 'available';
    } else {
      return 'unavailable';
    }
  } catch (error) {
    // AI services are optional - silently return unavailable
    // Don't log errors to console to avoid noise
    return 'unavailable';
  }
}

/**
 * Make a request to an AI service
 */
export async function callAIService<T = any>(request: AIRequest): Promise<AIResponse<T>> {
  const { serviceId, endpoint, method = 'GET', data, params } = request;
  
  try {
    // Check if service is available first
    const healthStatus = await checkAIServiceHealth(serviceId);
    
    if (healthStatus === 'unavailable') {
      return {
        success: false,
        error: `AI service ${serviceId} is currently unavailable`,
        serviceStatus: 'unavailable',
      };
    }

    // Build URL with query parameters
    let url = `${AI_SERVICES_BASE_URL}/${serviceId}${endpoint}`;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    // Make the request
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `AI service returned error: ${response.statusText}`,
        serviceStatus: healthStatus,
      };
    }

    const responseData = await response.json();
    
    return {
      success: true,
      data: responseData,
      serviceStatus: healthStatus,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      serviceStatus: 'unavailable',
    };
  }
}

/**
 * Demand Forecasting Service API
 */
export const demandForecastingAPI = {
  getForecast: async (materialId: string, days: number = 90) => {
    return callAIService({
      serviceId: 'demand-forecasting',
      endpoint: '/forecast',
      params: { materialId, days: days.toString() },
    });
  },
  
  getForecastAccuracy: async () => {
    return callAIService({
      serviceId: 'demand-forecasting',
      endpoint: '/accuracy',
    });
  },
};

/**
 * Min-Max Inventory Service API
 */
export const minMaxInventoryAPI = {
  getSuggestions: async (materialId?: string) => {
    return callAIService({
      serviceId: 'min-max-inventory',
      endpoint: '/suggestions',
      params: materialId ? { materialId } : {},
    });
  },
  
  approveSuggestion: async (materialId: string, min: number, max: number) => {
    return callAIService({
      serviceId: 'min-max-inventory',
      endpoint: '/approve',
      method: 'POST',
      data: { materialId, min, max },
    });
  },
};

/**
 * Optimal Storage Service API
 */
export const optimalStorageAPI = {
  getSuggestions: async (materialId: string, warehouseId: string) => {
    return callAIService({
      serviceId: 'optimal-storage',
      endpoint: '/suggestions',
      params: { materialId, warehouseId },
    });
  },
  
  enableSuggestions: async (warehouseId: string, enabled: boolean) => {
    return callAIService({
      serviceId: 'optimal-storage',
      endpoint: '/enable',
      method: 'POST',
      data: { warehouseId, enabled },
    });
  },
};

/**
 * Optimal Picking Path Service API
 */
export const optimalPickingPathAPI = {
  getPath: async (orderId: string, zoneId?: string) => {
    return callAIService({
      serviceId: 'optimal-picking-path',
      endpoint: '/path',
      params: { orderId, ...(zoneId && { zoneId }) },
    });
  },
  
  getEfficiencyMetrics: async (zoneId?: string) => {
    return callAIService({
      serviceId: 'optimal-picking-path',
      endpoint: '/metrics',
      params: zoneId ? { zoneId } : {},
    });
  },
};

/**
 * Anomaly Detection Service API
 */
export const anomalyDetectionAPI = {
  getActiveAnomalies: async (type?: string) => {
    return callAIService({
      serviceId: 'anomaly-detection',
      endpoint: '/anomalies',
      params: type ? { type } : {},
    });
  },
  
  resolveAnomaly: async (anomalyId: string, resolution: string) => {
    return callAIService({
      serviceId: 'anomaly-detection',
      endpoint: `/anomalies/${anomalyId}/resolve`,
      method: 'POST',
      data: { resolution },
    });
  },
};

/**
 * Procurement Agent API
 */
export const procurementAgentAPI = {
  analyzeOrderWorthiness: async (supplierOffer: {
    supplierId: string;
    materialId: string;
    price: number;
    discount?: number;
    quantity?: number;
  }) => {
    return callAIService({
      serviceId: 'procurement-agent',
      endpoint: '/analyze-order-worthiness',
      method: 'POST',
      data: supplierOffer,
    });
  },
  
  getRecommendations: async () => {
    return callAIService({
      serviceId: 'procurement-agent',
      endpoint: '/recommendations',
    });
  },
};

/**
 * AI Feedback API
 */
export interface AIFeedback {
  serviceId: AIServiceId;
  suggestionId: string;
  action: 'rejected' | 'deferred' | 'modified';
  reason: string;
  reasonCode: string;
  context: Record<string, any>;
}

export const aiFeedbackAPI = {
  submitFeedback: async (feedback: AIFeedback) => {
    return callAIService({
      serviceId: feedback.serviceId,
      endpoint: '/feedback',
      method: 'POST',
      data: {
        suggestionId: feedback.suggestionId,
        action: feedback.action,
        reason: feedback.reason,
        reasonCode: feedback.reasonCode,
        context: feedback.context,
        timestamp: Date.now(),
      },
    });
  },

  getFeedbackStats: async (serviceId: AIServiceId) => {
    return callAIService({
      serviceId,
      endpoint: '/feedback-stats',
    });
  },
};

