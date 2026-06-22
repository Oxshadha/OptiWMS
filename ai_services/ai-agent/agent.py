import os
import re
import io
import json
import uuid
import time
import base64
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

# Langchain / SOP Q&A
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
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
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

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
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5434")
DB_NAME     = os.getenv("DB_NAME", "optiwms")
DB_USER     = os.getenv("DB_USER", "optiwms")
DB_PASSWORD = os.getenv("DB_PASSWORD", "optiwms")
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

# ── Colour palette ────────────────────────────────────────────────────────────
_NAVY   = colors.HexColor("#0F1E3C")   # primary headings / header bar
_INDIGO = colors.HexColor("#3B4FD9")   # accent / links
_SLATE  = colors.HexColor("#4B5563")   # body text
_MUTED  = colors.HexColor("#9CA3AF")   # captions / footers
_LIGHT  = colors.HexColor("#F1F5F9")   # table zebra rows
_WHITE  = colors.white

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


# ── Mode detection ────────────────────────────────────────────────────────────
def is_report_request(question: str) -> bool:
    q = question.lower()
    has_report = "report" in q or "pdf" in q
    has_action = any(act in q for act in ["generate", "create", "download", "export", "make", "build"])
    return has_report and has_action


# ── Chart generation (base64 image) ──────────────────────────────────────────
def generate_chart(df: pd.DataFrame) -> str | None:
    if df is None or df.empty or len(df) < 2:
        return None

    sns.set_theme(style="whitegrid")
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
        if c not in numeric_cols and df_display[c].nunique() <= min(len(df_display), 50)
    ]

    fig, ax = plt.subplots(figsize=(10, 5))

    try:
        date_cols = [c for c in df_display.columns if pd.api.types.is_datetime64_any_dtype(df_display[c])]

        if date_cols and numeric_cols:
            date_col, metric_col = date_cols[0], numeric_cols[0]
            df_plot = df_display.dropna(subset=[date_col, metric_col])
            if len(df_plot) >= 2:
                sns.lineplot(
                    data=df_plot.sort_values(by=date_col),
                    x=date_col, y=metric_col, marker="o", ax=ax,
                    color="#3B4FD9",
                )
                ax.set_title(f"{metric_col} over time", fontsize=13, color="#0F1E3C", pad=12)
                ax.set_xlabel(date_col); ax.set_ylabel(metric_col)
                ax.xaxis.set_tick_params(rotation=45)
                plt.tight_layout()
                return _fig_to_b64(fig)

        if cat_cols and numeric_cols:
            cat_col, metric_col = cat_cols[0], numeric_cols[0]
            df_plot = df_display[[cat_col, metric_col]].dropna()
            if len(df_plot) >= 2:
                if df_plot[cat_col].nunique() > 15:
                    df_plot = (
                        df_plot.groupby(cat_col, as_index=False)[metric_col]
                        .sum()
                        .nlargest(15, metric_col)
                    )
                sns.barplot(
                    data=df_plot, x=cat_col, y=metric_col, ax=ax,
                    color="#3B4FD9",
                )
                ax.set_title(f"{metric_col} by {cat_col}", fontsize=13, color="#0F1E3C", pad=12)
                ax.set_xlabel(cat_col); ax.set_ylabel(metric_col)
                ax.xaxis.set_tick_params(rotation=45)
                plt.tight_layout()
                return _fig_to_b64(fig)

        if len(numeric_cols) >= 1:
            metric_col = numeric_cols[0]
            df_plot = df_display[metric_col].dropna()
            if len(df_plot) >= 5:
                sns.histplot(data=df_plot, kde=True, ax=ax, color="#3B4FD9")
                ax.set_title(f"Distribution of {metric_col}", fontsize=13, color="#0F1E3C", pad=12)
                ax.set_xlabel(metric_col); ax.set_ylabel("Count")
                plt.tight_layout()
                return _fig_to_b64(fig)

    except Exception as exc:
        print(f"Chart generation failed: {exc}")
    finally:
        plt.close(fig)

    return None


def _fig_to_b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return "data:image/png;base64," + base64.b64encode(buf.read()).decode("utf-8")


def _fig_to_bytes(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


# ── SQL generation ────────────────────────────────────────────────────────────
def generate_sql(question: str, schema: str) -> str:
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    prompt = f"""You are a SQL expert for a Warehouse Management System (WMS) using PostgreSQL.

Given the database schema below, write a SQL SELECT query to answer the user's question.
Return ONLY the SQL query inside a ```sql code block. No explanation.
Use proper table aliases. Limit results to 500 rows maximum.

DATABASE SCHEMA:
{schema}

USER QUESTION:
{question}

SQL QUERY:"""
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=prompt,
    )
    return extract_sql(response.text)


# ── Mode 1: Conversational summary ───────────────────────────────────────────
def generate_conversational_answer(question: str, sql: str, df: pd.DataFrame) -> str:
    """Ask Gemini to summarise the query results in clear, natural English."""
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

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

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=prompt,
    )
    return response.text.strip()


# ── Mode 2: Report JSON schema generation ────────────────────────────────────
def generate_report_json(question: str, sql: str, df: pd.DataFrame) -> dict:
    """Ask Gemini to produce a structured report JSON object from the query results."""
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

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

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=prompt,
    )

    raw = response.text.strip()
    # Strip markdown fences if model added them anyway
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


# ── PDF builder ───────────────────────────────────────────────────────────────
def build_pdf_report(report: dict, df: pd.DataFrame | None) -> Path:
    """Render the report dict into a premium PDF and return its file path."""

    file_name = report.get("file_name") or f"warehouse_report_{uuid.uuid4().hex[:8]}.pdf"
    if not file_name.endswith(".pdf"):
        file_name += ".pdf"
    out_path = REPORTS_DIR / file_name

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()

    # ── Custom paragraph styles ───────────────────────────────────────────────
    s_title = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=_WHITE,
        spaceAfter=4,
        alignment=TA_LEFT,
        fontName="Helvetica-Bold",
    )
    s_subtitle = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#CBD5E1"),
        spaceAfter=0,
        alignment=TA_LEFT,
        fontName="Helvetica",
    )
    s_meta = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontSize=8,
        textColor=_MUTED,
        spaceAfter=0,
        alignment=TA_RIGHT,
        fontName="Helvetica",
    )
    s_h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=_NAVY,
        spaceBefore=14,
        spaceAfter=4,
        fontName="Helvetica-Bold",
        borderPad=0,
    )
    s_body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        textColor=_SLATE,
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
        textColor=_MUTED,
        alignment=TA_CENTER,
        fontName="Helvetica-Oblique",
        spaceAfter=4,
    )
    s_footer = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=_MUTED,
        alignment=TA_CENTER,
        fontName="Helvetica",
    )

    story = []

    # ── Header banner ─────────────────────────────────────────────────────────
    header_data = [[
        Paragraph(report.get("title", "Warehouse Report"), s_title),
        Paragraph(report.get("generated_at", ""), s_meta),
    ]]
    header_table = Table(header_data, colWidths=[13 * cm, 4.5 * cm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), _NAVY),
        ("TOPPADDING",   (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 18),
        ("LEFTPADDING",  (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    story.append(header_table)

    # Subtitle row
    if report.get("subtitle"):
        sub_data = [[Paragraph(report["subtitle"], s_subtitle)]]
        sub_table = Table(sub_data, colWidths=[17.5 * cm])
        sub_table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), _NAVY),
            ("TOPPADDING",   (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 14),
            ("LEFTPADDING",  (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ]))
        story.append(sub_table)

    story.append(Spacer(1, 0.5 * cm))

    # ── Summary ───────────────────────────────────────────────────────────────
    if report.get("summary"):
        story.append(Paragraph("Executive Summary", s_h2))
        story.append(HRFlowable(width="100%", thickness=1, color=_INDIGO, spaceAfter=6))
        story.append(Paragraph(report["summary"], s_body))

    # ── Sections ──────────────────────────────────────────────────────────────
    for section in report.get("sections", []):
        story.append(Paragraph(section.get("heading", ""), s_h2))
        story.append(HRFlowable(width="100%", thickness=0.5, color=_LIGHT, spaceAfter=4))
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
        story.append(HRFlowable(width="100%", thickness=0.5, color=_LIGHT, spaceAfter=6))

        header_row = [Paragraph(f"<b>{c}</b>", s_body) for c in columns]
        data_rows = [
            [Paragraph(str(cell), s_body) for cell in row]
            for row in rows[:15]
        ]
        table_data = [header_row] + data_rows

        col_width = 17.5 * cm / max(len(columns), 1)
        tbl_widget = Table(table_data, colWidths=[col_width] * len(columns), repeatRows=1)

        tbl_style = [
            ("BACKGROUND",   (0, 0), (-1, 0), _NAVY),
            ("TEXTCOLOR",    (0, 0), (-1, 0), _WHITE),
            ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, 0), 9),
            ("TOPPADDING",   (0, 0), (-1, 0), 8),
            ("BOTTOMPADDING",(0, 0), (-1, 0), 8),
            ("GRID",         (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ("FONTSIZE",     (0, 1), (-1, -1), 9),
            ("TOPPADDING",   (0, 1), (-1, -1), 5),
            ("BOTTOMPADDING",(0, 1), (-1, -1), 5),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [_WHITE, _LIGHT]),
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
            story.append(HRFlowable(width="100%", thickness=0.5, color=_LIGHT, spaceAfter=6))
            img = RLImage(io.BytesIO(chart_bytes), width=16 * cm, height=8 * cm)
            story.append(img)
            story.append(Paragraph("Auto-generated chart from query results.", s_caption))
            charts_added += 1

    # Additional charts from report spec
    for chart_spec in report.get("charts", []):
        chart_bytes = _build_chart_bytes_from_spec(chart_spec)
        if chart_bytes:
            story.append(Paragraph(chart_spec.get("title", "Chart"), s_h2))
            story.append(HRFlowable(width="100%", thickness=0.5, color=_LIGHT, spaceAfter=6))
            img = RLImage(io.BytesIO(chart_bytes), width=16 * cm, height=8 * cm)
            story.append(img)
            charts_added += 1

    # ── Key Insights ──────────────────────────────────────────────────────────
    insights = report.get("key_insights", [])
    if insights:
        story.append(Paragraph("Key Insights", s_h2))
        story.append(HRFlowable(width="100%", thickness=1, color=_INDIGO, spaceAfter=6))
        for insight in insights:
            story.append(Paragraph(f"• {insight}", s_bullet))
        story.append(Spacer(1, 0.3 * cm))

    # ── Recommendations ───────────────────────────────────────────────────────
    recs = report.get("recommendations", [])
    if recs:
        story.append(Paragraph("Recommendations", s_h2))
        story.append(HRFlowable(width="100%", thickness=1, color=_INDIGO, spaceAfter=6))
        for i, rec in enumerate(recs, 1):
            story.append(Paragraph(f"{i}. {rec}", s_bullet))
        story.append(Spacer(1, 0.3 * cm))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_MUTED, spaceAfter=4))
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
    cat_cols = [c for c in df_display.columns if c not in numeric_cols and df_display[c].nunique() <= 30]

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
                             marker="o", ax=ax, color="#3B4FD9")
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
                sns.barplot(data=df_plot, x=cat_col, y=metric_col, ax=ax, color="#3B4FD9")
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
            ax.plot(x_labels, y_values, marker="o", color="#3B4FD9")
            ax.xaxis.set_tick_params(rotation=45)
        else:  # bar (default)
            ax.bar(x_labels, y_values, color="#3B4FD9")
            ax.xaxis.set_tick_params(rotation=45)

        ax.set_title(title, fontsize=13, color="#0F1E3C", pad=12)
        plt.tight_layout()
        return _fig_to_bytes(fig)
    except Exception as exc:
        print(f"Spec chart generation failed: {exc}")
        plt.close(fig)
        return None


# ── Database analytics ask_database ──────────────────────────────────────────
def ask_database(question: str):
    """
    Returns (df, sql, chart, error, answer, download_url)

    - In Conversational Mode: df, sql, chart, error, answer (natural text), None
    - In Report Mode:         None, sql, None, error, answer (with link), download_url
    """
    engine = get_engine()
    schema = get_schema_description(engine)
    report_mode = is_report_request(question)

    # ── Generate SQL ──────────────────────────────────────────────────────────
    try:
        sql = generate_sql(question, schema)
    except ResourceExhausted:
        return None, None, None, (
            "Google Gemini quota exhausted. Check your project billing and usage."
        ), None, None
    except Exception as e:
        return None, None, None, f"Failed to generate SQL: {str(e)}", None, None

    if not sql:
        return None, None, None, "I couldn't generate a valid SQL query for that question.", None, None

    if not is_safe_query(sql):
        return None, sql, None, "I only run SELECT queries for safety. Please ask a read-only question.", None, None

    # ── Execute SQL ───────────────────────────────────────────────────────────
    try:
        with engine.connect() as conn:
            df = pd.read_sql(text(sql), conn)
    except Exception as e:
        return None, sql, None, f"Query failed: {str(e)}", None, None

    # ── Mode 2: Report Generation ─────────────────────────────────────────────
    if report_mode:
        try:
            report_json = generate_report_json(question, sql, df)
            pdf_path = build_pdf_report(report_json, df)
            file_name = pdf_path.name
            download_url = f"/download/{file_name}"
            answer = f"Your report **\"{report_json.get('title', 'Warehouse Report')}\"** is ready!"
            return None, sql, None, None, answer, download_url
        except Exception as e:
            return None, sql, None, f"Report generation failed: {str(e)}", None, None

    # ── Mode 1: Conversational ────────────────────────────────────────────────
    chart = generate_chart(df)
    try:
        answer = generate_conversational_answer(question, sql, df)
    except Exception:
        answer = ""

    return df, sql, chart, None, answer, None


# ── RAG / SOP agent load ──────────────────────────────────────────────────────
def load_agent():
    embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

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
    """
    try:
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        prompt = f"""You are a query classifier for a Warehouse Management System (WMS).
Classify the user question into one of these two classes:
- 'SOP': Standard Operating Procedures, how-to guidelines, safety instructions, return policies, damaged product flows, operational rules, or locations of items in a static map context.
- 'DATA': Stock numbers, inventory counts, order status, movement logs, analytics, queries about what is in the postgres database tables, or requests to generate/create/download reports.

User Question: "{question}"

Answer ONLY with 'SOP' or 'DATA'. Do not add any explanation or other text."""
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
        )
        res = response.text.strip().upper()
        if "SOP" in res:
            return "SOP"
        elif "DATA" in res:
            return "DATA"
    except Exception as e:
        print(f"Classifier error: {e}")

    # Fallback keyword matching
    q_lower = question.lower()
    if "report" in q_lower or "pdf" in q_lower:
        return "DATA"
    sop_keywords = ["sop", "procedure", "how to", "policy", "rule", "step", "guide", "safety", "standard", "map", "location"]
    if any(k in q_lower for k in sop_keywords):
        return "SOP"
    return "DATA"


# ── Unified ask function ──────────────────────────────────────────────────────
def ask(chain, question: str, user_id: str = None, session_id: str = None) -> dict:
    mode = classify_question(question)

    if mode == "SOP":
        result = chain.invoke({"query": question})
        answer = result["result"]
        sources = list(set([
            os.path.basename(doc.metadata["source"])
            for doc in result["source_documents"]
        ]))
        res = {
            "mode": "SOP",
            "answer": answer,
            "sources": sources
        }
    else:
        df, sql, chart, error, answer, download_url = ask_database(question)
        data = df.to_dict(orient="records") if df is not None else None
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
                    "download_url": res.get("download_url")
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
