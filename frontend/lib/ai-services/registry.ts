/**
 * AI Microservices Registry
 * 
 * This registry allows AI microservices to be plugged into the system
 * without modifying core WMS functionality. Services can be enabled/disabled
 * and will gracefully degrade if unavailable.
 */

export type AIServiceStatus = 'available' | 'unavailable' | 'degraded' | 'unknown';

export interface AIServiceConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: AIServiceStatus;
  endpoint?: string;
  version?: string;
}

export interface AIServiceRegistry {
  [serviceId: string]: AIServiceConfig;
}

/**
 * AI Service IDs matching the architecture document
 */
export const AI_SERVICES = {
  DEMAND_FORECASTING: 'demand-forecasting',
  MIN_MAX_INVENTORY: 'min-max-inventory',
  OPTIMAL_STORAGE: 'optimal-storage',
  OPTIMAL_PICKING_PATH: 'optimal-picking-path',
  ANOMALY_DETECTION: 'anomaly-detection',
  PROCUREMENT_AGENT: 'procurement-agent',
} as const;

export type AIServiceId = typeof AI_SERVICES[keyof typeof AI_SERVICES];

/**
 * Default AI services registry
 * Services are disabled by default until implemented
 */
export const defaultAIServices: AIServiceRegistry = {
  [AI_SERVICES.DEMAND_FORECASTING]: {
    id: AI_SERVICES.DEMAND_FORECASTING,
    name: 'Demand Forecasting',
    description: 'Predicts future demand based on historical data and trends',
    enabled: false,
    status: 'unknown',
  },
  [AI_SERVICES.MIN_MAX_INVENTORY]: {
    id: AI_SERVICES.MIN_MAX_INVENTORY,
    name: 'Optimal Min-Max Inventory',
    description: 'Suggests optimal minimum and maximum inventory levels',
    enabled: false,
    status: 'unknown',
  },
  [AI_SERVICES.OPTIMAL_STORAGE]: {
    id: AI_SERVICES.OPTIMAL_STORAGE,
    name: 'Optimal Storage Position',
    description: 'Suggests optimal storage locations for items',
    enabled: false,
    status: 'unknown',
  },
  [AI_SERVICES.OPTIMAL_PICKING_PATH]: {
    id: AI_SERVICES.OPTIMAL_PICKING_PATH,
    name: 'Optimal Picking Path',
    description: 'Suggests efficient picking paths for workers',
    enabled: false,
    status: 'unknown',
  },
  [AI_SERVICES.ANOMALY_DETECTION]: {
    id: AI_SERVICES.ANOMALY_DETECTION,
    name: 'Anomaly Detection',
    description: 'Detects anomalies in inventory, orders, and operations',
    enabled: false,
    status: 'unknown',
  },
  [AI_SERVICES.PROCUREMENT_AGENT]: {
    id: AI_SERVICES.PROCUREMENT_AGENT,
    name: 'AI Procurement Agent',
    description: 'Multi-system reasoning agent for procurement decisions',
    enabled: false,
    status: 'unknown',
  },
};

/**
 * Get AI service configuration
 */
export function getAIService(serviceId: AIServiceId): AIServiceConfig | undefined {
  return defaultAIServices[serviceId];
}

/**
 * Check if an AI service is available
 */
export function isAIServiceAvailable(serviceId: AIServiceId): boolean {
  const service = defaultAIServices[serviceId];
  return service?.enabled === true && service?.status === 'available';
}

/**
 * Get all enabled AI services
 */
export function getEnabledAIServices(): AIServiceConfig[] {
  return Object.values(defaultAIServices).filter(service => service.enabled);
}

/**
 * Role-based AI service access
 * Based on the AI microservices visibility document
 */
export const AI_SERVICE_ROLES: Record<string, AIServiceId[]> = {
  admin: [
    AI_SERVICES.DEMAND_FORECASTING,
    AI_SERVICES.MIN_MAX_INVENTORY,
    AI_SERVICES.OPTIMAL_STORAGE,
    AI_SERVICES.OPTIMAL_PICKING_PATH,
    AI_SERVICES.ANOMALY_DETECTION,
    AI_SERVICES.PROCUREMENT_AGENT,
  ],
  warehouse_manager: [
    AI_SERVICES.DEMAND_FORECASTING, // View-only
    AI_SERVICES.MIN_MAX_INVENTORY, // View-only
    AI_SERVICES.OPTIMAL_STORAGE, // Primary user
    AI_SERVICES.OPTIMAL_PICKING_PATH, // Primary user
    AI_SERVICES.ANOMALY_DETECTION, // Operational anomalies
  ],
  procurement_manager: [
    AI_SERVICES.DEMAND_FORECASTING, // Primary user
    AI_SERVICES.MIN_MAX_INVENTORY, // Primary user
    AI_SERVICES.ANOMALY_DETECTION, // Supplier anomalies
    AI_SERVICES.PROCUREMENT_AGENT, // Primary user
  ],
};

/**
 * Check if a role has access to an AI service
 */
export function hasAIServiceAccess(role: string | null | undefined, serviceId: AIServiceId): boolean {
  if (!role) return false;
  const roleServices = AI_SERVICE_ROLES[role] || [];
  return roleServices.includes(serviceId);
}

