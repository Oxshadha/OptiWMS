import os
import re
import math
import io
import json
import httpx
import uuid
import time
import logging
import pandas as pd
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect, Column, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import declarative_base, sessionmaker
import threading

from google import genai
from google.genai import types
from google.api_core.exceptions import ResourceExhausted

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns

import fast_path
import parallel
import tools as tools_module

# Langchain / SOP Q&A
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_classic.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate

# ReportLab
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

load_dotenv()

# ── SOP Vector DB Constants ───────────────────────────────────────────────────
# Anchored to this file, not the working directory. A relative "db" meant the
# vector store was created, read, or wiped somewhere different depending on where
# the process happened to be started from -- so a seed run from the repo root and
# the service started from this directory disagreed about where the index lived.
DB_PATH = str((Path(__file__).resolve().parent / "db"))

PROMPT_TEMPLATE = """
You are a warehouse operations assistant for OptiWMS.
Answer the user's question using ONLY the information provided in the context below.
If the answer is not in the context, say "I don't have that information in the current SOPs."
Be clear, practical, and concise. If steps are involved, list them.

Context:
{context}

Question:
{question}

Answer:
"""

# ── Database connection ───────────────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST")
DB_PORT     = os.getenv("DB_PORT")
DB_NAME     = os.getenv("DB_NAME")
DB_USER     = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Reports directory (resolved relative to this file)
REPORTS_DIR = Path(__file__).parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

# One pooled engine for the process. This was building a fresh Engine per request,
# so every question paid a new Postgres TCP connect and authentication before it
# could read anything.
_ENGINE = None
_ENGINE_LOCK = threading.Lock()


def get_engine():
    global _ENGINE
    if _ENGINE is None:
        with _ENGINE_LOCK:
            if _ENGINE is None:
                _ENGINE = create_engine(
                    DATABASE_URL, pool_size=5, max_overflow=5, pool_pre_ping=True
                )
    return _ENGINE

Base = declarative_base()

class ChatSession(Base):
    __tablename__ = 'chat_sessions'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(255), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    sender = Column(String(10), nullable=False) # "user" or "ai"
    text_content = Column(Text, nullable=True)
    chat_metadata = Column("metadata", JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class PolicyExplanationCache(Base):
    """One cached LLM narration per policy recommendation line, keyed on the
    line's own `updated_at`. A recalculated line gets a new `updated_at`, so
    the old cache row is simply orphaned (and overwritten on next lookup)
    rather than served stale — no time-based expiry needed, since the only
    thing that should invalidate an explanation is the underlying numbers
    actually changing."""
    __tablename__ = 'policy_explanation_cache'
    line_id = Column(String(36), primary_key=True)
    line_updated_at = Column(DateTime(timezone=True), nullable=False)  # matches inventory_policy_recommendation_lines.updated_at
    explanation = Column(Text, nullable=False)
    model_used = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())

def init_chat_db():
    try:
        engine = get_engine()
        Base.metadata.create_all(engine)
        print("Chat history tables successfully initialized or checked.")
    except Exception as e:
        print(f"Error initializing chat history tables: {e}")

from contextlib import contextmanager
@contextmanager
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Colour palette (matching Java export format) ──────────────────────────────
_DARK_CHARCOAL = colors.HexColor("#222831")   # main headings & text
_PINKISH_RED   = colors.HexColor("#D10654")   # chart bars & metrics
_LIGHT_BG      = colors.HexColor("#F8FAFC")   # table header background
_BORDER_GRAY   = colors.HexColor("#E2E8F0")   # horizontal rules and borders
_GRID_GRAY     = colors.HexColor("#F1F5F9")   # vertical table grid dividers
_WHITE         = colors.white

def get_logo_image():
    cwd = Path(__file__).parent
    candidates = [
        cwd.parent.parent / "frontend/public/assets/logos/logo with tagline.png",
        cwd / "frontend/public/assets/logos/logo with tagline.png"
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return None

# ── Schema cache ──────────────────────────────────────────────────────────────
_schema_cache: dict = {}



def get_schema_description(engine) -> str:
    global _schema_cache
    db_url = str(engine.url)
    if db_url in _schema_cache:
        return _schema_cache[db_url]
    inspector = inspect(engine)
    schema_lines = []
    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        col_info = ", ".join([f"{c['name']} ({str(c['type'])})" for c in columns])
        schema_lines.append(f"Table: {table_name}\n  Columns: {col_info}")
    schema_description = "\n\n".join(schema_lines)
    _schema_cache[db_url] = schema_description
    return schema_description


# ── Safety check ──────────────────────────────────────────────────────────────
# Statements the ad-hoc path may never issue. Checked as whole words, so a column
# named created_at or a value containing "update" is unaffected.
_FORBIDDEN_STATEMENTS = (
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "CREATE",
    "GRANT", "REVOKE", "COPY", "VACUUM", "REINDEX", "CALL", "DO",
)
# Catalogue and system views. Note the trailing \w* -- a bare \b after "PG_" never
# matches pg_catalog, because the next character is a word character. Written the
# obvious way, this guard silently blocks nothing.
_SYSTEM_OBJECTS = re.compile(r"\b(PG_\w+|INFORMATION_SCHEMA|CURRENT_SETTING|PG_SLEEP)\b")
MAX_ADHOC_ROWS = 100


def is_safe_query(sql: str) -> bool:
    """Whether a generated SELECT may run.

    This is the last line of the ad-hoc path, which is itself the fallback when no
    reviewed tool matches. The connection is the application owner, so the guard is
    what stands between a generated string and a write.
    """
    text = sql.strip().rstrip(";")
    upper = text.upper()

    if not upper.startswith("SELECT") and not upper.startswith("WITH"):
        return False
    # Statement chaining: a trailing semicolon is fine, an interior one is not.
    if ";" in text:
        return False
    if _SYSTEM_OBJECTS.search(upper):
        return False
    for word in _FORBIDDEN_STATEMENTS:
        if re.search(r"\b" + word + r"\b", upper):
            return False
    return True


def enforce_row_limit(sql: str) -> str:
    """Cap an unbounded query. The prompt asks for a limit; this makes it true."""
    if not sql:
        return sql
    if re.search(r"\bLIMIT\s+\d+", sql, re.IGNORECASE):
        return sql
    return sql.rstrip().rstrip(";") + f" LIMIT {MAX_ADHOC_ROWS}"


# ── SQL extraction ────────────────────────────────────────────────────────────
def extract_sql(text: str) -> str:
    match = re.search(r"```(?:sql)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r"(SELECT\s.+?)(?:;|$)", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""


# ── JSON-safe DataFrame → records ─────────────────────────────────────────────
def df_records_json_safe(df: pd.DataFrame) -> list[dict]:
    """`df.to_dict(orient="records")` keeps raw datetime.date/Decimal objects,
    which the stdlib json encoder (used by the Postgres JSON column and by
    FastAPI) cannot serialize — a query result with a plain DATE column would
    silently fail to persist to chat history. Route through pandas' own JSON
    encoder instead, which already knows how to convert those types."""
    if df is None:
        return []
    return json.loads(df.to_json(orient="records", date_format="iso"))


# ── Mode detection ────────────────────────────────────────────────────────────
def is_report_request(question: str) -> bool:
    q = question.lower()
    has_report = "report" in q or "pdf" in q
    has_action = any(act in q for act in ["generate", "create", "download", "export", "make", "build"])
    return has_report and has_action


# ── Chart generation (JSON spec for interactive frontend rendering) ──────────
def generate_chart_spec(df: pd.DataFrame) -> dict | None:
    """Pick a chart shape from the result set and return it as a declarative
    JSON spec — {type, title, xKey, yKey, data} — for the frontend to render
    with Recharts. No image is produced: the LLM/backend never decides pixels,
    only which columns to plot, so the chat UI gets real hover/zoom
    interactivity instead of a static picture."""
    if df is None or df.empty or len(df) < 2:
        return None

    df_display = df.copy()
    for col in df_display.columns:
        if "date" in col.lower() or pd.api.types.is_datetime64_any_dtype(df_display[col]):
            try:
                df_display[col] = pd.to_datetime(df_display[col], errors="coerce")
            except Exception:
                pass

    numeric_cols = df_display.select_dtypes(include=["number"]).columns.tolist()
    if not numeric_cols:
        return None

    cat_cols = [
        c for c in df_display.columns
        # nunique()==0 means every value is null (e.g. sku_id on raw materials
        # that are only identified by material_code) — dropna() would then
        # wipe every row and silently push a good column into the histogram
        # fallback instead of plotting it.
        if c not in numeric_cols and 1 <= df_display[c].nunique() <= min(len(df_display), 50)
    ]
    date_cols = [c for c in df_display.columns if pd.api.types.is_datetime64_any_dtype(df_display[c])]

    try:
        if date_cols and numeric_cols:
            date_col, metric_col = date_cols[0], numeric_cols[0]
            # A tool's result can carry an extra breakdown dimension (e.g.
            # order status) that makes the same date repeat with different
            # values. A line needs one point per x, so collapse repeats by
            # summing rather than plotting them as separate points on the
            # same date, which would zigzag nonsensically.
            df_plot = (
                df_display.dropna(subset=[date_col, metric_col])
                .groupby(date_col, as_index=False)[metric_col]
                .sum()
                .sort_values(by=date_col)
            )
            if len(df_plot) >= 2:
                return {
                    "type": "line",
                    "title": f"{metric_col} over time",
                    "xKey": date_col,
                    "yKey": metric_col,
                    "data": df_records_json_safe(df_plot[[date_col, metric_col]]),
                }

        if cat_cols and numeric_cols:
            cat_col, metric_col = cat_cols[0], numeric_cols[0]
            df_plot = (
                df_display[[cat_col, metric_col]]
                .dropna()
                .groupby(cat_col, as_index=False)[metric_col]
                .sum()
            )
            if len(df_plot) >= 2:
                if len(df_plot) > 15:
                    df_plot = df_plot.nlargest(15, metric_col)
                return {
                    "type": "bar",
                    "title": f"{metric_col} by {cat_col}",
                    "xKey": cat_col,
                    "yKey": metric_col,
                    "data": df_records_json_safe(df_plot),
                }

        if len(numeric_cols) >= 1:
            metric_col = numeric_cols[0]
            df_plot = df_display[metric_col].dropna()
            if len(df_plot) >= 5:
                bins = pd.cut(df_plot, bins=min(10, df_plot.nunique()))
                counts = bins.value_counts().sort_index()
                hist_data = [
                    {"bucket": f"{interval.left:.1f}–{interval.right:.1f}", "count": int(count)}
                    for interval, count in counts.items()
                ]
                return {
                    "type": "bar",
                    "title": f"Distribution of {metric_col}",
                    "xKey": "bucket",
                    "yKey": "count",
                    "data": hist_data,
                }

    except Exception as exc:
        print(f"Chart spec generation failed: {exc}")

    return None


def generate_chart_spec_checked(df: pd.DataFrame, question: str = "") -> dict | None:
    """Chart spec for a result set, corrected to match the kind of data it describes."""
    return enforce_chart_rules(generate_chart_spec(df), question)


def _fig_to_bytes(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


# ── Provider quota handling and Groq fallback ────────────────────────────────
logger = logging.getLogger("optiwms.agent")
# llama-3.3-70b-versatile was decommissioned by Groq, so every fallback attempt
# returned 404 -- the resilience path was dead while appearing configured.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class AIQuotaExceeded(Exception):
    """Every configured model provider is rate limited or out of quota.

    Raised so the API layer can answer 429 with a clear message instead of a
    generic 500.
    """


def _is_quota_error(exc: Exception) -> bool:
    """Detect a rate-limit/quota error across the shapes providers use.

    google-genai raises ResourceExhausted in some paths and a ClientError
    carrying HTTP 429 in others, and httpx raises HTTPStatusError. Checking the
    text as a last resort keeps this working across SDK versions.
    """
    if isinstance(exc, ResourceExhausted):
        return True
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
        return True
    if getattr(exc, "code", None) == 429 or getattr(exc, "status_code", None) == 429:
        return True
    text = str(exc).upper()
    return "RESOURCE_EXHAUSTED" in text or "429" in text or "QUOTA" in text or "RATE LIMIT" in text


# Some fallback models emit a visible chain-of-thought block before the answer.
_THINK_BLOCK = re.compile(r"<think>.*?</think>\s*", re.DOTALL | re.IGNORECASE)


def _strip_reasoning(text: str) -> str:
    return _THINK_BLOCK.sub("", text or "").strip()


def _generate_with_groq(prompt: str) -> str:
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        raise AIQuotaExceeded(
            "The Gemini quota is exhausted and no GROQ_API_KEY fallback is configured."
        )
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    # Reasoning models spend budget before emitting any content; too
                    # small a cap returns an empty string rather than an answer.
                    "max_tokens": 2048,
                },
            )
            resp.raise_for_status()
            message = resp.json()["choices"][0]["message"]
            return _strip_reasoning(message.get("content") or "")
    except Exception as exc:
        if _is_quota_error(exc):
            raise AIQuotaExceeded("Both Gemini and Groq are rate limited right now.") from exc
        raise


def _groq_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


# Gemini requests hang forever by default: http_options.timeout is unset, and the
# handler is a sync def, so a stalled connection holds an anyio worker until the
# process restarts. Bound it, and reuse one client so each call is not also paying
# for a new connection pool and TLS handshake.
# Gemini normally answers in 1-2.5s here. A long ceiling does not make a stalled call
# succeed -- it just delays the Groq fallback, so a stall cost 20s *plus* the fallback.
# The API rejects anything under 10s ("Minimum allowed deadline is 10s") with a 400, so
# a shorter value does not tighten the bound, it fails every call; the floor is clamped
# rather than trusted to configuration.
GEMINI_TIMEOUT_MS = max(10_000, int(os.getenv("GEMINI_TIMEOUT_MS", "12000")))
_GEMINI_CLIENT = None
_GEMINI_LOCK = threading.Lock()


def _gemini_client():
    global _GEMINI_CLIENT
    if _GEMINI_CLIENT is None:
        with _GEMINI_LOCK:
            if _GEMINI_CLIENT is None:
                _GEMINI_CLIENT = genai.Client(
                    api_key=os.getenv("GOOGLE_API_KEY"),
                    http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
                )
    return _GEMINI_CLIENT


def _generate_content_with_fallback(prompt: str, model: str = "gemini-3.1-flash-lite") -> tuple[str, bool]:
    """Return (text, used_fallback).

    Falls back to Groq whenever Gemini cannot answer and a Groq key is set --
    quota exhaustion, an invalid/revoked key, or the service being unreachable.
    The reason is always logged so a broken Gemini key stays visible rather than
    being silently masked by the fallback.
    """
    try:
        response = _gemini_client().models.generate_content(model=model, contents=prompt)
        return response.text, False
    except Exception as exc:
        quota = _is_quota_error(exc)
        if not _groq_configured():
            if quota:
                raise AIQuotaExceeded(
                    "The Gemini quota is exhausted and no GROQ_API_KEY fallback is configured."
                ) from exc
            raise
        reason = "quota exhausted" if quota else f"unavailable ({type(exc).__name__})"
        logger.warning("Gemini %s: %s. Falling back to Groq [%s].", reason, exc, GROQ_MODEL)
        return _generate_with_groq(prompt), True

# ── Guarded tool selection ────────────────────────────────────────────────────

def recent_turns(session_id: str | None, limit: int = 6) -> list[tuple[str, str]]:
    """The last few exchanges in this session, oldest first.

    Without this the assistant is stateless per turn: "and what about RM-0002?"
    carries no subject, and "why?" refers to nothing. Only the text is kept -- SQL,
    tables and charts from earlier turns are deliberately left out, since they would
    crowd the prompt without helping resolve a reference.
    """
    if not session_id:
        return []
    try:
        with get_db_session() as db:
            rows = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.timestamp.desc())
                .limit(limit)
                .all()
            )
        return [
            ("user" if r.sender == "user" else "assistant", (r.text_content or "").strip()[:600])
            for r in reversed(rows)
            if (r.text_content or "").strip()
        ]
    except Exception as exc:  # history is an aid, never a hard dependency
        logger.warning("could not load chat history for %s: %s", session_id, exc)
        return []


def format_turns(turns: list[tuple[str, str]]) -> str:
    if not turns:
        return "(no earlier messages in this conversation)"
    return "\n".join(f"{role}: {text}" for role, text in turns)



# Suggestions are grounded in what the assistant can actually do, per page. An LLM
# asked to invent prompts will happily propose "show me today's inbound orders" on a
# page with no such tool, and the user's first interaction is then a failure. These
# map to real entries in TOOL_REGISTRY.
_PAGE_SUGGESTIONS: dict[str, list[tuple[str, str]]] = {
    "/admin/forecasts": [
        ("Explain this forecast", "Why is demand {subject} this high?"),
        ("Model drivers", "What is driving the forecast {subject}?"),
        ("Demand trend", "Show the demand trend {subject}"),
        ("Compare", "Compare the forecast drivers for two materials"),
    ],
    "/admin/inventory-intelligence": [
        ("What breaks this?", "What is this recommendation most sensitive to?"),
        ("Why it changed", "Why did the min and max change {subject}?"),
        ("Below reorder", "Which materials are below their reorder point?"),
        ("Lead time risk", "What happens if the supplier lead time slips?"),
    ],
    "/admin/replenishment/forecast-space": [
        ("What breaks this?", "What is this recommendation most sensitive to?"),
        ("Why it changed", "Why did the min and max change {subject}?"),
        ("Below reorder", "Which materials are below their reorder point?"),
    ],
    "/admin/slotting-plans": [
        ("Why this bin?", "Why was this location chosen {subject}?"),
        ("What is moving", "Which materials are moving in this plan?"),
        ("Distance saved", "How much travel distance does this plan save?"),
    ],
    "/admin/ai-slotting": [
        ("Why this bin?", "Why was this location chosen {subject}?"),
        ("What is moving", "Which materials are moving in this plan?"),
    ],
    "/admin/inventory": [
        ("Stock level", "What is the stock level {subject}?"),
        ("Reorder alerts", "Which materials need reordering?"),
        ("Top movers", "Show the top movers this quarter"),
    ],
    "/admin/dashboard": [
        ("Reorder alerts", "Which materials are below their reorder point?"),
        ("Inbound volume", "Show inbound order volume over the last 90 days"),
        ("Top movers", "What are the top moving materials?"),
    ],
}
_DEFAULT_SUGGESTIONS = [
    ("Reorder alerts", "Which materials are below their reorder point?"),
    ("Top movers", "What are the top moving materials?"),
    ("Getting around", "How do I use this dashboard?"),
]
_WORKER_SUGGESTIONS = [
    ("Forklift safety", "How do I operate a forklift safely?"),
    ("Cycle counts", "What are the steps for a cycle count?"),
    ("Damaged goods", "How do I report damaged goods?"),
]


def suggestions_for(page_context: dict | None, role: str | None = None) -> list[dict]:
    """Prompts worth offering, given where the user is standing.

    Returns ``{"title", "text"}`` pairs so the label matches the question. Reusing a
    generic card title over a page-specific prompt produced captions like
    "Stock Levels" above "Why is demand high?", which reads as a bug.

    Deterministic rather than generated: instant, free, and incapable of proposing a
    capability the assistant does not have.
    """
    if (role or "").lower() == "worker":
        entries = _WORKER_SUGGESTIONS
    else:
        route = (page_context or {}).get("route") or ""
        entries = _PAGE_SUGGESTIONS.get(route, _DEFAULT_SUGGESTIONS)

    label = (page_context or {}).get("entityLabel") or (page_context or {}).get("entityId")
    subject = f"for {label}" if label else ""
    out = []
    for title, template in entries:
        text = template.format(subject=subject) if "{subject}" in template else template
        out.append({"title": title, "text": " ".join(text.split()).replace(" ?", "?")})
    return out


PAGE_ROUTE_LABELS = {
    "/admin/forecasts": "the demand forecast dashboard",
    "/admin/inventory-intelligence": "the inventory policy (min/max) workspace",
    "/admin/slotting-plans": "the slotting plan review screen",
    "/admin/ai-slotting": "the slotting solver lab",
    "/admin/inventory": "the inventory list",
    "/admin/dashboard": "the operations dashboard",
}


def describe_page_context(page_context: dict | None) -> str:
    """One line describing what the user is looking at, for the routing prompt.

    This only ever supplies a subject the user left implicit. It cannot widen
    access: the role gate in api.py runs before any of this, and the tools
    themselves take parameters, not SQL.
    """
    if not page_context:
        return ""
    parts = []
    route = page_context.get("route")
    if route:
        parts.append(f"viewing {PAGE_ROUTE_LABELS.get(route, route)}")
    label = page_context.get("entityLabel") or page_context.get("entityId")
    if label:
        entity = page_context.get("entityType") or "item"
        parts.append(f"with {entity} {label} selected")
    filters = page_context.get("filters") or {}
    readable = ", ".join(f"{k}={v}" for k, v in filters.items() if v not in (None, ""))
    if readable:
        parts.append(f"filtered by {readable}")
    return "; ".join(parts)


# Words the LLM sometimes echoes back as a "value" when the question only pointed
# at something on screen. They are not searchable, so treat them as absent.
_PLACEHOLDER_SUBJECTS = {
    "this", "that", "it", "this one", "that one", "this sku", "that sku",
    "this material", "that material", "this item", "that item", "this product",
    "current", "selected", "the selected material", "the current material", "n/a", "none",
}


def apply_page_context_defaults(selection: dict, page_context: dict | None) -> dict:
    """Fill an unstated subject from what is on screen.

    "Why is this one low?" carries no material code, but the page knows which row
    the user is looking at. Anything the user did name always wins.
    """
    if not page_context or not selection.get("tool"):
        return selection
    params = selection.setdefault("params", {})
    entity_id = page_context.get("entityId")
    stated = str(params.get("search") or "").strip()
    if entity_id and (not stated or stated.lower() in _PLACEHOLDER_SUBJECTS):
        signature = tools_module.TOOL_REGISTRY.get(selection["tool"], {})
        if "search" in (signature.get("params") or {}):
            params["search"] = entity_id
    for key, value in (page_context.get("filters") or {}).items():
        if key == "horizon" and "horizon" not in params and isinstance(value, (int, float)):
            params["horizon"] = int(value)
    return selection


def select_tool(question: str, page_context: dict | None = None,
                history: list[tuple[str, str]] | None = None) -> dict:
    """Ask the LLM to pick a tool from the fixed menu (or none). The LLM only
    ever sees tool names/descriptions/params here — never the DB schema —
    so it cannot influence what SQL actually runs, only which pre-written
    query executes and with what parameter values."""
    prompt = f"""You are a routing assistant for a Warehouse Management System (WMS) data assistant.

Given the list of available tools below, decide which ONE tool (if any) best answers the user's question,
and extract its parameter values from the question. If no tool fits, return "tool": null.

AVAILABLE TOOLS:
{tools_module.tool_menu_description()}

EARLIER IN THIS CONVERSATION:
{format_turns(history or [])}

WHAT THE USER IS CURRENTLY LOOKING AT:
{describe_page_context(page_context) or "(not provided)"}

Use those only to resolve references the question leaves implicit -- "this material",
"that SKU", "why is it low", "and for the next one". A subject named earlier in the
conversation carries forward. If the question names something explicitly, prefer it.

USER QUESTION:
{question}

Respond with ONLY a JSON object, no markdown fences, no explanation, in this exact shape:
{{"tool": "<tool_name_or_null>", "params": {{...}}}}

Only include parameters the tool actually defines. Omit optional parameters you cannot infer — the tool will use its default."""

    text_out, fallback = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
    raw = text_out.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict) or "tool" not in parsed:
            return {"tool": None, "params": {}}
        parsed.setdefault("params", {})
        return apply_page_context_defaults(parsed, page_context)
    except Exception:
        return {"tool": None, "params": {}}


# ── SQL generation (adhoc fallback — only used when no tool matches) ─────────
def generate_sql(question: str, schema: str, page_context: dict | None = None) -> tuple[str, bool]:
    prompt = f"""You are a SQL expert for a Warehouse Management System (WMS) using PostgreSQL.

Given the database schema below, write a SQL SELECT query to answer the user's question.
Return ONLY the SQL query inside a ```sql code block. No explanation.
Use proper table aliases. Limit results to 500 rows maximum.

DATABASE SCHEMA:
{schema}

WHAT THE USER IS CURRENTLY LOOKING AT:
{describe_page_context(page_context) or "(not provided)"}

Use that only to resolve references the question leaves implicit, such as "this material",
"this SKU" or "why is it low". If the question names something explicitly, prefer it.

USER QUESTION:
{question}

SQL QUERY:"""
    text, fallback = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
    return extract_sql(text), fallback


# ── Mode 1: Conversational summary ───────────────────────────────────────────
def generate_conversational_answer(question: str, sql: str, df: pd.DataFrame,
                                   history: list[tuple[str, str]] | None = None) -> tuple[str, bool]:
    """Ask Gemini to summarise the query results in clear, natural English."""
    # Build a compact data sample for the prompt (max 20 rows)
    if df is not None and not df.empty:
        sample = df.head(20).to_string(index=False)
        row_count = len(df)
    else:
        sample = "(no data returned)"
        row_count = 0

    prompt = f"""You are a helpful warehouse analytics assistant for OptiWMS.

EARLIER IN THIS CONVERSATION:
{format_turns(history or [])}

Refer back to it when the user does -- "that one", "those two", "compared to before".
Do not repeat an earlier answer; build on it.

The user asked: "{question}"

The following SQL was executed:
```sql
{sql}
```

It returned {row_count} row(s). Here is a sample of the data:
{sample}

Respond in clear, conversational English. Explain what the data shows, highlight key numbers,
and note any trends or concerns worth mentioning. Be concise (3–6 sentences).
Do NOT output JSON. Do NOT suggest downloading a report unless the user asked for one."""

    text, fallback = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
    return text.strip(), fallback


# ── Mode 2: Report JSON schema generation ────────────────────────────────────
def generate_report_json(question: str, sql: str, df: pd.DataFrame) -> tuple[dict, bool]:
    """Ask Gemini to produce a structured report JSON object from the query results."""
    sample = df.head(50).to_string(index=False) if df is not None and not df.empty else "(no data)"
    row_count = len(df) if df is not None else 0
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    prompt = f"""You are an analytics report generator for OptiWMS Warehouse Management System.

The user requested a report for: "{question}"

SQL executed:
```sql
{sql}
```

Data sample ({row_count} total rows):
{sample}

Generate a VALID JSON report object with EXACTLY this structure (no extra keys, no markdown, no explanation):
{{
  "file_name": "string (snake_case ending in .pdf)",
  "title": "string",
  "subtitle": "string",
  "generated_at": "{now_str}",
  "summary": "string (2-4 sentence paragraph)",
  "sections": [
    {{ "heading": "string", "content": "string" }}
  ],
  "tables": [
    {{
      "title": "string",
      "columns": ["string"],
      "rows": [["value"]]
    }}
  ],
  "charts": [
    {{
      "type": "line | bar | pie | histogram | box",
      "title": "string",
      "x": ["string"],
      "y": [number]
    }}
  ],
  "key_insights": ["string"],
  "recommendations": ["string"]
}}

RULES:
- Use ONLY data from the provided sample. Do NOT invent numbers.
- Match the chart to the data type. Bar or pie for qualitative (nominal/ordinal)
  categories and for discrete values with few levels; histogram or box for a
  continuous measure; line only when the x axis is genuinely ordered, such as time.
- Never use a pie for a comparison or ranking, or for more than 6 categories:
  slice areas cannot be compared accurately.
- Include at most 15 rows in each table.
- Include 2-4 key_insights and 2-3 recommendations.
- Return ONLY the raw JSON. No markdown fences. No explanation."""

    text, fallback = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
    
    raw = text.strip()
    # Strip markdown fences if model added them anyway
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw), fallback


# ── PDF builder ───────────────────────────────────────────────────────────────
def build_pdf_report(report: dict, df: pd.DataFrame | None) -> Path:
    """Render the report dict into a premium PDF and return its file path."""

    file_name = report.get("file_name") or f"warehouse_report_{uuid.uuid4().hex[:8]}.pdf"
    if not file_name.endswith(".pdf"):
        file_name += ".pdf"
    out_path = REPORTS_DIR / file_name

    # Matching Java margins (40 pt left/right, 36 pt top/bottom)
    # Total A4 width: 595. Printable width: 515.
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # ── Custom paragraph styles (Matching Java colors and sizes) ──────────────
    s_brand = ParagraphStyle(
        "Brand",
        parent=styles["Normal"],
        fontSize=23,
        leading=27,
        textColor=_DARK_CHARCOAL,
        fontName="Helvetica-Bold",
        spaceAfter=4,
    )
    s_title = ParagraphStyle(
        "ReportTitle",
        parent=styles["Normal"],
        fontSize=16,
        leading=20,
        textColor=_DARK_CHARCOAL,
        fontName="Helvetica-Bold",
        spaceAfter=4,
    )
    s_subtitle = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        leading=15,
        textColor=_DARK_CHARCOAL,
        spaceAfter=0,
        alignment=TA_LEFT,
        fontName="Helvetica",
    )
    s_meta = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontSize=10.5,
        leading=14,
        textColor=_DARK_CHARCOAL,
        fontName="Helvetica",
    )
    s_h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=_DARK_CHARCOAL,
        spaceBefore=14,
        spaceAfter=4,
        fontName="Helvetica-Bold",
        borderPad=0,
    )
    s_body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        textColor=_DARK_CHARCOAL,
        leading=15,
        spaceAfter=6,
        fontName="Helvetica",
    )
    s_bullet = ParagraphStyle(
        "Bullet",
        parent=s_body,
        leftIndent=14,
        bulletIndent=0,
        spaceAfter=3,
    )
    s_caption = ParagraphStyle(
        "Caption",
        parent=styles["Normal"],
        fontSize=8,
        textColor=_DARK_CHARCOAL,
        alignment=TA_CENTER,
        fontName="Helvetica-Oblique",
        spaceAfter=4,
    )
    s_footer = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=_DARK_CHARCOAL,
        alignment=TA_CENTER,
        fontName="Helvetica",
    )

    story = []

    # ── Header Layout (Matching Java PDF style with Logo) ─────────────────────
    logo_path = get_logo_image()
    
    text_content = [
        Paragraph("OptiWMS", s_brand),
        Paragraph(report.get("title", "Warehouse Report"), s_title),
        Paragraph(f"Generated At: {report.get('generated_at', '')}", s_meta),
    ]
    
    if report.get("subtitle"):
        text_content.append(Spacer(1, 4))
        text_content.append(Paragraph(report["subtitle"], s_subtitle))
        
    if logo_path:
        # Scale to width 220f (7.7 cm) and height 72f (2.54 cm) max maintaining aspect ratio
        try:
            from PIL import Image as PILImage
            with PILImage.open(logo_path) as img:
                img_w, img_h = img.size
            box_w = 220
            box_h = 72
            scale = min(box_w / img_w, box_h / img_h)
            draw_w = img_w * scale
            draw_h = img_h * scale
            logo_img = RLImage(logo_path, width=draw_w, height=draw_h)
        except Exception:
            # Fallback if PIL fails
            logo_img = RLImage(logo_path, width=6.5 * cm, height=2.1 * cm)
        header_data = [[logo_img, text_content]]
        header_table = Table(header_data, colWidths=[220, 295])
    else:
        header_data = [[text_content]]
        header_table = Table(header_data, colWidths=[515])
        
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    
    # Separator Line: Horizontal divider line in `#E2E8F0`
    story.append(HRFlowable(width="100%", thickness=1, color=_BORDER_GRAY, spaceAfter=15))

    # ── Summary ───────────────────────────────────────────────────────────────
    if report.get("summary"):
        story.append(Paragraph("Executive Summary", s_h2))
        story.append(HRFlowable(width="100%", thickness=1, color=_BORDER_GRAY, spaceAfter=6))
        story.append(Paragraph(report["summary"], s_body))

    # ── Sections ──────────────────────────────────────────────────────────────
    for section in report.get("sections", []):
        story.append(Paragraph(section.get("heading", ""), s_h2))
        story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER_GRAY, spaceAfter=4))
        story.append(Paragraph(section.get("content", ""), s_body))

    # ── Tables ────────────────────────────────────────────────────────────────
    for tbl in report.get("tables", []):
        title = tbl.get("title", "")
        columns = tbl.get("columns", [])
        rows = tbl.get("rows", [])

        if not columns:
            continue

        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph(title, s_h2))
        story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER_GRAY, spaceAfter=6))

        header_row = [Paragraph(f"<b>{c}</b>", s_body) for c in columns]
        data_rows = [
            [Paragraph(str(cell), s_body) for cell in row]
            for row in rows[:15]
        ]
        table_data = [header_row] + data_rows

        # Fit columns to full printable width of 515 points
        col_width = 515.0 / max(len(columns), 1)
        tbl_widget = Table(table_data, colWidths=[col_width] * len(columns), repeatRows=1)

        tbl_style = [
            ("BACKGROUND",   (0, 0), (-1, 0), _LIGHT_BG),
            ("TEXTCOLOR",    (0, 0), (-1, 0), _DARK_CHARCOAL),
            ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, 0), 8.5),
            ("TOPPADDING",   (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING",(0, 0), (-1, 0), 6),
            ("LINEBELOW",    (0, 0), (-1, 0), 1, _BORDER_GRAY),
            ("LINEBELOW",    (0, 1), (-1, -1), 0.5, _BORDER_GRAY),
            ("LINEAFTER",    (0, 0), (-2, -1), 0.5, _GRID_GRAY),
            ("TEXTCOLOR",    (0, 1), (-1, -1), _DARK_CHARCOAL),
            ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",     (0, 1), (-1, -1), 8.5),
            ("TOPPADDING",   (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING",(0, 1), (-1, -1), 4),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ]
        tbl_widget.setStyle(TableStyle(tbl_style))
        story.append(tbl_widget)
        story.append(Spacer(1, 0.3 * cm))

    # ── Charts (auto-generated from df, then from report.charts spec) ─────────
    charts_added = 0

    # Auto-generate chart from the actual dataframe first
    if df is not None and not df.empty and len(df) >= 2:
        chart_bytes = _build_chart_bytes_from_df(df)
        if chart_bytes:
            story.append(Paragraph("Data Visualisation", s_h2))
            story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER_GRAY, spaceAfter=6))
            img = RLImage(io.BytesIO(chart_bytes), width=18 * cm, height=8 * cm)
            story.append(img)
            story.append(Paragraph("Auto-generated chart from query results.", s_caption))
            charts_added += 1

    # Additional charts from report spec
    for chart_spec in report.get("charts", []):
        chart_bytes = _build_chart_bytes_from_spec(chart_spec)
        if chart_bytes:
            story.append(Paragraph(chart_spec.get("title", "Chart"), s_h2))
            story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER_GRAY, spaceAfter=6))
            img = RLImage(io.BytesIO(chart_bytes), width=18 * cm, height=8 * cm)
            story.append(img)
            charts_added += 1

    # ── Key Insights ──────────────────────────────────────────────────────────
    insights = report.get("key_insights", [])
    if insights:
        story.append(Paragraph("Key Insights", s_h2))
        story.append(HRFlowable(width="100%", thickness=1, color=_BORDER_GRAY, spaceAfter=6))
        for insight in insights:
            story.append(Paragraph(f"• {insight}", s_bullet))
        story.append(Spacer(1, 0.3 * cm))

    # ── Recommendations ───────────────────────────────────────────────────────
    recs = report.get("recommendations", [])
    if recs:
        story.append(Paragraph("Recommendations", s_h2))
        story.append(HRFlowable(width="100%", thickness=1, color=_BORDER_GRAY, spaceAfter=6))
        for i, rec in enumerate(recs, 1):
            story.append(Paragraph(f"{i}. {rec}", s_bullet))
        story.append(Spacer(1, 0.3 * cm))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER_GRAY, spaceAfter=4))
    story.append(Paragraph(
        f"Generated by OptiWMS Warehouse Assistant · {report.get('generated_at', '')}",
        s_footer,
    ))

    doc.build(story)
    return out_path


def _build_chart_bytes_from_df(df: pd.DataFrame) -> bytes | None:
    df_display = df.copy()
    for col in df_display.columns:
        if "date" in col.lower():
            try:
                df_display[col] = pd.to_datetime(df_display[col], errors="coerce")
            except Exception:
                pass

    numeric_cols = df_display.select_dtypes(include=["number"]).columns.tolist()
    cat_cols = [c for c in df_display.columns if c not in numeric_cols and 1 <= df_display[c].nunique() <= 30]

    if not numeric_cols:
        return None

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(10, 5))

    try:
        date_cols = [c for c in df_display.columns if pd.api.types.is_datetime64_any_dtype(df_display[c])]

        if date_cols and numeric_cols:
            date_col, metric_col = date_cols[0], numeric_cols[0]
            df_plot = df_display.dropna(subset=[date_col, metric_col])
            if len(df_plot) >= 2:
                sns.lineplot(data=df_plot.sort_values(by=date_col), x=date_col, y=metric_col,
                             marker="o", ax=ax, color="#D10654")
                ax.set_title(f"{metric_col} over time", fontsize=13, color="#0F1E3C")
                ax.xaxis.set_tick_params(rotation=45)
                plt.tight_layout()
                return _fig_to_bytes(fig)

        if cat_cols and numeric_cols:
            cat_col, metric_col = cat_cols[0], numeric_cols[0]
            df_plot = df_display[[cat_col, metric_col]].dropna()
            if len(df_plot) >= 2:
                if df_plot[cat_col].nunique() > 15:
                    df_plot = df_plot.groupby(cat_col, as_index=False)[metric_col].sum().nlargest(15, metric_col)
                sns.barplot(data=df_plot, x=cat_col, y=metric_col, ax=ax, color="#D10654")
                ax.set_title(f"{metric_col} by {cat_col}", fontsize=13, color="#0F1E3C")
                ax.xaxis.set_tick_params(rotation=45)
                plt.tight_layout()
                return _fig_to_bytes(fig)

    except Exception as exc:
        print(f"PDF chart generation failed: {exc}")
    finally:
        plt.close(fig)

    return None


# ---------------------------------------------------------------------------
# Chart-type rules
#
# Chapter 2 of the module's data-visualisation material sets the mapping this
# system is marked against:
#
#   Qualitative (nominal or ordinal), and discrete with few distinct values
#       -> bar chart, pie chart.  "A pie chart is awful for comparisons."
#   Quantitative (discrete or continuous)
#       -> histogram, dot plot, box plot, scatter plot.
#
# Nothing previously checked a chart against the data it described, so a
# quantitative answer could be returned as a pie chart -- the specific error the
# material warns against -- and no histogram or box plot existed to return
# instead. These helpers classify the series first and correct the chart.
# ---------------------------------------------------------------------------

# Above this many slices a pie stops being readable; the material's point about
# comparison holds well before it.
_MAX_PIE_SLICES = 6

# A numeric column with few distinct values is discrete and reads well as bars;
# above this it is treated as continuous and wants a distribution chart.
_MAX_DISCRETE_LEVELS = 12


def classify_series(values) -> str:
    """Return 'qualitative', 'discrete' or 'continuous' for a column of values.

    Discrete sits between the two: numeric, so quantitative, but with few enough
    levels that a bar per level is legitimate.
    """
    series = pd.Series(list(values)).dropna()
    if series.empty:
        return "qualitative"
    if not pd.api.types.is_numeric_dtype(series):
        return "qualitative"
    distinct = series.nunique()
    if distinct <= _MAX_DISCRETE_LEVELS and (series % 1 == 0).all():
        return "discrete"
    return "continuous"


def is_comparison_question(question: str) -> bool:
    """Whether the user is comparing categories, where a pie is the wrong shape."""
    q = (question or "").lower()
    return any(word in q for word in (
        "compare", "comparison", "versus", " vs ", "rank", "ranking",
        "highest", "lowest", "top ", "bottom ", "more than", "less than",
    ))


def _to_histogram_spec(spec: dict, labels: list, reason: str) -> dict:
    """Actually bin a continuous variable, rather than just renaming the chart.

    Calling a spec a histogram without binning it left the data unchanged and the
    type unrenderable -- the frontend accepts only line and bar, so the chart was
    dropped and the user saw nothing. Binning here produces a real histogram that
    renders as a bar of ranges everywhere, with no client change needed.
    """
    numeric = [float(v) for v in labels if isinstance(v, (int, float))]
    if len(numeric) < 2:
        return spec
    low, high = min(numeric), max(numeric)
    if high <= low:
        return spec

    # Sturges' rule, clamped to what stays readable in a chat-width chart.
    bin_count = max(4, min(12, int(math.ceil(math.log2(len(numeric)) + 1))))
    width = (high - low) / bin_count
    edges = [low + i * width for i in range(bin_count + 1)]
    counts = [0] * bin_count
    for value in numeric:
        index = min(int((value - low) / width), bin_count - 1)
        counts[index] += 1

    def _fmt(value: float) -> str:
        return f"{value:,.0f}" if abs(value) >= 10 else f"{value:,.2f}"

    buckets = [f"{_fmt(edges[i])}-{_fmt(edges[i + 1])}" for i in range(bin_count)]
    spec["type"] = "bar"           # a histogram is a bar chart of bins
    spec["chart_subtype"] = "histogram"
    spec["xKey"], spec["yKey"] = "range", "count"
    spec["data"] = [{"range": b, "count": c} for b, c in zip(buckets, counts)]
    spec["x"], spec["y"] = buckets, counts
    spec["rule"] = reason
    return spec


def enforce_chart_rules(spec: dict | None, question: str = "") -> dict | None:
    """Correct a chart spec so the chart matches the kind of data it describes.

    Returns the spec unchanged when it already fits, a corrected one when it does
    not, and None when no chart is defensible. A 'rule' note is attached so the
    substitution can be explained rather than being silently different from what
    was asked for.
    """
    if not spec:
        return spec

    chart_type = (spec.get("type") or "bar").lower()
    labels = spec.get("x") or [row.get(spec.get("xKey")) for row in spec.get("data") or []]
    values = spec.get("y") or [row.get(spec.get("yKey")) for row in spec.get("data") or []]
    if not labels or not values:
        return spec

    label_kind = classify_series(labels)

    # A pie divides a whole into parts. It cannot carry a continuous label axis,
    # it degrades past a handful of slices, and it is the wrong tool for ranking.
    if chart_type == "pie":
        if label_kind == "continuous":
            return _to_histogram_spec(spec, labels,
                "Continuous data cannot be shown as parts of a whole; "
                "binned into a histogram to show its distribution.")
        elif len(labels) > _MAX_PIE_SLICES:
            spec["type"] = "bar"
            spec["rule"] = (f"{len(labels)} categories is past what a pie can be read at; "
                            "a bar chart keeps them comparable.")
        elif is_comparison_question(question):
            spec["type"] = "bar"
            spec["rule"] = "Bar chart: lengths compare accurately, pie slices do not."
        return spec

    # Bars imply discrete categories along the x axis. A continuous variable
    # needs binning, which is a histogram, not a bar per observed value.
    if chart_type == "bar" and label_kind == "continuous":
        return _to_histogram_spec(spec, labels,
            "A bar per distinct value misreads a continuous variable; "
            "binned into a histogram instead.")

    # A line asserts an ordered axis. Unordered categories have no such order.
    if chart_type == "line" and label_kind == "qualitative" and not spec.get("ordinal"):
        spec["type"] = "bar"
        spec["rule"] = ("Categories have no inherent order, so a connecting line would "
                        "imply a trend that does not exist.")
        return spec

    return spec


def _build_chart_bytes_from_spec(spec: dict) -> bytes | None:
    chart_type = spec.get("type", "bar")
    x_labels = spec.get("x", [])
    y_values = spec.get("y", [])
    title = spec.get("title", "")

    if not x_labels or not y_values:
        return None

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(10, 5))

    try:
        if chart_type == "histogram":
            ax.hist(y_values, bins=min(12, max(5, len(set(y_values)))),
                    color="#D10654", edgecolor="white")
            ax.set_ylabel("Frequency")
        elif chart_type == "box":
            ax.boxplot(y_values, vert=True, patch_artist=True,
                       boxprops={"facecolor": "#D10654", "alpha": 0.6})
            ax.set_ylabel("Value")
        elif chart_type == "pie":
            ax.pie(y_values, labels=x_labels, autopct="%1.1f%%",
                   colors=sns.color_palette("Blues_d", len(x_labels)))
        elif chart_type == "line":
            ax.plot(x_labels, y_values, marker="o", color="#D10654")
            ax.xaxis.set_tick_params(rotation=45)
        else:  # bar (default)
            ax.bar(x_labels, y_values, color="#D10654")
            ax.xaxis.set_tick_params(rotation=45)

        ax.set_title(title, fontsize=13, color="#0F1E3C", pad=12)
        plt.tight_layout()
        return _fig_to_bytes(fig)
    except Exception as exc:
        print(f"Spec chart generation failed: {exc}")
        plt.close(fig)
        return None


def _finish_data_response(question: str, sql: str, df: pd.DataFrame, report_mode: bool,
                          fallback_used: bool, history: list[tuple[str, str]] | None = None):
    """Shared tail for both the guarded-tool path and the adhoc-SQL fallback:
    turn an executed (sql, df) pair into either a PDF report or a
    conversational answer + chart. Returns (df, sql, chart, error, answer,
    download_url)."""
    if report_mode:
        try:
            report_json, rep_fb = generate_report_json(question, sql, df)
            fallback_used = fallback_used or rep_fb
            pdf_path = build_pdf_report(report_json, df)
            file_name = pdf_path.name
            download_url = f"/download/{file_name}"
            answer = f"Your report **\"{report_json.get('title', 'Warehouse Report')}\"** is ready!"
            if fallback_used:
                answer += "\n\n*(Note: Gemini API quota reached. Answer generated using Groq fallback.)*"
            return None, sql, None, None, answer, download_url
        except Exception as e:
            return None, sql, None, f"Report generation failed: {str(e)}", None, None

    chart = generate_chart_spec_checked(df, question)
    try:
        answer, conv_fb = generate_conversational_answer(question, sql, df, history)
        fallback_used = fallback_used or conv_fb
        if fallback_used and answer:
            answer += "\n\n*(Note: Gemini API quota reached. Answer generated using Groq fallback.)*"
    except Exception:
        answer = ""

    return df, sql, chart, None, answer, None


def _ask_database_adhoc(question: str, engine, report_mode: bool, page_context: dict | None = None):
    """Last-resort path when no guarded tool matches: generate free-form SQL
    against the schema, same as before. Still SELECT-only and
    allowlist-checked."""
    schema = get_schema_description(engine)
    fallback_used = False

    try:
        sql, sql_fb = generate_sql(question, schema, page_context)
        fallback_used = fallback_used or sql_fb
    except AIQuotaExceeded:
        raise
    except ResourceExhausted as e:
        return None, None, None, str(e), None, None
    except Exception as e:
        return None, None, None, f"Failed to generate SQL: {str(e)}", None, None

    if not sql:
        return None, None, None, "I couldn't generate a valid SQL query for that question.", None, None

    if not is_safe_query(sql):
        return None, sql, None, "I only run SELECT queries for safety. Please ask a read-only question.", None, None

    # The prompt asks the model for a bounded query; this is what makes it so.
    sql = enforce_row_limit(sql)

    try:
        with engine.connect() as conn:
            df = pd.read_sql(text(sql), conn)
    except Exception as e:
        return None, sql, None, f"Query failed: {str(e)}", None, None

    return _finish_data_response(question, sql, df, report_mode, fallback_used)


# ── Database analytics ask_database ──────────────────────────────────────────
def ask_database(question: str, page_context: dict | None = None,
                 history: list[tuple[str, str]] | None = None,
                 preselected: dict | None = None,
                 trace: "TraceRecorder | None" = None):
    """
    Returns (df, sql, chart, error, answer, download_url)

    - In Conversational Mode: df, sql, chart, error, answer (natural text), None
    - In Report Mode:         None, sql, None, error, answer (with link), download_url

    Tries the guarded tool menu first (fixed, hand-written SQL — the LLM only
    picks which tool and what parameters). Only falls back to free-form SQL
    generation when no tool matches the question.
    """
    engine = get_engine()
    report_mode = is_report_request(question)

    # ── Comparisons: plan every lookup at once, then run them together ────
    if parallel.looks_comparative(question):
        try:
            calls = parallel.plan_calls(
                question, tools_module.tool_menu_description(),
                _generate_content_with_fallback)
            if len(calls) > 1:
                _t = time.perf_counter()
                results = parallel.execute(calls, tools_module.TOOL_REGISTRY, engine)
                if trace:
                    for r_ in results:
                        trace.record(r_["tool"], "tool", _t,
                                     outcome="error" if "error" in r_ else "ok",
                                     detail=str(r_.get("params", {}).get("search", "")))
                combined, summary = parallel.combine(results)
                if combined is not None and not combined.empty:
                    return _finish_data_response(
                        question, summary, combined, report_mode, False)
        except AIQuotaExceeded:
            raise
        except Exception as exc:
            logger.warning("parallel path failed, using single-tool routing: %s", exc)

    # ── Guarded tool selection ────────────────────────────────────────────
    # The router upstream already chose, in the same call that classified the
    # question; re-selecting here would be a second round trip for one answer.
    try:
        selection = preselected if preselected is not None else select_tool(
            question, page_context, history)
    except AIQuotaExceeded:
        raise
    except Exception as e:
        logger.warning("Tool selection failed, falling back to adhoc SQL: %s", e)
        selection = {"tool": None, "params": {}}

    tool_name = selection.get("tool")
    if tool_name and tool_name in tools_module.TOOL_REGISTRY:
        try:
            fn = tools_module.TOOL_REGISTRY[tool_name]["fn"]
            params = selection.get("params") or {}
            _t = time.perf_counter()
            df, sql = fn(engine, **params)
            if trace:
                trace.record(tool_name, "tool", _t, detail=f"{len(df)} rows")
            result = _finish_data_response(question, sql, df, report_mode,
                                           fallback_used=False, history=history)
            if trace and not report_mode:
                trace.record("generate_answer", "llm", _t)
            return result
        except AIQuotaExceeded:
            raise
        except Exception as e:
            logger.warning("Tool '%s' failed, falling back to adhoc SQL: %s", tool_name, e)

    # ── Adhoc fallback ─────────────────────────────────────────────────────
    return _ask_database_adhoc(question, engine, report_mode, page_context)


# ── RAG / SOP agent load ──────────────────────────────────────────────────────
def load_agent():
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )

    vectorstore = Chroma(
        persist_directory=DB_PATH,
        embedding_function=embeddings
    )

    llm = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0.2
    )

    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["context", "question"]
    )

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 4}),
        chain_type_kwargs={"prompt": prompt},
        return_source_documents=True
    )

    return qa_chain


# ── Question classifier ───────────────────────────────────────────────────────
def classify_keyword_only(question: str) -> str | None:
    """The zero-cost half of classification: greetings and explicit tour phrasings.

    Extracted so both the old two-call path and the merged router share exactly one
    definition of what can be decided without a model.
    """
    q_lower = question.lower()
    stripped = re.sub(r"[^a-z\s]", "", q_lower).strip()
    greetings = {
        "hi", "hii", "hello", "hey", "yo", "hiya", "howdy", "good morning",
        "good afternoon", "good evening", "thanks", "thank you", "ok", "okay",
        "cool", "nice", "great", "bye", "goodbye", "test",
    }
    if stripped in greetings or (
        len(stripped.split()) <= 2 and stripped in {"how are you", "whats up", "sup"}
    ):
        return "CHAT"

    tour_triggers = ["tour", "guide", "navigate", "how do i use", "show me how",
                     "walk me through", "tutorial", "how to use", "where is the",
                     "where do i find"]
    software_context = ["dashboard", "app", "system", "software", "platform", "admin",
                        "screen", "page", "menu", "button", "tab", "feature", "panel",
                        "widget"]
    if any(k in q_lower for k in tour_triggers) and any(k in q_lower for k in software_context):
        return "TOUR"
    if "dashboard" in q_lower and any(
        k in q_lower for k in ["how", "what", "where", "use", "in the", "overview"]
    ):
        return "TOUR"
    return None


def route_and_select(
    question: str,
    page_context: dict | None = None,
    history: list[tuple[str, str]] | None = None,
) -> dict:
    """Classify the question and pick its tool in a single model call.

    These were two sequential calls to the same model over largely the same context,
    costing about 4.4 s together where one call answers both in about 1.2 s. The
    classification decides whether a tool is needed at all, so nothing is wasted when
    the answer is SOP, TOUR or CHAT.

    Returns ``{"mode": ..., "tool": ..., "params": {...}}``. On any failure it falls
    back to the previous two-call behaviour rather than guessing.
    """
    keyword_mode = classify_keyword_only(question)
    if keyword_mode:
        # Decided on keywords alone; no model was consulted.
        return {"mode": keyword_mode, "tool": None, "params": {}, "used_llm": False}

    prompt = f"""You route questions in a Warehouse Management System (WMS).

Do two things at once: classify the question, and if it is DATA, choose one tool.

CLASSES:
- 'CHAT': greetings, thanks, small talk.
- 'SOP': physical warehouse procedures -- forklifts, safety, damaged goods, cycle counts.
- 'TOUR': how to use the software, where a feature is on screen, navigating the UI.
- 'DATA': stock numbers, orders, analytics, forecasts, reports, and "why" questions
  about a specific material's forecast, stock policy or slotting.

AVAILABLE TOOLS (only for DATA):
{tools_module.tool_menu_description()}

EARLIER IN THIS CONVERSATION:
{format_turns(history or [])}

WHAT THE USER IS CURRENTLY LOOKING AT:
{describe_page_context(page_context) or "(not provided)"}

Use those only to resolve what the question leaves implicit -- "this material",
"that SKU", "and the next one". Anything named explicitly wins.

USER QUESTION:
{question}

Reply with ONLY a JSON object, no markdown fences:
{{"mode": "<CHAT|SOP|TOUR|DATA>", "tool": "<tool_name_or_null>", "params": {{...}}}}
Set "tool" to null for CHAT, SOP and TOUR. Omit parameters you cannot infer."""

    text_out, _ = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
    raw = re.sub(r"^```(?:json)?\s*", "", text_out.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    parsed = json.loads(raw)

    mode = str(parsed.get("mode") or "DATA").upper()
    if mode not in {"CHAT", "SOP", "TOUR", "DATA"}:
        mode = "DATA"
    selection = {"tool": parsed.get("tool"), "params": parsed.get("params") or {},
                 "used_llm": True}
    if mode == "DATA":
        selection = apply_page_context_defaults(selection, page_context)
    else:
        selection = {"tool": None, "params": {}, "used_llm": True}
    return {"mode": mode, **selection}


def classify_question(question: str) -> str:
    """
    Classifies the user's question as:
    - 'SOP': Standard Operating Procedures, instructions, policies, rules, maps.
    - 'DATA': Database numbers, inventory, orders, stock levels, or reports.
    - 'TOUR': Requests for an interactive UI guide or product tour on how to use the admin dashboard.
    """
    q_lower = question.lower()

    # ── Fast-path: greetings and pleasantries ─────────────────────────────
    # Without this the classifier has only SOP, DATA and TOUR to choose from,
    # so "hi" was forced into one of them and launched a dashboard tour.
    stripped = re.sub(r"[^a-z\s]", "", q_lower).strip()
    greetings = {
        "hi", "hii", "hello", "hey", "yo", "hiya", "howdy", "good morning",
        "good afternoon", "good evening", "thanks", "thank you", "ok", "okay",
        "cool", "nice", "great", "bye", "goodbye", "test",
    }
    if stripped in greetings or (len(stripped.split()) <= 2 and stripped in {"how are you", "whats up", "sup"}):
        return "CHAT"

    # ── Fast-path: explicit TOUR keyword combinations ──────────────────────
    tour_triggers = ["tour", "guide", "navigate", "how do i use", "show me how", "walk me through", "tutorial", "how to use", "where is the", "where do i find"]
    software_context = ["dashboard", "app", "system", "software", "platform", "admin", "screen", "page", "menu", "button", "tab", "feature", "panel", "widget"]

    has_tour_word = any(k in q_lower for k in tour_triggers)
    has_software_word = any(k in q_lower for k in software_context)

    # If user asks "how do I use X" about the UI, it's a TOUR
    if has_tour_word and has_software_word:
        return "TOUR"
    # If user explicitly mentions "dashboard" + asking what's in it / how to use
    if "dashboard" in q_lower and any(k in q_lower for k in ["how", "what", "where", "use", "in the", "overview"]):
        return "TOUR"

    try:
        prompt = f"""You are a query classifier for a Warehouse Management System (WMS).
Classify the user question into one of these four classes:
- 'CHAT': greetings, thanks, small talk, or anything that is not actually a request
  about the warehouse or the software. Examples: "hi", "how are you", "thanks".
- 'SOP': Standard Operating Procedures, safety instructions, return policies, operational rules, or physical warehouse locations/equipment.
- 'DATA': Stock numbers, inventory counts, order status, movement logs, analytics, queries about what is in the postgres database tables, or requests to generate reports.
- 'TOUR': Requests for a product tour, UI guide, how to use the software dashboard, how to navigate around the application, where things are on screen, or what features exist in the software.

CRITICAL CLASSIFICATION RULES:
1. If the user asks ANY question about what is in the dashboard, how to use the software, how to navigate, where a feature is on screen, or how the UI works → CLASSIFY AS 'TOUR'.
2. 'SOP' is ONLY for physical warehouse operations (like forklifts, safety, damaged goods, PPT usage, cycle count steps, etc).
3. If the user asks "how do I..." or "where is..." or "what's in the dashboard" about the software → it is 'TOUR', not 'SOP'.
4. Examples:
   - "whats in the dashboard and how to use them" → TOUR
   - "show me how to manage inventory in the app" → TOUR
   - "how to use a forklift safely" → SOP
   - "where is SKU-001 stored physically" → SOP
   - "where is the inventory page" → TOUR
   - "show me inventory count for SKU-001" → DATA

User Question: "{question}"

Answer ONLY with 'SOP', 'DATA', or 'TOUR'. Do not add any explanation or other text."""
        text, _ = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
        res = (text or "").strip().upper()
        if "CHAT" in res:
            return "CHAT"
        elif "TOUR" in res:
            return "TOUR"
        elif "SOP" in res:
            return "SOP"
        elif "DATA" in res:
            return "DATA"
    except AIQuotaExceeded:
        # No provider left. Let the caller answer 429 rather than silently
        # misclassifying via keywords.
        raise
    except Exception as e:
        print(f"Classifier error: {e}")

    # Fallback keyword matching
    if "report" in q_lower or "pdf" in q_lower:
        return "DATA"
    tour_keywords = [
        "tour", "guide", "navigate", "dashboard", "where is", "show me how",
        "walk me through", "tutorial", "how to use", "feature", "screen", "page",
        "button", "menu", "tab", "app", "software", "system"
    ]
    if any(k in q_lower for k in tour_keywords):
        return "TOUR"
    sop_keywords = ["sop", "procedure", "policy", "rule", "step", "safety", "standard", "map", "location", "forklift", "ppt", "pallet", "stacker"]
    if any(k in q_lower for k in sop_keywords):
        return "SOP"
    return "DATA"


# ── Tour ID selection ─────────────────────────────────────────────────────────
# Tour catalog: one line each, doubling as both the LLM's menu description
# and the spoken intro when a tour starts. Keep in sync with the tour IDs
# actually defined in frontend/lib/tours/tourConfig.ts.
TOUR_CATALOG = {
    "dashboard_overview_tour": "General dashboard overview — orders KPI, inventory health, top products. The default when nothing more specific matches.",
    "inventory_management_tour": "Managing inventory and checking stock levels for SKUs/products.",
    "create_inbound_order_tour": "Creating a NEW inbound order (the create wizard specifically, not just viewing orders).",
    "orders_and_shipments_tour": "Viewing/managing orders and shipments in general (inbound, outbound, purchase, delivery).",
    "warehouse_layout_tour": "Warehouse layout, bin/rack locations, zones, the warehouse map.",
    "reports_analytics_tour": "Reports, analytics, KPIs, charts, exporting data.",
    "workforce_tasks_tour": "Workers, labor, task assignment, picking/packing productivity.",
    "sop_help_tour": "SOPs, procedures, policies, safety rules, general help.",
    "forecast_tour": "Demand forecasting, replenishment planning, the forecast chart, and asking why a forecast is high or low.",
}


def _select_tour_id_keyword_fallback(question: str) -> str:
    """Used only if the LLM tour selector is unavailable (quota/network)."""
    q = question.lower()
    if any(k in q for k in ["forecast", "demand plan", "replenishment"]):
        return "forecast_tour"
    if any(k in q for k in ["inventory", "stock", "sku", "item", "product"]):
        return "inventory_management_tour"
    if "inbound" in q and any(
        k in q for k in ["creat", "cretae", "new", "add", "raise", "make", "place", "set up", "setup"]
    ):
        return "create_inbound_order_tour"
    if any(k in q for k in ["order", "inbound", "outbound", "purchase", "shipment", "delivery"]):
        return "orders_and_shipments_tour"
    if any(k in q for k in ["warehouse", "layout", "map", "location", "bin", "rack", "zone", "slot"]):
        return "warehouse_layout_tour"
    if any(k in q for k in ["report", "analytic", "metric", "kpi", "chart", "graph", "pdf", "export"]):
        return "reports_analytics_tour"
    if any(k in q for k in ["worker", "labor", "task", "productivity", "staff", "picking", "packing"]):
        return "workforce_tasks_tour"
    if any(k in q for k in ["sop", "procedure", "policy", "rule", "safety", "help"]):
        return "sop_help_tour"
    return "dashboard_overview_tour"


def select_tour_id(question: str, page_context: dict | None = None) -> str:
    """Pick the tour config ID (frontend/lib/tours/tourConfig.ts) that best
    matches the user's question. LLM-picked from the described catalog above
    rather than hardcoded keyword lists, so it generalizes to phrasing the
    keyword list was never written for — falls back to a keyword heuristic
    only if the LLM is unavailable."""
    menu = "\n".join(f"- {tid}: {desc}" for tid, desc in TOUR_CATALOG.items())
    prompt = f"""Pick the ONE tour that best matches what the user wants to be guided through.

AVAILABLE TOURS:
{menu}

WHAT THE USER IS CURRENTLY LOOKING AT:
{describe_page_context(page_context) or "(not provided)"}

Use that only to resolve references the question leaves implicit, such as "this material",
"this SKU" or "why is it low". If the question names something explicitly, prefer it.

USER QUESTION:
{question}

Respond with ONLY the tour id (exactly as listed above), nothing else."""
    try:
        text_out, _ = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
        tour_id = text_out.strip().strip('"').strip("'")
        if tour_id in TOUR_CATALOG:
            return tour_id
    except AIQuotaExceeded:
        pass
    except Exception as e:
        logger.warning("Tour selection failed, falling back to keyword match: %s", e)
    return _select_tour_id_keyword_fallback(question)


# ── Unified ask function ──────────────────────────────────────────────────────
class TraceRecorder:
    """Records what actually ran, so the UI can show it rather than imply it.

    A chat answer that arrives with no visible working looks like the model made it
    up. Naming the tool, the row count and the elapsed time turns the same answer
    into something a reviewer can follow -- and it makes the fast path's advantage
    visible, because "0 model calls" is the claim the XAI story rests on.
    """

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.started = time.perf_counter()

    def record(self, name: str, kind: str, started: float,
               outcome: str = "ok", detail: str | None = None) -> None:
        entry = {
            "name": name,
            "kind": kind,                     # "tool" | "llm" | "cache"
            "ms": round((time.perf_counter() - started) * 1000),
            "outcome": outcome,
        }
        if detail:
            entry["detail"] = detail
        self.calls.append(entry)

    def summary(self) -> dict:
        return {
            "total_ms": round((time.perf_counter() - self.started) * 1000),
            "llm_calls": sum(1 for c in self.calls if c["kind"] == "llm"),
            "tool_calls": sum(1 for c in self.calls if c["kind"] == "tool"),
        }


def answer_from_stored_evidence(question: str, page_context: dict | None,
                                trace: "TraceRecorder | None" = None) -> dict | None:
    """The fast path: read the stored explanation and return it with no model call.

    Returns a response dict ready to send, or None if this question is not one the
    fast path is confident about -- in which case the caller proceeds normally.

    ``answer`` is left empty and ``narration_pending`` set, so the client can render
    the table and chart at once and fill the sentence in afterwards. The numbers are
    on screen before the assistant has said anything, which is both faster and a
    more honest depiction of where the explanation came from.
    """
    resolved = fast_path.resolve(question, page_context)
    if not resolved:
        return None

    spec = tools_module.TOOL_REGISTRY.get(resolved["tool"])
    if not spec:
        return None

    started = time.perf_counter()
    try:
        df, sql = spec["fn"](get_engine(), **resolved["params"])
        if trace:
            trace.record(resolved["tool"], "tool", started, detail=f"{len(df)} rows")
    except Exception as exc:  # fall through rather than surface a fast-path failure
        logger.warning("fast path %s failed, deferring to normal routing: %s",
                       resolved["tool"], exc)
        return None

    # A single "note" row means the evidence is not there yet (never computed, or an
    # older run). That is a real answer, but not one worth charting.
    only_note = list(df.columns) == ["note"]

    return {
        "mode": "DATA",
        "sql": sql,
        "data": df_records_json_safe(df),
        "chart": None if only_note else generate_chart_spec_checked(df, question),
        "error": None,
        "answer": "",
        "narration_pending": not only_note,
        "evidence_source": resolved["source"],
        "tool": resolved["tool"],
        "fast_path": True,
    }


def narrate_stream(question: str, sql: str, df: pd.DataFrame):
    """Yield the narration incrementally, so the sentence appears as it is written.

    Real token streaming rather than generating fully and then chopping the string:
    the existing forecast-explain endpoint does the latter, which costs the same wait
    and only looks like streaming. Here the first words arrive as soon as the model
    produces them.

    Falls back to a single yielded block if streaming is unavailable, so a caller
    never has to handle two shapes.
    """
    sample = df.head(20).to_string(index=False) if df is not None and not df.empty else "(no data)"
    row_count = 0 if df is None else len(df)
    prompt = f"""You are a warehouse analytics assistant for OptiWMS.

The user asked: "{question}"

The figures below were computed by the warehouse system, not by you. Explain what they
show in clear English -- 3 to 5 sentences. Do not invent numbers that are not present.

{row_count} row(s):
{sample}"""

    try:
        stream = _gemini_client().models.generate_content_stream(
            model="gemini-3.1-flash-lite", contents=prompt
        )
        produced = False
        for chunk in stream:
            piece = getattr(chunk, "text", None)
            if piece:
                produced = True
                yield piece
        if produced:
            return
    except Exception as exc:
        logger.warning("streaming narration unavailable (%s); falling back", type(exc).__name__)

    try:
        text_out, _ = _generate_content_with_fallback(prompt)
        if text_out:
            yield text_out
    except AIQuotaExceeded:
        yield ("I could not write a summary just now, but the figures above are "
               "complete and were computed by the warehouse system.")


def stream_answer(question: str, page_context: dict | None = None,
                  session_id: str | None = None):
    """Answer as a sequence of events: the evidence first, then the prose.

    The point of the ordering is that the numbers are on screen before any model has
    spoken. On the fast path that happens in about 200ms, and the narration that
    follows is visibly a commentary on figures the user can already see rather than
    the source of them.
    """
    trace = TraceRecorder()

    quick = answer_from_stored_evidence(question, page_context, trace)
    if quick is not None:
        yield {
            "type": "frame",
            "mode": "DATA",
            "data": quick["data"],
            "chart": quick["chart"],
            "sql": quick["sql"],
            "evidenceSource": quick.get("evidence_source"),
            "fastPath": True,
            "toolCalls": trace.calls,
            "timings": trace.summary(),
        }
        if quick.get("narration_pending"):
            frame = pd.DataFrame(quick["data"])
            for piece in narrate_stream(question, quick["sql"], frame):
                yield {"type": "token", "text": piece}
        yield {"type": "done", "timings": trace.summary()}
        return

    # Not a stored-evidence question: fall back to the ordinary single-shot answer
    # and emit it as one frame, so the client only implements one protocol.
    result = ask(None, question, session_id=session_id, page_context=page_context)
    yield {
        "type": "frame",
        "mode": result.get("mode"),
        "data": result.get("data"),
        "chart": result.get("chart"),
        "sql": result.get("sql"),
        "sources": result.get("sources"),
        "action": result.get("action"),
        "tourId": result.get("tourId"),
        "toolCalls": result.get("toolCalls"),
        "timings": result.get("timings"),
    }
    if result.get("answer"):
        yield {"type": "token", "text": result["answer"]}
    yield {"type": "done", "timings": result.get("timings") or {}}


def ask(chain, question: str, user_id: str = None, session_id: str = None, mode: str = None,
        page_context: dict | None = None, preselected: dict | None = None) -> dict:
    # The API layer classifies first so it can apply role checks before any SQL
    # runs. It passes the result back here to avoid a second classifier call.
    trace = TraceRecorder()

    # Before anything else: if the page pins down a decision and the question asks
    # why, the stored evidence answers it directly -- no classification, no routing.
    fast_result = None
    if mode in (None, "DATA"):
        fast_result = answer_from_stored_evidence(question, page_context, trace)

    history = recent_turns(session_id)
    if mode is None:
        _t = time.perf_counter()
        routed = route_and_select(question, page_context, history)
        trace.record("route_and_select",
                     "llm" if routed.get("used_llm") else "rule",
                     _t, detail=routed.get("mode"))
        mode, preselected = routed["mode"], {"tool": routed["tool"], "params": routed["params"]}

    if fast_result is not None:
        # The fast path answered. It still goes through the shared tail below so the
        # turn is persisted -- otherwise it has no session id, which silently broke
        # two things: "Full screen" had nothing to hand over and started a new chat,
        # and the explanation never entered the history that later turns read.
        res = fast_result
    elif mode == "CHAT":
        res = {
            "mode": "CHAT",
            "answer": (
                "Hello. I can help with three things:\n\n"
                "- **Warehouse data** — stock levels, order status, movement history, "
                "and PDF reports.\n"
                "- **SOPs** — safety and operating procedures, answered with citations.\n"
                "- **Guided tours** — I can walk you around a screen if you ask how to "
                "use something.\n\n"
                "What would you like to look at?"
            ),
        }
    elif mode == "TOUR":
        tour_id = select_tour_id(question, page_context)
        tour_intros = {
            "inventory_management_tour": "Let me show you how to manage inventory and check stock levels.",
            "create_inbound_order_tour": "Let me show you how to create a new inbound order.",
            "orders_and_shipments_tour": "Let me walk you through managing orders and shipments.",
            "warehouse_layout_tour": "Let me guide you around the warehouse layout and locations.",
            "reports_analytics_tour": "Let me show you the analytics and reporting features.",
            "workforce_tasks_tour": "Let me walk you through workers and task management.",
            "sop_help_tour": "Let me show you where to find SOPs and help resources.",
            "forecast_tour": "Let me show you the demand forecasting and replenishment planning tools.",
            "dashboard_overview_tour": "Let me give you a quick tour of the dashboard and main features.",
        }
        intro = tour_intros.get(tour_id, tour_intros["dashboard_overview_tour"])
        res = {
            "mode": "TOUR",
            "answer": f"{intro} Starting the interactive tour now — just follow the highlighted steps on your screen.",
            "action": "START_TOUR",
            "tourId": tour_id
        }
    elif mode == "SOP" and chain is None:
        # No retriever available (chain failed to load, or a caller passed none).
        # Saying so beats an AttributeError from inside the chain.
        res = {
            "mode": "SOP",
            "answer": ("I could not reach the procedure index just now, so I cannot "
                       "answer that from the SOPs. Please try again shortly."),
            "sources": [],
            "error": "sop_index_unavailable",
        }
    elif mode == "SOP":
        try:
            result = chain.invoke({"query": question})
            answer = result["result"]
            source_docs = result["source_documents"]
        except Exception as exc:
            if not _groq_configured():
                raise
            # Retrieval is local (Chroma); only generation needs a model. Pull the
            # same context and answer with the fallback provider.
            logger.warning("Gemini unavailable on SOP chain: %s. Falling back to Groq.", exc)
            source_docs = chain.retriever.invoke(question)
            context = "\n\n".join(doc.page_content for doc in source_docs)
            answer, _ = _generate_content_with_fallback(
                PROMPT_TEMPLATE.format(context=context, question=question)
            )
        sources = list(set([
            doc.metadata.get("title") or doc.metadata.get("source") or os.path.basename(doc.metadata.get("source", "Unknown"))
            for doc in source_docs
        ]))
        res = {
            "mode": "SOP",
            "answer": answer,
            "sources": sources
        }
    else:
        df, sql, chart, error, answer, download_url = ask_database(
            question, page_context, history, preselected, trace)
        data = df_records_json_safe(df) if df is not None else None
        res = {
            "mode": "DATA",
            "sql": sql,
            "data": data,
            "chart": chart,
            "error": error,
            "answer": answer,
            "download_url": download_url
        }

    # ── Database Persistence ──────────────────────────────────────────────────
    if user_id:
        try:
            with get_db_session() as db:
                # 1. Resolve or create ChatSession
                if not session_id:
                    title = question[:80] + "..." if len(question) > 80 else question
                    session = ChatSession(user_id=user_id, title=title)
                    db.add(session)
                    db.commit()
                    db.refresh(session)
                    session_id = session.id
                else:
                    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
                    if not session:
                        title = question[:80] + "..." if len(question) > 80 else question
                        session = ChatSession(id=session_id, user_id=user_id, title=title)
                        db.add(session)
                        db.commit()

                # 2. Save User Message
                user_msg = ChatMessage(
                    session_id=session_id,
                    sender="user",
                    text_content=question
                )
                db.add(user_msg)

                # 3. Save AI Message
                ai_text = res.get("error") if res.get("error") else res.get("answer", "")
                if not ai_text and res.get("data"):
                    # A fast-path explanation carries its answer in the table, not in
                    # prose. Storing an empty turn would leave the next question with
                    # no idea what was just explained, so record the drivers.
                    rows = res["data"][:4]
                    first_key = next(iter(rows[0]), None) if rows else None
                    if first_key:
                        named = ", ".join(str(r.get(first_key)) for r in rows)
                        ai_text = f"Explained with stored evidence. Top factors: {named}."
                if not ai_text and res.get("data"):
                    # A fast-path explanation carries its answer in the table, not in
                    # prose. Storing an empty turn would leave the next question with
                    # no idea what was just explained, so record the drivers.
                    rows = res["data"][:4]
                    first_key = next(iter(rows[0]), None) if rows else None
                    if first_key:
                        named = ", ".join(str(r.get(first_key)) for r in rows)
                        ai_text = f"Explained with stored evidence. Top factors: {named}."
                ai_metadata = {
                    "mode": res.get("mode"),
                    "sources": res.get("sources"),
                    "sql": res.get("sql"),
                    "data": res.get("data"),
                    "chart": res.get("chart"),
                    "error": res.get("error"),
                    "download_url": res.get("download_url"),
                    "action": res.get("action"),
                    "tourId": res.get("tourId")
                }
                ai_msg = ChatMessage(
                    session_id=session_id,
                    sender="ai",
                    text_content=ai_text,
                    chat_metadata=ai_metadata
                )
                db.add(ai_msg)
                db.commit()
                res["session_id"] = session_id
        except Exception as db_err:
            print(f"Failed to persist chat history: {db_err}")

    # What ran, and how long it took. Attached last so every branch carries it.
    res.setdefault("toolCalls", trace.calls)
    res.setdefault("timings", trace.summary())
    return res
