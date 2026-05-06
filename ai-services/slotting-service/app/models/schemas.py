from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

class SlottingOptimizationRequest(BaseModel):
    warehouse_id: str = Field(..., description="The UUID of the warehouse to optimize")
    population_size: int = Field(20, description="Size of the GA population")
    generations: int = Field(50, description="Number of generations to evolve")
    mutation_rate: float = Field(0.05, description="Probability of mutation")

class SlottingAssignmentResponse(BaseModel):
    material_id: str
    material_code: str
    location_id: str
    location_code: str

class SlottingOptimizationResponse(BaseModel):
    warehouse_id: str
    best_fitness: float
    assignments: List[SlottingAssignmentResponse]
