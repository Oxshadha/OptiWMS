export interface SlottingOptimizationRequest {
  warehouse_id: string;
  population_size: number;
  generations: number;
  mutation_rate: number;
}

export interface SlottingRecommendationItemRequest {
  material_id: string;
  quantity: number;
  weight_kg?: number;
  volume_cm3?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  hazard_class?: string;
  velocity?: number;
  preferred_zone?: string;
  current_location_code?: string;
}

export interface SlottingRecommendationRequest {
  warehouse_id: string;
  items: SlottingRecommendationItemRequest[];
  population_size: number;
  generations: number;
  mutation_rate: number;
  top_k_alternatives?: number;
}

export interface SlottingRecommendationAlternative {
  location_id: string;
  location_code: string;
  score: number;
}

export interface SlottingRecommendationItemResponse {
  material_id: string;
  material_code: string;
  recommended_location_id: string;
  recommended_location_code: string;
  score: number;
  reason: string;
  alternatives: SlottingRecommendationAlternative[];
}

export interface SlottingRecommendationResponse {
  warehouse_id: string;
  algorithm: string;
  best_fitness: number;
  recommendations: SlottingRecommendationItemResponse[];
}

export interface SlottingAssignmentResponse {
  material_id: string;
  material_code: string;
  location_id: string;
  location_code: string;
}

export interface SlottingOptimizationResponse {
  warehouse_id: string;
  best_fitness: number;
  assignments: SlottingAssignmentResponse[];
}

export class AISlottingService {
  private static javaBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
    ? `${process.env.NEXT_PUBLIC_API_URL.trim()}/v1/slotting`
    : 'http://localhost:8080/api/v1/slotting';

  private static slottingServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICES_URL?.trim()
    ? `${process.env.NEXT_PUBLIC_AI_SERVICES_URL.trim()}/slotting`
    : null;

  static async optimizeSlotting(request: SlottingOptimizationRequest): Promise<SlottingOptimizationResponse> {
    const response = await fetch(`${this.javaBaseUrl}/ga/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warehouseId: request.warehouse_id,
        populationSize: request.population_size,
        generations: request.generations,
        mutationRate: request.mutation_rate,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.message || errorData.detail || 'Failed to optimize slotting';
      throw new Error(detail);
    }

    const data = await response.json();
    return {
      warehouse_id: data.warehouse_id ?? request.warehouse_id,
      best_fitness: data.best_fitness ?? 0,
      assignments: data.assignments ?? [],
    };
  }

  static async recommendPlacement(request: SlottingRecommendationRequest): Promise<SlottingRecommendationResponse> {
    const baseUrl = this.slottingServiceUrl;
    if (!baseUrl) {
      throw new Error('Slotting recommendation service URL not configured');
    }
    const response = await fetch(`${baseUrl}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to generate GA slotting recommendations');
    }

    return response.json();
  }
}
