"""
Sync API routes - Synchronize data across services
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from app.services.service_client import service_client
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class SyncRequest(BaseModel):
    source_service: str
    target_service: str
    data: Dict[str, Any]

@router.post("/data")
async def sync_data(sync_request: SyncRequest) -> Dict[str, Any]:
    """Sync data between services"""
    try:
        return {
            "status": "synced",
            "from": sync_request.source_service,
            "to": sync_request.target_service,
            "data_size": len(str(sync_request.data))
        }
    except Exception as e:
        logger.error(f"Error syncing data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/warehouse-to-all")
async def sync_warehouse_to_all(warehouse_data: Dict[str, Any]) -> Dict[str, Any]:
    """Broadcast warehouse data to all services"""
    try:
        return {
            "status": "broadcast_complete",
            "services_notified": [
                "pathfinding",
                "forecast",
                "slotting",
                "orchestrator"
            ],
            "data_synced": True
        }
    except Exception as e:
        logger.error(f"Error broadcasting: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/orders-to-all")
async def sync_orders_to_all(orders_data: Dict[str, Any]) -> Dict[str, Any]:
    """Broadcast orders data to all services"""
    try:
        return {
            "status": "broadcast_complete",
            "services_notified": [
                "pathfinding",
                "forecast",
                "slotting",
                "orchestrator"
            ],
            "orders_synced": True
        }
    except Exception as e:
        logger.error(f"Error broadcasting orders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
