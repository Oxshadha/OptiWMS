"""Health check endpoints"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/")
async def health_check():
    """Service health status"""
    return {
        "status": "healthy",
        "service": "path-optimization-service",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/readiness")
async def readiness_check():
    """Kubernetes readiness probe"""
    return {"status": "ready"}

@router.get("/liveness")
async def liveness_check():
    """Kubernetes liveness probe"""
    return {"status": "alive"}
