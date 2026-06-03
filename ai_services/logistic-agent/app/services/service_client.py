"""
Service client for communicating with microservices
"""
import httpx
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

class ServiceClient:
    """Client for communicating with all microservices"""
    
    def __init__(self):
        self.timeout = 30
        self.services = {
            "pathfinding": "http://localhost:8081",
            "forecast": "http://localhost:8082",
            "slotting": "http://localhost:8083",
            "orchestrator": "http://localhost:8084"
        }
    
    async def get_pathfinding_route(self, start: str, end: str, warehouse_config: Optional[Dict] = None) -> Dict[str, Any]:
        """Get optimized path from pathfinding service"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "start": start,
                    "end": end,
                    "warehouse_config": warehouse_config
                }
                response = await client.post(
                    f"{self.services['pathfinding']}/api/pathfinding/optimize",
                    json=payload
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error getting path: {str(e)}")
            return {"path_found": False, "error": str(e)}
    
    async def get_warehouse_layout(self, warehouse_id: Optional[str] = None) -> Dict[str, Any]:
        """Get warehouse layout"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.services['pathfinding']}/api/pathfinding/sample-warehouse"
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error getting warehouse: {str(e)}")
            return {"error": str(e)}
    
    async def get_forecast(self, order_id: str) -> Dict[str, Any]:
        """Get forecast from forecast service"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.services['forecast']}/forecast/{order_id}"
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error getting forecast: {str(e)}")
            return {"error": str(e)}
    
    async def get_slotting_plan(self, order_id: str) -> Dict[str, Any]:
        """Get slotting plan from slotting service"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.services['slotting']}/slotting/{order_id}"
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error getting slotting plan: {str(e)}")
            return {"error": str(e)}
    
    async def orchestrate_order(self, order_id: str, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Orchestrate complete order workflow"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.services['orchestrator']}/orchestrate",
                    json={"order_id": order_id, "data": order_data}
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error orchestrating: {str(e)}")
            return {"error": str(e)}

# Global client instance
service_client = ServiceClient()
