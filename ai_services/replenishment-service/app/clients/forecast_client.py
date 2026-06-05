import httpx
from app.core.config import settings

class ForecastClient:
    def __init__(self):
        self.base_url = settings.forecast_service_url
        
    async def get_latest_forecast(self, sku: str, horizon: int = 6):
        """Fetch forecasted demand from the forecast-service"""
        async with httpx.AsyncClient() as client:
            try:
                payload = {
                    "series_id": sku,
                    "horizon": horizon
                }
                # Example standard request based on FORECAST_GATEWAY_API_GUIDE
                response = await client.post(f"{self.base_url}/api/v1/forecast/predict", json=payload)
                if response.status_code == 200:
                    return response.json()
            except Exception as e:
                print(f"Failed to fetch forecast for {sku}: {e}")
        return None
