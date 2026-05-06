from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as slotting_router

app = FastAPI(
    title="OptiWMS - AI Slotting Service",
    description="Genetic Algorithm engine for warehouse slotting optimization",
    version="1.0.0"
)

# Configure CORS (Allows all for development, restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
