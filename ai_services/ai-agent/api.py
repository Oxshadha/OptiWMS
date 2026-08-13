import os
import hashlib
import json
import logging
import threading
import time
import uuid
from collections import defaultdict, deque
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, Header, HTTPException, Response, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import load_agent, ask

app = FastAPI(title="OptiWMS Agent API")
chain = load_agent()
bearer = HTTPBearer(auto_error=True)
logger = logging.getLogger("optiwms.sop_assistant")
spring_api_base_url = os.getenv("SPRING_API_BASE_URL", "http://localhost:8080").rstrip("/")
request_limit_per_minute = int(os.getenv("AI_AGENT_RATE_LIMIT_PER_MINUTE", "30"))
request_windows: dict[str, deque[float]] = defaultdict(deque)
request_window_lock = threading.Lock()

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

class QuestionRequest(BaseModel):
    message: Optional[str] = None
    question: Optional[str] = None
    context: Optional[str] = None
    timestamp: Optional[str] = None

class AnswerResponse(BaseModel):
    answer: str
    citations: list[str]
    facts: dict[str, Any]
    warnings: list[str]
    toolCalls: list[dict[str, Any]]
    correlationId: str

@app.get("/health")
def health():
    return {"status": "ok", "liveDataMode": "typed-spring-tools-only"}

@app.post("/ask", response_model=AnswerResponse)
def ask_question(
    request: QuestionRequest,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Security(bearer),
    requested_correlation: Optional[str] = Header(default=None, alias="X-Correlation-ID"),
):
    identity = validate_identity(credentials.credentials)
    enforce_rate_limit(credentials.credentials)
    question = (request.message or request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A message is required.")
    answer, sources = ask(chain, question)
    correlation_id = requested_correlation.strip() if requested_correlation else str(uuid.uuid4())
    response.headers["X-Correlation-ID"] = correlation_id
    logger.info(
        "assistant_tool tool=sop_search user=%s result_count=%d correlation_id=%s",
        identity.get("username") or identity.get("email") or identity.get("id") or "authenticated",
        len(sources),
        correlation_id,
    )
    return AnswerResponse(
        answer=answer,
        citations=sources,
        facts={},
        warnings=[],
        toolCalls=[{"name": "search_sop_index", "resultCount": len(sources)}],
        correlationId=correlation_id,
    )


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


def enforce_rate_limit(token: str) -> None:
    now = time.monotonic()
    key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with request_window_lock:
        window = request_windows[key]
        while window and now - window[0] >= 60:
            window.popleft()
        if len(window) >= request_limit_per_minute:
            raise HTTPException(status_code=429, detail="Assistant request limit exceeded. Try again shortly.")
        window.append(now)
