"""
Warehouse API routes - Manage warehouse data
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
from app.services.service_client import service_client
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/layout")
async def get_warehouse_layout(warehouse_id: Optional[str] = None) -> Dict[str, Any]:
    """Get warehouse layout from pathfinding service"""
    try:
        layout = await service_client.get_warehouse_layout(warehouse_id)
        return {
            "warehouse_id": warehouse_id or "default",
            "layout": layout,
            "status": "retrieved"
        }
    except Exception as e:
        logger.error(f"Error getting warehouse layout: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/info")
async def get_warehouse_info(warehouse_id: Optional[str] = None) -> Dict[str, Any]:
    """Get comprehensive warehouse information"""
    try:
        layout = await service_client.get_warehouse_layout(warehouse_id)
        return {
            "warehouse_id": warehouse_id or "default",
            "nodes": len(layout.get("nodes", [])),
            "edges": len(layout.get("edges", [])),
            "layout_type": layout.get("layout_type", "unknown"),
            "full_data": layout
        }
    except Exception as e:
        logger.error(f"Error getting warehouse info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def sync_warehouse_data(warehouse_id: Optional[str] = None) -> Dict[str, Any]:
    """Sync warehouse data across all services"""
    try:
        warehouse = await service_client.get_warehouse_layout(warehouse_id)
        return {
            "warehouse_id": warehouse_id or "default",
            "status": "synced",
            "data": warehouse
        }
    except Exception as e:
        logger.error(f"Error syncing warehouse: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
