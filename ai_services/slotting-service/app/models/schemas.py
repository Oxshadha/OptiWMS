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
    material_id: UUID = Field(..., description="Material UUID to place")
    quantity: int = Field(1, ge=1, description="Quantity to place in the recommended location")
    weight_kg: Optional[float] = Field(None, ge=0, description="Per-unit weight in kilograms")
    volume_cm3: Optional[float] = Field(None, ge=0, description="Per-unit volume in cubic centimeters")
    length_cm: Optional[float] = Field(None, ge=0, description="Per-unit length in centimeters")
    width_cm: Optional[float] = Field(None, ge=0, description="Per-unit width in centimeters")
    height_cm: Optional[float] = Field(None, ge=0, description="Per-unit height in centimeters")
    hazard_class: Optional[str] = Field(None, description="Hazard class label used by the slotting model")
    velocity: Optional[float] = Field(None, ge=0, description="Relative movement frequency / velocity score")
    preferred_zone: Optional[str] = Field(None, description="Preferred warehouse zone or storage condition")
    current_location_code: Optional[str] = Field(None, description="Currently selected warehouse location code")


class SlottingRecommendationRequest(BaseModel):
    warehouse_id: UUID = Field(..., description="Warehouse to optimize")
    items: List[SlottingRecommendationItemRequest] = Field(..., min_length=1)
    population_size: int = Field(20, ge=1, description="GA population size")
    generations: int = Field(50, ge=1, description="GA generations")
    mutation_rate: float = Field(0.05, ge=0.0, le=1.0, description="GA mutation rate")
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
