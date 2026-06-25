from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

class SlottingOptimizationRequest(BaseModel):
    warehouse_id: UUID = Field(..., description="The UUID of the warehouse to optimize")
    population_size: int = Field(20, ge=1, description="Size of the GA population")
    generations: int = Field(50, ge=1, description="Number of generations to evolve")
    mutation_rate: float = Field(0.05, ge=0.0, le=1.0, description="Probability of mutation")

class SlottingAssignmentResponse(BaseModel):
    material_id: str
    material_code: str
    location_id: str
    location_code: str

class SlottingOptimizationResponse(BaseModel):
    warehouse_id: str
    best_fitness: float
    assignments: List[SlottingAssignmentResponse]


class SlottingRecommendationItemRequest(BaseModel):
    material_id: UUID = Field(..., description="The UUID of the material to recommend a location for")
    quantity: int = Field(..., ge=1, description="Quantity to be stored")
    weight_kg: Optional[float] = Field(default=None, ge=0, description="Total carton weight in kilograms")
    volume_cm3: Optional[float] = Field(default=None, ge=0, description="Total carton volume in cubic centimeters")
    length_cm: Optional[float] = Field(default=None, ge=0, description="Carton length in centimeters")
    width_cm: Optional[float] = Field(default=None, ge=0, description="Carton width in centimeters")
    height_cm: Optional[float] = Field(default=None, ge=0, description="Carton height in centimeters")
    storage_type: Optional[str] = Field(default=None, description="Storage type: PALLET, DRUM, CARTON, BAG, IBC, ROLL, REEL")
    hazard_class: Optional[str] = None
    velocity: Optional[float] = Field(default=None, ge=0, description="Relative movement velocity or priority")
    forecast_p50: Optional[float] = Field(default=None, ge=0, description="Median forecast demand (p50)")
    forecast_volatility: Optional[float] = Field(default=None, ge=0, description="Demand volatility (p90-p10 spread)")
    abc_class: Optional[str] = Field(default=None, description="ABC classification: A, B, or C")
    fms_class: Optional[str] = Field(default=None, description="FMS classification: Fast, Medium, or Slow")
    preferred_zone: Optional[str] = None
    current_location_code: Optional[str] = None


class SlottingRecommendationRequest(BaseModel):
    warehouse_id: UUID = Field(..., description="The UUID of the warehouse to recommend locations for")
    items: List[SlottingRecommendationItemRequest] = Field(..., min_length=1)
    population_size: int = Field(20, ge=1, description="Size of the GA population")
    generations: int = Field(50, ge=1, description="Number of generations to evolve")
    mutation_rate: float = Field(0.05, ge=0.0, le=1.0, description="Probability of mutation")
    top_k_alternatives: int = Field(3, ge=1, le=10, description="Number of alternative locations to return")


class SlottingRecommendationAlternativeResponse(BaseModel):
    location_id: str
    location_code: str
    score: float


class SlottingRecommendationItemResponse(BaseModel):
    material_id: str
    material_code: str
    recommended_location_id: str
    recommended_location_code: str
    score: float
    reason: str
    alternatives: List[SlottingRecommendationAlternativeResponse]


class SlottingRecommendationResponse(BaseModel):
    warehouse_id: str
    algorithm: str
    best_fitness: float
    recommendations: List[SlottingRecommendationItemResponse]
