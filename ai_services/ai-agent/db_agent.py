import base64
import io
import os
import re
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect
from google import genai
from google.api_core.exceptions import ResourceExhausted
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

load_dotenv()

# --- Database connection ---
# Default values match the local Docker Compose DB in infra/docker-compose.yml
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5434")
DB_NAME = os.getenv("DB_NAME", "optiwms")
DB_USER = os.getenv("DB_USER", "optiwms")
DB_PASSWORD = os.getenv("DB_PASSWORD", "optiwms")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def get_engine():
    return create_engine(DATABASE_URL)

# --- Cache schema to avoid repeated inspections ---
_schema_cache = {}

def get_schema_description(engine):
    global _schema_cache
    db_url = str(engine.url)
    
    # Return cached schema if available
    if db_url in _schema_cache:
        return _schema_cache[db_url]
    
    # Inspect and cache schema
    inspector = inspect(engine)
    schema_lines = []
    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        col_info = ", ".join([f"{c['name']} ({str(c['type'])})" for c in columns])
        schema_lines.append(f"Table: {table_name}\n  Columns: {col_info}")
    
    schema_description = "\n\n".join(schema_lines)
    _schema_cache[db_url] = schema_description
    return schema_description

# --- Safety check: only allow SELECT ---
def is_safe_query(sql: str) -> bool:
    sql_upper = sql.strip().upper()
    forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "CREATE"]
    if not sql_upper.startswith("SELECT"):
        return False
    for word in forbidden:
        if re.search(r'\b' + word + r'\b', sql_upper):
            return False
    return True

# --- Extract SQL from Gemini's response ---
def extract_sql(text: str) -> str:
    # Handle ```sql ... ``` code blocks
    match = re.search(r"```(?:sql)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Fallback: find first SELECT statement
    match = re.search(r"(SELECT\s.+?)(?:;|$)", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""

def generate_chart(df: pd.DataFrame) -> str | None:
    if df is None or df.empty or len(df) < 2:
        return None

    sns.set_theme(style="whitegrid")
    df_display = df.copy()

    # Convert potential date columns
    for col in df_display.columns:
        if "date" in col.lower() or pd.api.types.is_datetime64_any_dtype(df_display[col]):
            try:
                df_display[col] = pd.to_datetime(df_display[col], errors="coerce")
            except:
                pass

    # Get numeric columns
    numeric_cols = df_display.select_dtypes(include=["number"]).columns.tolist()
    if not numeric_cols:
        return None

    # Get potential categorical columns (more lenient)
    cat_cols = [c for c in df_display.columns if c not in numeric_cols and df_display[c].nunique() <= min(len(df_display), 50)]

    fig, ax = plt.subplots(figsize=(10, 5))

    try:
        # Priority 1: Time series (date + numeric)
        date_cols = [c for c in df_display.columns if pd.api.types.is_datetime64_any_dtype(df_display[c])]
        if date_cols and numeric_cols:
            date_col = date_cols[0]
            metric_col = numeric_cols[0]
            df_plot = df_display.dropna(subset=[date_col, metric_col])
            if len(df_plot) >= 2:
                sns.lineplot(data=df_plot.sort_values(by=date_col), x=date_col, y=metric_col, marker="o", ax=ax)
                ax.set_title(f"{metric_col} over time")
                ax.set_xlabel(date_col)
                ax.set_ylabel(metric_col)
                ax.xaxis.set_tick_params(rotation=45)
                plt.tight_layout()
                buffer = io.BytesIO()
                fig.savefig(buffer, format="png", dpi=150)
                plt.close(fig)
                buffer.seek(0)
                return "data:image/png;base64," + base64.b64encode(buffer.read()).decode("utf-8")

        # Priority 2: Categorical comparison (categorical + numeric)
        if cat_cols and numeric_cols:
            cat_col = cat_cols[0]
            metric_col = numeric_cols[0]
            df_plot = df_display[[cat_col, metric_col]].dropna()
            if len(df_plot) >= 2:
                # Group and aggregate if too many categories
                if df_plot[cat_col].nunique() > 15:
                    df_plot = df_plot.groupby(cat_col, as_index=False)[metric_col].sum().nlargest(15, metric_col)
                sns.barplot(data=df_plot, x=cat_col, y=metric_col, ax=ax)
                ax.set_title(f"{metric_col} by {cat_col}")
                ax.set_xlabel(cat_col)
                ax.set_ylabel(metric_col)
                ax.xaxis.set_tick_params(rotation=45)
                plt.tight_layout()
                buffer = io.BytesIO()
                fig.savefig(buffer, format="png", dpi=150)
                plt.close(fig)
                buffer.seek(0)
                return "data:image/png;base64," + base64.b64encode(buffer.read()).decode("utf-8")

        # Priority 3: Distribution (single numeric column)
        if len(numeric_cols) >= 1:
            metric_col = numeric_cols[0]
            df_plot = df_display[metric_col].dropna()
            if len(df_plot) >= 5:
                sns.histplot(data=df_plot, kde=True, ax=ax)
                ax.set_title(f"Distribution of {metric_col}")
                ax.set_xlabel(metric_col)
                ax.set_ylabel("Count")
                plt.tight_layout()
                buffer = io.BytesIO()
                fig.savefig(buffer, format="png", dpi=150)
                plt.close(fig)
                buffer.seek(0)
                return "data:image/png;base64," + base64.b64encode(buffer.read()).decode("utf-8")

    except Exception as exc:
        plt.close(fig)
        print(f"Chart generation failed: {exc}")
        return None

    plt.close(fig)
    return None

# --- Generate SQL using Gemini ---
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

# --- Run the full pipeline ---
def ask_database(question: str):
    engine = get_engine()
    schema = get_schema_description(engine)

    try:
        sql = generate_sql(question, schema)
    except ResourceExhausted:
        return None, None, None, (
            "Google Gemini quota exhausted. Check your project billing and usage, "
            "and make sure your API key has quota for gemini-3.1-flash-lite."
        )
    except Exception as e:
        return None, None, None, f"Failed to generate SQL: {str(e)}"

    if not sql:
        return None, None, None, "I couldn't generate a valid SQL query for that question."

    if not is_safe_query(sql):
        return None, sql, None, "I only run SELECT queries for safety. Please ask a read-only question."

    try:
        with engine.connect() as conn:
            df = pd.read_sql(text(sql), conn)
        chart = generate_chart(df)
        return df, sql, chart, None
    except Exception as e:
        return None, sql, None, f"Query failed: {str(e)}"


def run_sql(sql: str):
    """Execute a provided SQL query safely and return dataframe and chart."""
    engine = get_engine()

    if not is_safe_query(sql):
        return None, None, "I only run read-only SELECT queries for safety."

    try:
        with engine.connect() as conn:
            df = pd.read_sql(text(sql), conn)
        chart = generate_chart(df)
        return df, chart, None
    except Exception as e:
        return None, None, f"Query execution failed: {str(e)}"