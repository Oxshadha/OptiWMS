/**
 * aiSlottingService.ts
 * Calls the FastAPI /slotting/recommend endpoint (backed by endpoints.py / main.py GA).
 */

const SLOTTING_BASE_URL =
  process.env.NEXT_PUBLIC_SLOTTING_API_URL ?? "http://localhost:8000";

// ── Request types (mirror SlottingRecommendationRequest in endpoints.py) ──────

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
  population_size?: number;   // default 50
  generations?: number;       // default 100
  mutation_rate?: number;     // default 0.2
  top_k_alternatives?: number; // default 3
}

// ── Response types (mirror SlottingRecommendationResponse in endpoints.py) ────

export interface SlottingRecommendationAlternativeResponse {
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
  alternatives: SlottingRecommendationAlternativeResponse[];
}

export interface SlottingRecommendationResponse {
  warehouse_id: string;
  algorithm: string;
  best_fitness: number;
  recommendations: SlottingRecommendationItemResponse[];
}

// ── Service ───────────────────────────────────────────────────────────────────

export const AISlottingService = {
  /**
   * Ask the GA engine to recommend warehouse bin locations for a set of items.
   * Called automatically on Step 5 of CreateInboundOrderModal.
   */
  async recommendPlacement(
    request: SlottingRecommendationRequest
  ): Promise<SlottingRecommendationResponse> {
    const url = `${SLOTTING_BASE_URL}/slotting/recommend`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`Slotting API error ${res.status}: ${detail}`);
    }

    return res.json() as Promise<SlottingRecommendationResponse>;
  },

  /** Health-check — useful for an admin ping or startup check. */
  async healthCheck(): Promise<{ status: string }> {
    const res = await fetch(`${SLOTTING_BASE_URL}/slotting/health`);
    if (!res.ok) throw new Error("Slotting service is unreachable");
    return res.json();
  },
};