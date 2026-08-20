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
    description="Constraint-based multi-location warehouse slotting optimization",
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
    return {
        "status": "ok",
        "service": "slotting-service",
        "role": "advanced slotting solver",
        "manager_surface": "Slotting Planner",
        "capabilities": [
            "ortools_milp_multi_location_assignment",
            "pick_face_and_reserve_allocation",
            "capacity_weight_volume_and_compatibility_constraints",
            "forecast_abc_fms_accessibility_objective",
            "manager_approval_before_stock_transfer",
        ],
    }

@app.get("/api/v1/slotting/capabilities")
def solver_capabilities():
    return {
        "service": "slotting-service",
        "default_manager_flow": "Java WMS Slotting Planner creates auditable draft location plans.",
        "inbound_orders": "Use fast deterministic capacity feasibility checks; do not run GA/MILP per inbound order.",
        "periodic_restructure": "Use OR-Tools MILP with integer handling-unit allocation across pick faces and reserves.",
        "advanced_solver_lab": "GA is available for admin experimentation and comparison, not routine approval workflow.",
        "algorithms": [
            {"name": "deterministic_capacity_check", "use": "inbound order feasibility"},
            {"name": "forecast_space_heuristic", "use": "forecast to min/max and pallet impact"},
            {"name": "ortools_milp_v2", "use": "manager-triggered constrained multi-location slotting plan"},
            {"name": "deap_ga", "use": "advanced solver lab and research comparison"},
        ],
    }

@app.post("/recommendations/slotting", deprecated=True)
def recommend_slotting(payload: dict | None = None) -> dict:
    return {
        "status": "deprecated",
        "message": "Use POST /api/v1/slotting/plan/optimize for auditable OR-Tools MILP plans.",
        "input": payload or {},
    }
