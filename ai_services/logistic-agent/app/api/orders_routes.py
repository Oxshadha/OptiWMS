"""
Orders API routes - Coordinate order data with all services
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services.service_client import service_client
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class Order(BaseModel):
    order_id: str
    customer_id: str
    items: List[dict]
    warehouse_id: Optional[str] = None

class OrderResult(BaseModel):
    order_id: str
    path: Optional[dict] = None
    forecast: Optional[dict] = None
    slotting: Optional[dict] = None
    status: str

@router.post("/process")
async def process_order(order: Order) -> OrderResult:
    """
    Process complete order workflow
    1. Get pathfinding route
    2. Get forecast for items
    3. Get slotting plan
    4. Orchestrate workflow
    """
    try:
        # Get warehouse layout
        warehouse = await service_client.get_warehouse_layout(order.warehouse_id)
        
        # Get pathfinding route
        path = await service_client.get_pathfinding_route("ENTRY", "EXIT", warehouse)
        
        # Get forecast for order
        forecast = await service_client.get_forecast(order.order_id)
        
        # Get slotting plan
        slotting = await service_client.get_slotting_plan(order.order_id)
        
        # Orchestrate complete workflow
        order_data = {
            "order": order.dict(),
            "path": path,
            "forecast": forecast,
            "slotting": slotting
        }
        orchestration = await service_client.orchestrate_order(order.order_id, order_data)
        
        return OrderResult(
            order_id=order.order_id,
            path=path,
            forecast=forecast,
            slotting=slotting,
            status="processed"
        )
    
    except Exception as e:
        logger.error(f"Error processing order {order.order_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/aggregate")
async def aggregate_order_data(order_id: str):
    """
    Aggregate all data for a specific order from all services
    """
    try:
        data = {
            "order_id": order_id,
            "path": await service_client.get_pathfinding_route("ENTRY", "EXIT"),
            "forecast": await service_client.get_forecast(order_id),
            "slotting": await service_client.get_slotting_plan(order_id),
            "timestamp": None
        }
        from datetime import datetime
        data["timestamp"] = datetime.utcnow().isoformat()
        return data
    except Exception as e:
        logger.error(f"Error aggregating data for {order_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
