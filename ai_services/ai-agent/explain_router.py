import os
import asyncio
import sqlite3
import httpx
import google.generativeai as genai
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()  # load .env file in the same directory or parent
# Trigger uvicorn reload to pick up env changes

router = APIRouter(prefix="/api/explain", tags=["explain"])

FORECAST_SERVICE_BASE = os.getenv("FORECAST_SERVICE_BASE", "")
# Support both GEMINI_API_KEY and GOOGLE_API_KEY (dotenv uses GOOGLE_API_KEY)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")

# Path to the SQLite database with forecast data
_DB_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "..", "forecast_service.db"),
    os.path.join(os.path.dirname(__file__), "..", "..", "ai_services", "forecast_service.db"),
    "./forecast_service.db",
]
DB_PATH = next((p for p in _DB_CANDIDATES if os.path.exists(p)), None)


def _query_db_context(sku: str) -> str:
    """Pull relevant forecast rows from the forecast-service REST API for the given SKU (or all if 'all')."""
    if not FORECAST_SERVICE_BASE:
        return "  (FORECAST_SERVICE_BASE not configured — forecast data unavailable)"
    try:
        url = f"{FORECAST_SERVICE_BASE}/forecasts"
        params = {}
        if sku and sku.lower() not in ("all", ""):
            params["sku"] = sku
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items") or []
        if not items:
            return f"No forecast records found for SKU: {sku}."

        lines = []
        for r in items[:60]:
            parts = []
            for c in ["sku", "category", "horizon", "month", "p10", "p50", "p90", "run_id"]:
                if c in r:
                    parts.append(f"{c}={r[c]}")
            lines.append("  " + ", ".join(parts))
        return "\n".join(lines)
    except Exception as exc:
        return f"Forecast service fetch error: {exc}"


def _query_shap_context(sku: str, horizon: int = 3) -> str:
    """
    Fetch pre-computed SHAP feature attributions from the forecast-service REST API.
    Returns a formatted string showing how each feature pushed the prediction up or down.
    """
    if not FORECAST_SERVICE_BASE:
        return "  (FORECAST_SERVICE_BASE not configured — SHAP data unavailable)"
    try:
        url = f"{FORECAST_SERVICE_BASE}/api/v1/shap/explanation"
        params = {"sku": sku, "horizon": horizon}
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url, params=params)
        if resp.status_code == 404:
            return (
                "  No SHAP data yet for this SKU. "
                "Trigger a forecast publish run once model artifacts are available."
            )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        return f"  SHAP fetch error: {exc}"

    features = data.get("top_features") or []
    if not features:
        return "  No SHAP feature data available."

    base = data.get("base_value", 0.0)
    pred = data.get("prediction", 0.0)
    model = data.get("model_name", "?")
    lines = [
        f"  Model: {model} | Baseline demand: {base:.1f} units | Predicted: {pred:.1f} units",
        f"  (Positive values pushed prediction UP from baseline; negative pulled it DOWN)",
        "",
    ]
    for f in features:
        sign = "+" if f["shap_value"] >= 0 else ""
        lines.append(
            f"  {sign}{f['shap_value']:+.1f}  {f['feature']} = {f['feature_value']}  "
            f"\u2192 \"{f['label']}\""
        )
    return "\n".join(lines)


class ForecastExplainRequest(BaseModel):
    sku: str
    forecastPoints: list[dict]  # [{month, p50}]
    selectedMonth: str | None = None
    userMessage: str
    predictedUnits: float | None = None
    confidence: float | None = None
    mape: float | None = None


def _build_prompt(req: "ForecastExplainRequest") -> str:
    db_context = _query_db_context(req.sku)

    # Infer most relevant horizon from selected month if possible
    try:
        horizon = int(req.forecastPoints[0].get("horizon", 3)) if req.forecastPoints else 3
    except (IndexError, TypeError, ValueError):
        horizon = 3
    shap_context = _query_shap_context(req.sku, horizon=horizon)

    # Format chart points sent from the frontend
    chart_summary = "  (none sent from frontend)"
    if req.forecastPoints:
        chart_summary = "\n".join(
            f"  month={p.get('month','?')} p50={p.get('p50','?')}"
            for p in req.forecastPoints[:12]
        )

    metrics_block = ""
    if req.predictedUnits is not None:
        metrics_block += f"  Predicted units (selected period): {req.predictedUnits}\n"
    if req.confidence is not None:
        metrics_block += f"  Confidence interval coverage: {req.confidence}%\n"
    if req.mape is not None:
        metrics_block += f"  MAPE (mean absolute % error): {req.mape}%\n"
    if not metrics_block:
        metrics_block = "  (not provided)\n"

    return f"""You are an expert Supply Chain & Forecast Analyst for OptiWMS.
The user is viewing the demand forecast dashboard. Answer their question in plain,
actionable English. Be concise — 3 to 6 sentences. Use only the data below. Do not
make up numbers outside of this context.

When asked WHY demand is high or low, lead with the SHAP model attributions below.
Interpret each feature contribution in plain English:
- A large positive SHAP value on lag_1 means last month’s high demand carried forward.
- A positive SHAP value on roll_mean_6 means the 6-month trend is upward.
- A positive SHAP value on month_num or quarter means seasonality is driving demand up.
- A positive SHAP value on stockout_days_lag1 means past supply shortages created pent-up demand.
- Negative SHAP values indicate features that are pulling the forecast DOWN.

[SELECTED SKU]
  {req.sku or 'All SKUs Combined'}

[SELECTED MONTH IN VIEW]
  {req.selectedMonth or 'Not specified'}

[FORECAST METRICS]
{metrics_block}
[FORECAST CHART DATA — p50 values by month]
{chart_summary}

[MODEL EXPLANATION — SHAP feature attributions (what drove this prediction)]
{shap_context}

[DATABASE RECORDS — forecast_service.db]
{db_context}
"""


@router.post("/forecast")
async def explain_forecast(req: ForecastExplainRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY / GOOGLE_API_KEY not configured on server")

    system_prompt = _build_prompt(req)
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content([
        {"role": "user", "parts": [system_prompt + f"\n\nUser question: {req.userMessage}"]}
    ])

    return {"reply": response.text}


@router.post("/forecast/stream")
async def explain_forecast_stream(req: ForecastExplainRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY / GOOGLE_API_KEY not configured on server")

    system_prompt = _build_prompt(req)
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content([
        {"role": "user", "parts": [system_prompt + f"\n\nUser question: {req.userMessage}"]}
    ])

    text = response.text or ""

    async def streamer():
        # Stream word-by-word so the frontend can render incrementally
        for token in text.split():
            yield token + " "
            await asyncio.sleep(0)

    return StreamingResponse(streamer(), media_type="text/plain; charset=utf-8")