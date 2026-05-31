from fastapi import FastAPI

app = FastAPI(title="OptiWMS Slotting Service", version="0.1.0")


@app.get("/")
def root() -> dict:
    return {
        "service": "slotting-service",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/recommendations/slotting")
def recommend_slotting(payload: dict | None = None) -> dict:
    # Stub endpoint to keep integration contracts stable while slotting logic is implemented.
    return {
        "status": "not_implemented",
        "message": "slotting recommendation engine is scaffolded but not implemented yet",
        "input": payload or {},
    }
