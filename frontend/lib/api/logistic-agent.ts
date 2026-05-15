// Logistic Agent API Client
const LOGISTIC_AGENT_URL = 'http://localhost:3001';

export interface OrderItem {
  sku: string;
  qty: number;
}

export interface Order {
  order_id: string;
  customer_id: string;
  items: OrderItem[];
  warehouse_id: string;
}

export interface PathData {
  start: string;
  end: string;
  steps: string[];
  total_distance: number;
  estimated_time: number;
}

export interface OrderResult {
  order_id: string;
  status: string;
  path?: PathData;
  forecast?: Record<string, unknown>;
  slotting?: Record<string, unknown>;
}

export interface DashboardMetrics {
  orders_processed: number;
  avg_route_time: number;
  forecast_accuracy: number;
  efficiency_score: number;
  warehouse_utilization: number;
  timestamp: string;
}

export interface PerformanceMetrics {
  path_optimization_avg_time: number;
  forecast_avg_time: number;
  slotting_avg_time: number;
  orchestrator_avg_time: number;
  total_requests: number;
}

export interface ServiceHealth {
  service: string;
  status: string;
  port: number;
  last_check: string;
  response_time_ms: number;
}

export interface HealthCheckResponse {
  logistic_agent_status: string;
  timestamp: string;
  services: ServiceHealth[];
}

export interface WarehouseLayout {
  warehouse_id: string;
  nodes: Array<{
    id: string;
    x: number;
    y: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    distance: number;
  }>;
}

class LogisticAgentClient {
  private baseUrl: string = LOGISTIC_AGENT_URL;
  private timeout: number = 15000; // 15 seconds

  async fetchWithTimeout(url: string, options: RequestInit = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        mode: 'cors',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`Request timeout after ${this.timeout}ms to ${url}`);
          throw new Error(`Request timeout. Logistic Agent at ${this.baseUrl} is not responding.`);
        }
        console.error(`Fetch error for ${url}:`, error.message);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Process complete order through all services
  async processOrder(order: Order): Promise<OrderResult> {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/orders/process`,
        {
          method: 'POST',
          body: JSON.stringify(order),
        }
      );
    } catch (error) {
      console.error('Error processing order:', error);
      throw error;
    }
  }

  // Get aggregated order data
  async aggregateOrder(orderId: string): Promise<OrderResult> {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/orders/aggregate?order_id=${orderId}`
      );
    } catch (error) {
      console.error('Error aggregating order:', error);
      throw error;
    }
  }

  // Get warehouse layout
  async getWarehouseLayout(): Promise<WarehouseLayout> {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/warehouse/layout`
      );
    } catch (error) {
      console.error('Error getting warehouse layout:', error);
      throw error;
    }
  }

  // Get warehouse information
  async getWarehouseInfo() {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/warehouse/info`
      );
    } catch (error) {
      console.error('Error getting warehouse info:', error);
      throw error;
    }
  }

  // Sync warehouse data
  async syncWarehouse(warehouseId: string) {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/warehouse/sync`,
        {
          method: 'POST',
          body: JSON.stringify({ warehouse_id: warehouseId }),
        }
      );
    } catch (error) {
      console.error('Error syncing warehouse:', error);
      throw error;
    }
  }

  // Get dashboard metrics
  async getDashboard(): Promise<DashboardMetrics> {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/analytics/dashboard`
      );
    } catch (error) {
      console.error('Error getting dashboard:', error);
      throw error;
    }
  }

  // Get performance metrics
  async getPerformance(): Promise<PerformanceMetrics> {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/analytics/performance`
      );
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  // Get health status of all services
  async getHealthCheck(): Promise<HealthCheckResponse> {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/analytics/health-check`
      );
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  }

  // Health check
  async health() {
    try {
      return await this.fetchWithTimeout(`${this.baseUrl}/health`);
    } catch (error) {
      console.error('Error checking logistic agent health:', error);
      throw error;
    }
  }

  // Sync data between services
  async syncData(
    sourceService: string,
    targetService: string,
    data: Record<string, unknown>
  ) {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/sync/data`,
        {
          method: 'POST',
          body: JSON.stringify({
            source_service: sourceService,
            target_service: targetService,
            data,
          }),
        }
      );
    } catch (error) {
      console.error('Error syncing data:', error);
      throw error;
    }
  }

  // Broadcast warehouse data to all services
  async broadcastWarehouse(warehouseData: Record<string, unknown>) {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/sync/warehouse-to-all`,
        {
          method: 'POST',
          body: JSON.stringify(warehouseData),
        }
      );
    } catch (error) {
      console.error('Error broadcasting warehouse:', error);
      throw error;
    }
  }

  // Broadcast orders data to all services
  async broadcastOrders(ordersData: Record<string, unknown>) {
    try {
      return await this.fetchWithTimeout(
        `${this.baseUrl}/api/sync/orders-to-all`,
        {
          method: 'POST',
          body: JSON.stringify(ordersData),
        }
      );
    } catch (error) {
      console.error('Error broadcasting orders:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const logisticAgentApi = new LogisticAgentClient();
