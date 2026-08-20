import httpx
from app.core.config import settings

class WmsClient:
    def __init__(self):
        self.base_url = settings.wms_backend_url
        
    async def get_supplier_constraints(self, sku: str):
        """Fetch all supplier constraints for a specific material code"""
        # Note: In a real implementation this would fetch from /api/v1/materials/by-code/{sku} 
        # to get the materialId, then /api/v1/suppliers/constraints/material/{materialId}
        # For simplicity in this engine, we mock the fetch structure.
        async with httpx.AsyncClient() as client:
            try:
                # Assuming there's a joined endpoint or we build it
                response = await client.get(f"{self.base_url}/api/v1/suppliers/constraints/material/{sku}")
                if response.status_code == 200:
                    return response.json()
            except Exception as e:
                print(f"Failed to fetch constraints for {sku}: {e}")
        return []
