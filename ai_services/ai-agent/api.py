import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agent import load_agent, ask
from db_agent import ask_database
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

class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]
    context: Optional[str] = None

class DataResponse(BaseModel):
    sql: Optional[str] = None
    data: Optional[list] = None
    chart: Optional[str] = None
    error: Optional[str] = None
    answer: Optional[str] = None       # Conversational summary or download link
    download_url: Optional[str] = None  # Set in Report mode

class SQLRequest(BaseModel):
    sql: str


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ── SOP assistant ─────────────────────────────────────────────────────────────
@app.post("/ask", response_model=AnswerResponse)
def ask_question(request: QuestionRequest):
    question = (request.message or request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A message is required.")
    answer, sources = ask(chain, question)
    return AnswerResponse(answer=answer, sources=sources, context=request.context)


# ── Data & Analytics (conversational + report modes) ─────────────────────────
@app.post("/ask-data", response_model=DataResponse)
def ask_data_question(request: QuestionRequest):
    question = (request.message or request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A message is required.")

    df, sql, chart, error, answer, download_url = ask_database(question)

    if error:
        return DataResponse(error=error, sql=sql, answer=answer)

    data = df.to_dict(orient="records") if df is not None else None
    return DataResponse(
        sql=sql,
        data=data,
        chart=chart,
        answer=answer,
        download_url=download_url,
    )


# ── Direct SQL execution ──────────────────────────────────────────────────────
@app.post("/query-sql", response_model=DataResponse)
def query_sql(request: SQLRequest):
    sql = request.sql or ""
    if not sql:
        raise HTTPException(status_code=400, detail="A SQL statement is required.")
    from db_agent import run_sql

    df, chart, error = run_sql(sql)
    if error:
        return DataResponse(error=error, sql=sql)
    data = df.to_dict(orient="records") if df is not None else None
    return DataResponse(sql=sql, data=data, chart=chart)


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
