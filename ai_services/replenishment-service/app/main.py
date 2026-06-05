from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "replenishment-service"}

# Include routers
from app.api.v1.routes import plans

app.include_router(plans.router, prefix="/api/v1/replenishment", tags=["replenishment"])

