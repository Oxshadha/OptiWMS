import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from endpoints import router as slotting_router
from fastapi import FastAPI
from your_ga_folder.endpoints import router as slotting_router

app = FastAPI()
app.include_router(slotting_router, prefix="/slotting", tags=["slotting"])

# Initialize the FastAPI application
app = FastAPI(title="OptiWMS AI Slotting Microservice")

# Configure CORS to allow your Next.js frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the endpoints with the /api/v1 prefix to match the frontend
app.include_router(slotting_router, prefix="/api/v1")

if __name__ == "__main__":
    print("═" * 40)
    print("  Starting OptiWMS AI Slotting API on port 8083...")
    print("═" * 40)
    # Run the server on port 8083
    uvicorn.run("app:app", host="0.0.0.0", port=8083, reload=True)