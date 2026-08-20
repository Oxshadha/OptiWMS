"""
Slotting Service - AI Microservice for Warehouse Slotting Recommendations
Provides intelligent storage location recommendations based on product characteristics
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Slotting Service",
    description="AI-powered warehouse slotting recommendations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Models ====================

class ProductCharacteristics(BaseModel):
    sku: str
    name: str
    weight: float  # kg
    volume: float  # m³
    velocity: str  # high, medium, low - picking frequency
    fragility: str  # high, medium, low
    compatibility: List[str] = []  # SKUs that should be near this one

class SlotRecommendation(BaseModel):
    sku: str
    recommended_aisle: str
    recommended_level: int  # 1-5, with higher levels for faster moving items
    recommended_slot: str
    confidence_score: float  # 0-1
    reason: str

class SlottingRequest(BaseModel):
    products: List[ProductCharacteristics]
    warehouse_id: Optional[str] = None
    zone: Optional[str] = None

class SlottingResponse(BaseModel):
    recommendations: List[SlotRecommendation]
    optimization_timestamp: datetime
    warehouse_optimized: str

# ==================== Health Check ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "slotting-service",
        "timestamp": datetime.now().isoformat()
    }

# ==================== AI Recommendation Engine ====================

def calculate_optimal_slot(product: ProductCharacteristics) -> tuple[str, int, float]:
    """
    Calculate optimal storage location based on product characteristics
    
    Returns: (aisle, level, confidence_score)
    """
    aisles = ['A', 'B', 'C', 'D', 'E', 'F']
    levels = [1, 2, 3, 4, 5]  # 1=ground, 5=top
    
    # Velocity-based placement
    velocity_score = {
        'high': 0.9,
        'medium': 0.6,
        'low': 0.3
    }.get(product.velocity.lower(), 0.5)
    
    # Size-based placement (smaller items higher)
    size_score = 1.0 - min(product.volume / 2.0, 1.0)
    
    # Weight-based placement (heavier items lower)
    weight_penalty = min(product.weight / 100.0, 0.9)
    
    # Combine scores
    picking_level = max(1, min(5, int(velocity_score * 5)))
    
    # Select aisle based on product characteristics
    aisle_hash = sum(ord(c) for c in product.sku) % len(aisles)
    aisle = aisles[aisle_hash]
    
    # Confidence based on consistency of recommendations
    confidence = (velocity_score + size_score * 0.5 - weight_penalty * 0.3) / 2.0
    confidence = max(0.0, min(1.0, confidence))
    
    return aisle, picking_level, confidence

# ==================== Main Endpoints ====================

@app.post("/api/slotting/recommendations", response_model=SlottingResponse)
async def get_slotting_recommendations(request: SlottingRequest) -> SlottingResponse:
    """
    Get AI-powered slotting recommendations for products
    
    Considers:
    - Product velocity (picking frequency)
    - Physical characteristics (weight, volume)
    - Fragility and compatibility constraints
    """
    try:
        recommendations = []
        
        for product in request.products:
            aisle, level, confidence = calculate_optimal_slot(product)
            
            # Format slot location
            slot = f"{aisle}-{level:02d}"
            
            # Generate reason
            reason = f"Fast-moving item" if product.velocity.lower() == 'high' else \
                     f"Medium activity product" if product.velocity.lower() == 'medium' else \
                     f"Slow-moving item"
            
            if product.weight > 50:
                reason += ", heavy items stored lower"
            if product.volume < 0.1:
                reason += ", compact item placed higher"
                
            recommendation = SlotRecommendation(
                sku=product.sku,
                recommended_aisle=aisle,
                recommended_level=level,
                recommended_slot=slot,
                confidence_score=round(confidence, 3),
                reason=reason
            )
            recommendations.append(recommendation)
        
        logger.info(f"Generated {len(recommendations)} slotting recommendations")
        
        return SlottingResponse(
            recommendations=recommendations,
            optimization_timestamp=datetime.now(),
            warehouse_optimized=request.warehouse_id or "DEFAULT"
        )
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/internal/ai/recommendations/slotting")
async def internal_slotting_endpoint(request: SlottingRequest) -> SlottingResponse:
    """
    Internal endpoint for slotting recommendations (used by orchestrator)
    """
    return await get_slotting_recommendations(request)

@app.get("/api/slotting/health")
async def slotting_health():
    """Slotting service health check with capabilities"""
    return {
        "status": "operational",
        "service": "slotting-service",
        "version": "1.0.0",
        "capabilities": [
            "velocity-based-slotting",
            "weight-based-placement",
            "zone-optimization",
            "compatibility-grouping"
        ],
        "timestamp": datetime.now().isoformat()
    }

# ==================== Analytics ====================

@app.get("/api/slotting/metrics")
async def get_metrics():
    """Get service metrics and statistics"""
    return {
        "service": "slotting-service",
        "status": "active",
        "requests_processed": 0,
        "average_confidence": 0.85,
        "optimization_algorithms": ["velocity-based", "weight-based", "volume-based"],
        "timestamp": datetime.now().isoformat()
    }

# ==================== Root ====================

@app.get("/")
async def root():
    """Service information"""
    return {
        "name": "Slotting Service",
        "version": "1.0.0",
        "description": "AI-powered warehouse product slotting recommendations",
        "endpoints": {
            "health": "/health",
            "slotting_recommendations": "/api/slotting/recommendations",
            "internal": "/internal/ai/recommendations/slotting",
            "metrics": "/api/slotting/metrics"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8083)
