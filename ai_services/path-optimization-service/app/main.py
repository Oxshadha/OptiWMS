"""
A* Pathfinding Service for Warehouse Picking and Putaway
Provides optimal route suggestions for warehouse workers
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from app.api import pathfinding_routes
from app.api import health_routes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("🚀 Starting Path Optimization Service...")
    logger.info("✅ Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Path Optimization Service...")
    logger.info("✅ Service stopped")

# Create FastAPI app
app = FastAPI(
    title="Path Optimization Service",
    description="A* pathfinding for warehouse operations",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_routes.router, prefix="/health", tags=["Health"])
app.include_router(pathfinding_routes.router, prefix="/api/pathfinding", tags=["Pathfinding"])

# Root endpoint
@app.get("/")
async def root():
    """Service information"""
    return {
        "service": "path-optimization-service",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "documentation": "/api/docs",
        "endpoints": {
            "health": "/health/ready",
            "pathfinding": "/api/pathfinding/optimize"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8081,
        reload=True,
        log_level="info"
    )