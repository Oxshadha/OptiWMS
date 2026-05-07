import os
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as slotting_router


def _get_allowed_origins():
    configured_origins = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost,http://localhost:3000")
    return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]


def _get_allow_credentials():
    return os.getenv("CORS_ALLOW_CREDENTIALS", "false").strip().lower() == "true"


app = FastAPI(
    title="OptiWMS - AI Slotting Service",
    description="Genetic Algorithm engine for warehouse slotting optimization",
    version="1.0.0"
)

# Configure CORS using an explicit allowlist from environment/config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=_get_allow_credentials(),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(slotting_router, prefix="/api/v1/slotting", tags=["Slotting Optimization"])

@app.get("/", include_in_schema=False)
def root():
    # Redirect root visits directly to the Swagger UI docs
    return RedirectResponse(url="/docs")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "slotting-service"}
