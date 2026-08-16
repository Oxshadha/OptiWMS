import os
import re
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
from google import genai
from google.api_core.exceptions import ResourceExhausted

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns

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
DB_PATH = "db"

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

def get_engine():
    return create_engine(DATABASE_URL)

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
def is_safe_query(sql: str) -> bool:
    sql_upper = sql.strip().upper()
    forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "CREATE"]
    if not sql_upper.startswith("SELECT"):
        return False
    for word in forbidden:
        if re.search(r'\b' + word + r'\b', sql_upper):
            return False
    return True


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


def _fig_to_bytes(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


# ── Provider quota handling and Groq fallback ────────────────────────────────
logger = logging.getLogger("optiwms.agent")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
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
                json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}]},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        if _is_quota_error(exc):
            raise AIQuotaExceeded("Both Gemini and Groq are rate limited right now.") from exc
        raise


def _groq_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


def _generate_content_with_fallback(prompt: str, model: str = "gemini-3.1-flash-lite") -> tuple[str, bool]:
    """Return (text, used_fallback).

    Falls back to Groq whenever Gemini cannot answer and a Groq key is set --
    quota exhaustion, an invalid/revoked key, or the service being unreachable.
    The reason is always logged so a broken Gemini key stays visible rather than
    being silently masked by the fallback.
    """
    try:
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        response = client.models.generate_content(model=model, contents=prompt)
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
def select_tool(question: str) -> dict:
    """Ask the LLM to pick a tool from the fixed menu (or none). The LLM only
    ever sees tool names/descriptions/params here — never the DB schema —
    so it cannot influence what SQL actually runs, only which pre-written
    query executes and with what parameter values."""
    prompt = f"""You are a routing assistant for a Warehouse Management System (WMS) data assistant.

Given the list of available tools below, decide which ONE tool (if any) best answers the user's question,
and extract its parameter values from the question. If no tool fits, return "tool": null.

AVAILABLE TOOLS:
{tools_module.tool_menu_description()}

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
        return parsed
    except Exception:
        return {"tool": None, "params": {}}


# ── SQL generation (adhoc fallback — only used when no tool matches) ─────────
def generate_sql(question: str, schema: str) -> tuple[str, bool]:
    prompt = f"""You are a SQL expert for a Warehouse Management System (WMS) using PostgreSQL.

Given the database schema below, write a SQL SELECT query to answer the user's question.
Return ONLY the SQL query inside a ```sql code block. No explanation.
Use proper table aliases. Limit results to 500 rows maximum.

DATABASE SCHEMA:
{schema}

USER QUESTION:
{question}

SQL QUERY:"""
    text, fallback = _generate_content_with_fallback(prompt, "gemini-3.1-flash-lite")
    return extract_sql(text), fallback


# ── Mode 1: Conversational summary ───────────────────────────────────────────
def generate_conversational_answer(question: str, sql: str, df: pd.DataFrame) -> tuple[str, bool]:
    """Ask Gemini to summarise the query results in clear, natural English."""
    # Build a compact data sample for the prompt (max 20 rows)
    if df is not None and not df.empty:
        sample = df.head(20).to_string(index=False)
        row_count = len(df)
    else:
        sample = "(no data returned)"
        row_count = 0

    prompt = f"""You are a helpful warehouse analytics assistant for OptiWMS.

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
      "type": "line | bar | pie",
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
        if chart_type == "pie":
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


def _finish_data_response(question: str, sql: str, df: pd.DataFrame, report_mode: bool, fallback_used: bool):
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

    chart = generate_chart_spec(df)
    try:
        answer, conv_fb = generate_conversational_answer(question, sql, df)
        fallback_used = fallback_used or conv_fb
        if fallback_used and answer:
            answer += "\n\n*(Note: Gemini API quota reached. Answer generated using Groq fallback.)*"
    except Exception:
        answer = ""

    return df, sql, chart, None, answer, None


def _ask_database_adhoc(question: str, engine, report_mode: bool):
    """Last-resort path when no guarded tool matches: generate free-form SQL
    against the schema, same as before. Still SELECT-only and
    allowlist-checked."""
    schema = get_schema_description(engine)
    fallback_used = False

    try:
        sql, sql_fb = generate_sql(question, schema)
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

    try:
        with engine.connect() as conn:
            df = pd.read_sql(text(sql), conn)
    except Exception as e:
        return None, sql, None, f"Query failed: {str(e)}", None, None

    return _finish_data_response(question, sql, df, report_mode, fallback_used)


# ── Database analytics ask_database ──────────────────────────────────────────
def ask_database(question: str):
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

    # ── Guarded tool selection ────────────────────────────────────────────
    try:
        selection = select_tool(question)
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
            df, sql = fn(engine, **params)
            return _finish_data_response(question, sql, df, report_mode, fallback_used=False)
        except AIQuotaExceeded:
            raise
        except Exception as e:
            logger.warning("Tool '%s' failed, falling back to adhoc SQL: %s", tool_name, e)

    # ── Adhoc fallback ─────────────────────────────────────────────────────
    return _ask_database_adhoc(question, engine, report_mode)


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


def select_tour_id(question: str) -> str:
    """Pick the tour config ID (frontend/lib/tours/tourConfig.ts) that best
    matches the user's question. LLM-picked from the described catalog above
    rather than hardcoded keyword lists, so it generalizes to phrasing the
    keyword list was never written for — falls back to a keyword heuristic
    only if the LLM is unavailable."""
    menu = "\n".join(f"- {tid}: {desc}" for tid, desc in TOUR_CATALOG.items())
    prompt = f"""Pick the ONE tour that best matches what the user wants to be guided through.

AVAILABLE TOURS:
{menu}

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
def ask(chain, question: str, user_id: str = None, session_id: str = None, mode: str = None) -> dict:
    # The API layer classifies first so it can apply role checks before any SQL
    # runs. It passes the result back here to avoid a second classifier call.
    mode = mode or classify_question(question)

    if mode == "CHAT":
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
        tour_id = select_tour_id(question)
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
        df, sql, chart, error, answer, download_url = ask_database(question)
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

    return res
