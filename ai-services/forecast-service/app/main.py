from fastapi import FastAPI
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.forecasts import router as forecast_router
from app.api.v1.routes.inventory import router as inventory_router
from app.core.config import settings

app = FastAPI(title="OptiWMS Forecast Service", version="0.1.0")
app.include_router(health_router)
app.include_router(forecast_router)
app.include_router(inventory_router)


@app.get("/")
def root() -> dict:
    return {
        "service": settings.service_name,
        "env": settings.ai_env,
        "docs": "/docs",
        "wms_api_base_url": settings.wms_api_base_url,
    }
