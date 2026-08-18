import hashlib
import json
import logging
import os
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, Header, HTTPException, Response, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from agent import (
    AIQuotaExceeded,
    ChatMessage,
    ChatSession,
    ask,
    classify_question,
    get_db_session,
    init_chat_db,
    load_agent,
)
from explain_router import router as explain_router
from ingest import ingest

app = FastAPI(title="OptiWMS Agent API")
chain = load_agent()
bearer = HTTPBearer(auto_error=True)
logger = logging.getLogger("optiwms.assistant")

spring_api_base_url = os.getenv("SPRING_API_BASE_URL", "http://localhost:8080").rstrip("/")
request_limit_per_minute = int(os.getenv("AI_AGENT_RATE_LIMIT_PER_MINUTE", "30"))
request_windows: dict[str, deque[float]] = defaultdict(deque)
request_window_lock = threading.Lock()

# Roles allowed to reach the generated-SQL analytics tool. Everyone who is
# signed in may still use SOP search and guided tours.
sql_roles = {
    role.strip().upper()
    for role in os.getenv("AI_AGENT_SQL_ROLES", "ADMIN,MANAGER").split(",")
    if role.strip()
}
ADMIN_ROLES = {"ADMIN"}

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

# ── Generated PDF reports ────────────────────────────────────────────────────
# Deliberately not mounted as StaticFiles: reports contain warehouse data, so
# they are served only through the authenticated /download/{filename} route.
REPORTS_DIR = Path(__file__).parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


@app.on_event("startup")
def startup_event():
    init_chat_db()
    # Keep the Chroma index current. Ingestion at startup rather than at import
    # so a database blip cannot break module loading.
    try:
        ingest()
    except Exception as exc:  # pragma: no cover - startup best effort
        logger.warning("SOP ingestion at startup failed: %s", exc)


# ── Pydantic models ───────────────────────────────────────────────────────────
class QuestionRequest(BaseModel):
    message: Optional[str] = None
    question: Optional[str] = None
    context: Optional[str] = None
    timestamp: Optional[str] = None
    session_id: Optional[str] = None
    # What the user is looking at: {route, entityType, entityId, entityLabel, filters}.
    # Advisory only -- it can fill in an unstated subject, never widen access.
    page_context: Optional[dict[str, Any]] = None


class DataResponse(BaseModel):
    mode: Optional[str] = None
    sql: Optional[str] = None
    data: Optional[List[dict]] = None
    chart: Optional[dict[str, Any]] = None  # {type, title, xKey, yKey, data} — rendered by Recharts, not an image
    error: Optional[str] = None
    answer: Optional[str] = None        # Conversational summary, download link, or SOP answer
    download_url: Optional[str] = None  # Set in Report mode
    sources: Optional[List[str]] = None  # SOP sources
    citations: Optional[List[str]] = None  # Alias of sources, kept for the audit contract
    session_id: Optional[str] = None
    action: Optional[str] = None        # e.g. "START_TOUR" for guided product tours
    tourId: Optional[str] = None        # Tour config key in frontend/lib/tours/tourConfig.ts
    facts: dict[str, Any] = {}
    warnings: List[str] = []
    toolCalls: List[dict[str, Any]] = []
    correlationId: Optional[str] = None


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


# ── Identity, roles and rate limiting ─────────────────────────────────────────
def validate_identity(token: str) -> dict[str, Any]:
    validation_request = Request(
        f"{spring_api_base_url}/api/auth/me",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    try:
        with urlopen(validation_request, timeout=4) as spring_response:
            payload = json.loads(spring_response.read().decode("utf-8"))
            return payload if isinstance(payload, dict) else {}
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(status_code=401, detail="The signed-in identity is not valid.") from exc
        raise HTTPException(status_code=503, detail="Identity validation is temporarily unavailable.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="Identity validation is temporarily unavailable.") from exc


def identity_role(identity: dict[str, Any]) -> str:
    """Spring may report either `MANAGER` or `ROLE_MANAGER` depending on whether
    the value came from the authorities list or the user row."""
    raw = str(identity.get("role") or "").strip().upper()
    return raw[5:] if raw.startswith("ROLE_") else raw


def identity_id(identity: dict[str, Any]) -> str:
    """Spring's /api/auth/me returns the primary key as `userId`; `id` is only a
    fallback for other identity shapes. Reading the wrong key silently disabled
    chat history persistence and failed every ownership check."""
    return str(identity.get("userId") or identity.get("id") or "")


def identity_label(identity: dict[str, Any]) -> str:
    return (
        identity.get("username")
        or identity.get("email")
        or identity_id(identity)
        or "authenticated"
    )


def enforce_rate_limit(token: str) -> None:
    now = time.monotonic()
    key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with request_window_lock:
        window = request_windows[key]
        while window and now - window[0] >= 60:
            window.popleft()
        if len(window) >= request_limit_per_minute:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "ASSISTANT_RATE_LIMIT",
                    "message": "You are sending requests too quickly. Please wait a moment and try again.",
                },
            )
        window.append(now)


def quota_exceeded(exc: Exception, correlation_id: str, identity: dict[str, Any]) -> HTTPException:
    """Every model provider is rate limited. Answer 429 with a distinct code so
    the UI can say 'AI quota exceeded' rather than blaming the user's pace."""
    logger.warning(
        "assistant_quota_exhausted user=%s correlation_id=%s detail=%s",
        identity_label(identity), correlation_id, exc,
    )
    return HTTPException(
        status_code=429,
        detail={
            "code": "AI_QUOTA_EXCEEDED",
            "message": (
                "AI quota exceeded. The assistant's language model providers are "
                "temporarily out of capacity. Please try again in a few minutes."
            ),
            "correlationId": correlation_id,
        },
    )


def authenticate(credentials: HTTPAuthorizationCredentials) -> dict[str, Any]:
    identity = validate_identity(credentials.credentials)
    enforce_rate_limit(credentials.credentials)
    return identity


def require_admin(identity: dict[str, Any]) -> None:
    if identity_role(identity) not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="This action requires an administrator.")


def assert_owns_user_scope(identity: dict[str, Any], user_id: str) -> None:
    """A user may only read their own chat history; administrators may read any."""
    if identity_role(identity) in ADMIN_ROLES:
        return
    if identity_id(identity) != str(user_id):
        raise HTTPException(status_code=403, detail="Chat history belongs to another user.")


def assert_owns_session(identity: dict[str, Any], session: Any) -> None:
    if identity_role(identity) in ADMIN_ROLES:
        return
    if str(session.user_id) != identity_id(identity):
        raise HTTPException(status_code=403, detail="Chat session belongs to another user.")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "sqlRoles": sorted(sql_roles)}


# ── Unified AI assistant (SOP RAG + WMS database query + report) ──────────────
@app.post("/ask", response_model=DataResponse)
def ask_question(
    request: QuestionRequest,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Security(bearer),
    requested_correlation: Optional[str] = Header(default=None, alias="X-Correlation-ID"),
):
    identity = authenticate(credentials)
    question = (request.message or request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A message is required.")

    correlation_id = requested_correlation.strip() if requested_correlation else str(uuid.uuid4())
    response.headers["X-Correlation-ID"] = correlation_id

    role = identity_role(identity)
    # The chat history is keyed on the *verified* identity, never on a user id
    # supplied by the caller, so one user cannot write into another's history.
    user_id = identity_id(identity) or None

    try:
        mode = classify_question(question)
    except AIQuotaExceeded as exc:
        raise quota_exceeded(exc, correlation_id, identity) from exc

    if mode == "DATA" and role not in sql_roles:
        logger.info(
            "assistant_denied tool=sql_analytics user=%s role=%s correlation_id=%s",
            identity_label(identity), role or "unknown", correlation_id,
        )
        return DataResponse(
            mode="DENIED",
            answer=(
                "Warehouse data queries and generated reports are limited to manager "
                "and administrator accounts. I can still answer questions about SOPs "
                "and walk you through the app."
            ),
            warnings=["sql_analytics_requires_elevated_role"],
            toolCalls=[{"name": "sql_analytics", "outcome": "denied", "role": role or "unknown"}],
            correlationId=correlation_id,
        )

    try:
        res = ask(
            chain,
            question,
            user_id=user_id,
            session_id=request.session_id,
            mode=mode,
            page_context=request.page_context,
        )
    except AIQuotaExceeded as exc:
        raise quota_exceeded(exc, correlation_id, identity) from exc
    except Exception as exc:
        logger.exception("assistant_error correlation_id=%s", correlation_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    sources = res.get("sources")
    logger.info(
        "assistant_tool tool=%s user=%s role=%s correlation_id=%s",
        res.get("mode"), identity_label(identity), role or "unknown", correlation_id,
    )
    return DataResponse(
        mode=res.get("mode"),
        sql=res.get("sql"),
        data=res.get("data"),
        chart=res.get("chart"),
        error=res.get("error"),
        answer=res.get("answer"),
        download_url=res.get("download_url"),
        sources=sources,
        citations=sources,
        session_id=res.get("session_id"),
        action=res.get("action"),
        tourId=res.get("tourId"),
        toolCalls=[{"name": res.get("mode"), "outcome": "error" if res.get("error") else "ok"}],
        correlationId=correlation_id,
    )


@app.post("/reindex")
def reindex_sops(credentials: HTTPAuthorizationCredentials = Security(bearer)):
    identity = authenticate(credentials)
    require_admin(identity)
    global chain
    try:
        logger.info("sop_reindex_requested user=%s", identity_label(identity))
        ingest()
        chain = load_agent()
        return {"status": "success", "message": "SOPs reindexed successfully."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Reindexing failed: {str(exc)}") from exc


# ── History routes ────────────────────────────────────────────────────────────
@app.get("/history/{user_id}", response_model=List[SessionSummary])
def get_user_history(user_id: str, credentials: HTTPAuthorizationCredentials = Security(bearer)):
    identity = authenticate(credentials)
    assert_owns_user_scope(identity, user_id)
    try:
        with get_db_session() as db:
            sessions = (
                db.query(ChatSession)
                .filter(ChatSession.user_id == user_id)
                .order_by(ChatSession.created_at.desc())
                .all()
            )
            return [
                SessionSummary(
                    id=s.id,
                    user_id=s.user_id,
                    title=s.title,
                    created_at=s.created_at,
                )
                for s in sessions
            ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {str(exc)}") from exc


@app.get("/history/session/{session_id}", response_model=List[MessageDetail])
def get_session_history(session_id: str, credentials: HTTPAuthorizationCredentials = Security(bearer)):
    identity = authenticate(credentials)
    try:
        with get_db_session() as db:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found.")
            assert_owns_session(identity, session)
            messages = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.timestamp.asc())
                .all()
            )
            return [
                MessageDetail(
                    id=m.id,
                    session_id=m.session_id,
                    sender=m.sender,
                    text_content=m.text_content,
                    metadata=m.chat_metadata,
                    timestamp=m.timestamp,
                )
                for m in messages
            ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {str(exc)}") from exc


@app.delete("/history/session/{session_id}", status_code=204)
def delete_chat_session(session_id: str, credentials: HTTPAuthorizationCredentials = Security(bearer)):
    identity = authenticate(credentials)
    try:
        with get_db_session() as db:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found.")
            assert_owns_session(identity, session)
            db.delete(session)
            db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {str(exc)}") from exc


# ── PDF download endpoint ─────────────────────────────────────────────────────
@app.get("/download/{filename}")
def download_report(filename: str, credentials: HTTPAuthorizationCredentials = Security(bearer)):
    """Serve a generated PDF report for download."""
    identity = authenticate(credentials)
    if identity_role(identity) not in sql_roles:
        raise HTTPException(status_code=403, detail="Reports are limited to manager and administrator accounts.")

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
