"""
app/main.py — FastAPI entry point for the OptiWMS Slotting Service.

The Dockerfile runs:
    uvicorn app.main:app --host 0.0.0.0 --port ${SERVICE_PORT:-8093}

This module:
  - Creates the FastAPI application instance
  - Configures CORS so the Next.js frontend (localhost:3000) can call the API
  - Mounts the slotting router from app/api/endpoints.py under /slotting
  - Exposes a /health endpoint at the root level (used by the docker healthcheck)
"""

import os
import sys

# ── Make sure app/api/ is on the Python path so ga_components, fitness, etc.
#    can be imported directly (they use bare imports like `from config import ...`)
_API_DIR = os.path.join(os.path.dirname(__file__), "api")
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import router as slotting_router  # noqa: E402

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="OptiWMS AI Slotting Service",
    description=(
        "Genetic-algorithm-powered warehouse slot optimisation. "
        "Exposes /slotting/recommend and /slotting/optimize endpoints."
    ),
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS — allow the Next.js frontend and any local dev tooling to talk to us
# ---------------------------------------------------------------------------

_CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:8080",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(slotting_router, prefix="/slotting", tags=["slotting"])

# ---------------------------------------------------------------------------
# Root-level health — matched by the docker-compose healthcheck:
#   curl http://127.0.0.1:8093/health
# ---------------------------------------------------------------------------


@app.get("/health", tags=["health"])
def root_health():
    return {
        "status": "ok",
        "service": "slotting-service",
        "port": int(os.getenv("SERVICE_PORT", "8093")),
        "timestamp": datetime.utcnow().isoformat(),
    }
