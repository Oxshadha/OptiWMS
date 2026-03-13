from fastapi import FastAPI

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.forecasts import router as forecast_router
from app.api.v1.routes.inventory import router as inventory_router
from app.api.v1.routes.metrics import router as metrics_router
from app.api.v1.routes.runs import router as runs_router
from app.core.config import settings
from app.db.database import Base, engine

app = FastAPI(title="OptiWMS Forecast Service", version="0.2.0")
app.include_router(health_router)
app.include_router(forecast_router)
app.include_router(inventory_router)
app.include_router(metrics_router)
app.include_router(runs_router)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root() -> dict:
    return {
        "service": settings.service_name,
        "env": settings.ai_env,
        "docs": "/docs",
        "wms_api_base_url": settings.wms_api_base_url,
    }
