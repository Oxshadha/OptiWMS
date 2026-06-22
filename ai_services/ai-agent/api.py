import os
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agent import load_agent, ask
from explain_router import router as explain_router

app = FastAPI(title="OptiWMS Agent API")
chain = load_agent()

allowed_origins = os.getenv(
    "AI_AGENT_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(explain_router)

# ── Static file serving for generated PDF reports ────────────────────────────
REPORTS_DIR = Path(__file__).parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)
app.mount("/reports", StaticFiles(directory=str(REPORTS_DIR)), name="reports")


# ── Pydantic models ───────────────────────────────────────────────────────────
class QuestionRequest(BaseModel):
    message: Optional[str] = None
    question: Optional[str] = None
    context: Optional[str] = None
    timestamp: Optional[str] = None

class DataResponse(BaseModel):
    mode: Optional[str] = None
    sql: Optional[str] = None
    data: Optional[List[dict]] = None
    chart: Optional[str] = None
    error: Optional[str] = None
    answer: Optional[str] = None       # Conversational summary, download link, or SOP answer
    download_url: Optional[str] = None  # Set in Report mode
    sources: Optional[List[str]] = None  # SOP sources


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ── Unified AI assistant (SOP RAG + WMS database query + report) ──────────────
@app.post("/ask", response_model=DataResponse)
def ask_question(request: QuestionRequest):
    question = (request.message or request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A message is required.")
    
    try:
        res = ask(chain, question)
        return DataResponse(
            mode=res.get("mode"),
            sql=res.get("sql"),
            data=res.get("data"),
            chart=res.get("chart"),
            error=res.get("error"),
            answer=res.get("answer"),
            download_url=res.get("download_url"),
            sources=res.get("sources"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── PDF download endpoint ─────────────────────────────────────────────────────
@app.get("/download/{filename}")
def download_report(filename: str):
    """Serve a generated PDF report for download."""
    # Sanitise: only allow filenames, no path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = REPORTS_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Report file not found.")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
