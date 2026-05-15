export interface SlottingOptimizationRequest {
  warehouse_id: string;
  population_size: number;
  generations: number;
  mutation_rate: number;
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
  private static baseUrl = process.env.NEXT_PUBLIC_AI_SERVICES_URL?.trim()
    ? `${process.env.NEXT_PUBLIC_AI_SERVICES_URL.trim()}/slotting`
    : '/api/v1/slotting';

  static async optimizeSlotting(request: SlottingOptimizationRequest): Promise<SlottingOptimizationResponse> {
    const response = await fetch(`${this.baseUrl}/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to optimize slotting');
    }

    return response.json();
  }
}
