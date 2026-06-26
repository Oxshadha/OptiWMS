import httpx
from typing import List, Dict, Any
from app.core.config import settings

class StorageOptimizer:
    """
    Handles cross-SKU space reallocation and dynamic re-slotting triggers 
    based on 6-month forecast shifts.
    """
    
    def __init__(self, db_session=None):
        self.db = db_session
        self.slotting_service_url = settings.slotting_service_url
        
    def check_reslotting_trigger(self, current_cov: float, previous_cov: float) -> bool:
        """
        Trigger re-slotting if the 6-month forecast Coefficient of Variation 
        changes by more than the configured threshold (e.g., 20%).
        """
        if previous_cov == 0:
            return current_cov > settings.reslotting_cov_threshold
            
        change = abs(current_cov - previous_cov) / previous_cov
        return change >= settings.reslotting_cov_threshold

    async def calculate_reallocation_savings(self, sku: str, freed_volume: float, high_demand_sku: str) -> float:
        """
        Estimates the financial savings of reallocating space from a low-demand SKU
        to a high-demand SKU, considering forklift relocation costs.
        """
        # Simplified simulation of space value
        # Space value could be tied to holding cost or penalty avoidance
        space_value_per_volume = 10.0 # Arbitrary value per volume unit
        gross_savings = freed_volume * space_value_per_volume
        
        # Deduct forklift moves (e.g., 1 move to empty, 1 move to fill)
        moves_required = 2 
        net_savings = gross_savings - (moves_required * settings.forklift_cost_per_move)
        
        return max(0.0, net_savings)

    async def trigger_slotting_optimization(self, parcel_data: Dict[str, Any]):
        """
        Sends the updated parcel data (with forecast velocity and relocation flag)
        to the slotting-service GA to find a new optimal bin.
        """
        async with httpx.AsyncClient() as client:
            try:
                # Assuming the slotting service exposes an endpoint for optimization
                response = await client.post(
                    f"{self.slotting_service_url}/api/v1/slotting/optimize", 
                    json=parcel_data
                )
                if response.status_code == 200:
                    return response.json()
            except Exception as e:
                print(f"Failed to trigger slotting optimization: {e}")
        return None
