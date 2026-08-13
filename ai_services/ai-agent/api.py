import os
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agent import load_agent, ask, init_chat_db, get_db_session, ChatSession, ChatMessage
from explain_router import router as explain_router
from ingest import ingest

# Run database SOP ingestion to ensure Chroma DB is fully up to date on start
try:
    ingest()
except Exception as e:
    print(f"Failed to run database SOP ingestion at import: {e}")

app = FastAPI(title="OptiWMS Agent API")
chain = load_agent()

@app.on_event("startup")
def startup_event():
    init_chat_db()

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
    user_id: Optional[str] = None
    session_id: Optional[str] = None

class DataResponse(BaseModel):
    mode: Optional[str] = None
    sql: Optional[str] = None
    data: Optional[List[dict]] = None
    chart: Optional[str] = None
    error: Optional[str] = None
    answer: Optional[str] = None       # Conversational summary, download link, or SOP answer
    download_url: Optional[str] = None  # Set in Report mode
    sources: Optional[List[str]] = None  # SOP sources
    session_id: Optional[str] = None
    action: Optional[str] = None        # e.g. "START_TOUR" for guided product tours
    tourId: Optional[str] = None        # Tour config key in frontend/lib/tours/tourConfig.ts

class SessionSummary(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime

class MessageDetail(BaseModel):
    id: str
    session_id: str
    sender: str
    text_content: Optional[str] = None
    metadata: Optional[dict] = None
    timestamp: datetime


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
        res = ask(
            chain, 
            question, 
            user_id=request.user_id, 
            session_id=request.session_id
        )
        return DataResponse(
            mode=res.get("mode"),
            sql=res.get("sql"),
            data=res.get("data"),
            chart=res.get("chart"),
            error=res.get("error"),
            answer=res.get("answer"),
            download_url=res.get("download_url"),
            sources=res.get("sources"),
            session_id=res.get("session_id"),
            action=res.get("action"),
            tourId=res.get("tourId"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reindex")
def reindex_sops():
    global chain
    try:
        print("Manually triggering database SOP ingestion...")
        ingest()
        chain = load_agent()
        return {"status": "success", "message": "SOPs reindexed successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reindexing failed: {str(e)}")


# ── History routes ────────────────────────────────────────────────────────────
@app.get("/history/{user_id}", response_model=List[SessionSummary])
def get_user_history(user_id: str):
    try:
        with get_db_session() as db:
            sessions = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.created_at.desc()).all()
            return [
                SessionSummary(
                    id=s.id,
                    user_id=s.user_id,
                    title=s.title,
                    created_at=s.created_at
                ) for s in sessions
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/history/session/{session_id}", response_model=List[MessageDetail])
def get_session_history(session_id: str):
    try:
        with get_db_session() as db:
            messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc()).all()
            return [
                MessageDetail(
                     id=m.id,
                     session_id=m.session_id,
                     sender=m.sender,
                     text_content=m.text_content,
                     metadata=m.chat_metadata,
                     timestamp=m.timestamp
                ) for m in messages
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.delete("/history/session/{session_id}", status_code=204)
def delete_chat_session(session_id: str):
    try:
        with get_db_session() as db:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found.")
            db.delete(session)
            db.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


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
