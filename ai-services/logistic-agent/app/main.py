"""
Logistic Agent - Central Data Hub & Coordinator
Connects all microservices and coordinates data flow
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from app.api import orders_routes, warehouse_routes, analytics_routes, sync_routes

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
    logger.info("🚀 Starting Logistic Agent...")
    logger.info("✅ Logistic Agent started successfully")
    logger.info("📊 Connected Services:")
    logger.info("  - Path Optimization (8081)")
    logger.info("  - Forecast Service (8082)")
    logger.info("  - Slotting Service (8083)")
    logger.info("  - Orchestrator Service (8084)")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Logistic Agent...")
    logger.info("✅ Logistic Agent stopped")

# Create FastAPI app
app = FastAPI(
    title="Logistic Agent",
    description="Central data hub coordinating all warehouse operations",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
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
app.include_router(orders_routes.router, prefix="/api/orders", tags=["Orders"])
app.include_router(warehouse_routes.router, prefix="/api/warehouse", tags=["Warehouse"])
app.include_router(analytics_routes.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(sync_routes.router, prefix="/api/sync", tags=["Sync"])

# Root endpoint
@app.get("/")
async def root():
    """Service information"""
    return {
        "service": "logistic-agent",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "documentation": "/docs",
        "connected_services": {
            "path_optimization": "http://localhost:8081",
            "forecast": "http://localhost:8082",
            "slotting": "http://localhost:8083",
            "orchestrator": "http://localhost:8084"
        },
        "purpose": "Central data hub coordinating all warehouse operations"
    }

@app.get("/health")
async def health_check():
    """Service health status"""
    return {
        "status": "healthy",
        "service": "logistic-agent",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
        log_level="info"
    )
