from fastapi import Depends, FastAPI

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.forecasts import router as forecast_router
from app.api.v1.routes.inventory import router as inventory_router
from app.api.v1.routes.metrics import router as metrics_router
from app.api.v1.routes.runs import router as runs_router
from app.api.v1.routes.artifacts import router as artifacts_router
from app.api.v1.routes.model_registry import router as model_registry_router
from app.api.v1.routes.dashboard import router as dashboard_router
from app.api.v1.routes.raw_materials import router as raw_materials_router
from app.api.v1.routes.gateway import router as gateway_router
from app.core.config import settings
from app.core.security import verify_service_auth
from app.db.database import Base, engine
from app.services.health_monitor_service import OperationalHealthWorker
from app.services.governance_service import governance_worker
from app.services.run_publish_service import PublishQueueWorker
from app.services.runtime_contract_service import assert_runtime_contract_on_startup

app = FastAPI(title="OptiWMS Forecast Service", version="0.2.0")
app.include_router(health_router)
app.include_router(forecast_router, dependencies=[Depends(verify_service_auth)])
app.include_router(inventory_router, dependencies=[Depends(verify_service_auth)])
app.include_router(metrics_router, dependencies=[Depends(verify_service_auth)])
app.include_router(runs_router, dependencies=[Depends(verify_service_auth)])
app.include_router(artifacts_router, dependencies=[Depends(verify_service_auth)])
app.include_router(model_registry_router, dependencies=[Depends(verify_service_auth)])
app.include_router(dashboard_router, dependencies=[Depends(verify_service_auth)])
app.include_router(raw_materials_router, dependencies=[Depends(verify_service_auth)])
app.include_router(gateway_router, dependencies=[Depends(verify_service_auth)])
publish_queue_worker = PublishQueueWorker()
operational_health_worker = OperationalHealthWorker()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    assert_runtime_contract_on_startup()
    publish_queue_worker.start()
    operational_health_worker.start()
    governance_worker.start()


@app.on_event("shutdown")
def on_shutdown() -> None:
    publish_queue_worker.stop()
    operational_health_worker.stop()
    governance_worker.stop()


@app.get("/")
def root() -> dict:
    return {
        "service": settings.service_name,
        "env": settings.ai_env,
        "docs": "/docs",
        "wms_api_base_url": settings.wms_api_base_url,
    }
