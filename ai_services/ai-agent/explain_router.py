import os
import asyncio
import sqlite3
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import text

# Modern Google GenAI SDK import
from google import genai
from google.genai import types

from agent import (
    AIQuotaExceeded,
    PolicyExplanationCache,
    _generate_content_with_fallback,
    get_db_session,
    get_engine,
)

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
    """Format pre-computed SHAP attributions for the prompt.

    The model is trained on log1p(demand), so `shap_value` is a log-space
    contribution and `delta_units` is its units-space equivalent. Only the units
    figures are shown to the LLM -- quoting a log-space value as a unit count
    turns a 4,351-unit baseline into "8.4 units".
    """
    if not FORECAST_SERVICE_BASE:
        return "  (FORECAST_SERVICE_BASE not configured - SHAP data unavailable)"
    try:
        url = f"{FORECAST_SERVICE_BASE}/api/v1/shap/explanation"
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url, params={"sku": sku, "horizon": horizon})
        if resp.status_code == 404:
            return (
                f"  No SHAP attribution stored for {sku} at horizon {horizon}. "
                "Re-run the forecast publish to generate them."
            )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        return f"  SHAP fetch error: {exc}"

    features = data.get("top_features") or []
    if not features:
        return "  No SHAP feature data available."

    baseline = float(data.get("baseline_units") or 0.0)
    predicted = float(data.get("prediction_units") or 0.0)
    model = data.get("model_name", "?")
    lines = [
        f"  Model: {model} (SHAP TreeExplainer, exact attribution)",
        f"  Average demand across all materials: {baseline:,.0f} units",
        f"  Predicted for this material: {predicted:,.0f} units",
        f"  Difference to explain: {predicted - baseline:+,.0f} units",
        "",
        "  Contributions (units, +/- against the average):",
    ]
    for f in features:
        if f.get("feature") == "__other__":
            lines.append(f"  {f.get('delta_units', 0.0):+10,.0f}  all remaining factors combined")
            continue
        value = f.get("feature_value")
        shown = f"{value:,.1f}" if isinstance(value, (int, float)) else "n/a"
        note = ""
        if f.get("lag_provenance") == "predicted":
            note = "  [from the model's own earlier forecast, not observed history]"
        elif f.get("lag_provenance") == "partly_predicted":
            note = "  [partly from the model's own earlier forecasts]"
        lines.append(
            f"  {f.get('delta_units', 0.0):+10,.0f}  {f.get('label')} (= {shown}){note}"
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

When asked WHY demand is high or low, lead with the SHAP attributions below. They are
exact contributions in units, measured against the average across all materials, and they
sum to the difference between that average and this material's prediction.
- State the two or three largest contributions and what they mean operationally.
- A contribution marked [from the model's own earlier forecast] is not observed history.
  Say so plainly -- at longer horizons the model is partly explaining its own output.
- Never invent a percentage or a driver that is not listed below.

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
    try:
        text, _ = _generate_content_with_fallback(
            system_prompt + f"\n\nUser question: {req.userMessage}",
            "gemini-2.5-flash",
        )
    except AIQuotaExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail={"code": "AI_QUOTA_EXCEEDED", "message": str(exc)},
        ) from exc

    return {"reply": text}


@router.post("/forecast/stream")
async def explain_forecast_stream(req: ForecastExplainRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY / GOOGLE_API_KEY not configured on server")

    system_prompt = _build_prompt(req)
    try:
        generated, _ = _generate_content_with_fallback(
            system_prompt + f"\n\nUser question: {req.userMessage}",
            "gemini-2.5-flash",
        )
    except AIQuotaExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail={"code": "AI_QUOTA_EXCEEDED", "message": str(exc)},
        ) from exc

    text = generated or ""

    async def streamer():
        # Stream word-by-word so the frontend can render incrementally
        for token in text.split():
            yield token + " "
            await asyncio.sleep(0)

    return StreamingResponse(streamer(), media_type="text/plain; charset=utf-8")


# ── Inventory policy XAI (decision-factor explanations) ──────────────────────
REASON_LABELS = {
    "BELOW_REORDER_TRIGGER": "below reorder trigger",
    "REORDER_TRIGGER_INCREASE": "earlier reorder protection",
    "REORDER_TRIGGER_REDUCTION": "later reorder trigger",
    "MINIMUM_INCREASE": "higher minimum stock",
    "MINIMUM_REDUCTION": "lower minimum stock",
    "MAXIMUM_INCREASE": "higher target stock",
    "MAXIMUM_REDUCTION": "lower excess buffer",
    "LONG_LEAD_TIME": "long supplier lead time",
    "MOQ_APPLIED": "MOQ applied",
    "ORDER_MULTIPLE_ROUNDING": "pack multiple rounding",
    "SPACE_INCREASE": "more pallet space",
    "SPACE_RELEASE": "releases pallet space",
    "HIGH_SERVICE_RISK": "service protection",
    "EXPIRY_CAP": "expiry-limited",
}

POLICY_LINE_SQL = """
    SELECT
        l.id, l.updated_at, l.material_code, m.description,
        l.current_min_stock, l.proposed_min_stock,
        l.current_max_stock, l.proposed_max_stock,
        l.current_reorder_point, l.proposed_reorder_point,
        l.stock_delta, l.pallet_positions_delta,
        l.stockout_risk_score, l.expiry_risk_score, l.confidence_score,
        l.recommendation_status, l.rationale
    FROM inventory_policy_recommendation_lines l
    JOIN materials m ON m.id = l.material_id
    WHERE l.material_code = :material_code
    ORDER BY l.created_at DESC
    LIMIT 1
"""


class PolicyExplainRequest(BaseModel):
    materialCode: str
    reasonCodes: list[str] = []


def _build_policy_prompt(row: dict, reason_labels: list[str]) -> str:
    reasons = ", ".join(reason_labels) or "routine recalculation"
    return f"""You are a warehouse inventory analyst explaining a stock policy change to a
warehouse manager who is not a supply-chain specialist. Use plain WMS operating language
(reorder point, safety stock, pallet positions) — not statistics jargon (no "stochastic",
"EOQ", "z-score"). Be concise: 3-4 sentences. Use ONLY the facts given below; do not invent numbers.

[MATERIAL]
{row['material_code']} — {row['description']}

[WHY THIS CHANGED — engine-flagged factors]
{reasons}

[POLICY CHANGE]
Minimum stock: {row['current_min_stock']} -> {row['proposed_min_stock']}
Reorder point: {row['current_reorder_point']} -> {row['proposed_reorder_point']}
Maximum stock: {row['current_max_stock']} -> {row['proposed_max_stock']}
Pallet position change: {row['pallet_positions_delta']}
Recommendation status: {row['recommendation_status']}
Stockout risk score: {row['stockout_risk_score']} | Expiry risk score: {row['expiry_risk_score']} | Confidence: {row['confidence_score']}

[ENGINE'S RAW CALCULATION NOTES]
{row['rationale'] or '(none)'}

Explain what changed and why, in terms a warehouse manager would find actionable."""


@router.post("/policy")
def explain_policy(req: PolicyExplainRequest):
    engine = get_engine()
    result = pd_read_one(engine, POLICY_LINE_SQL, {"material_code": req.materialCode})
    if result is None:
        raise HTTPException(status_code=404, detail=f"No policy recommendation found for {req.materialCode}.")

    line_id, updated_at = str(result["id"]), result["updated_at"]

    with get_db_session() as db:
        cached = (
            db.query(PolicyExplanationCache)
            .filter(PolicyExplanationCache.line_id == line_id, PolicyExplanationCache.line_updated_at == updated_at)
            .first()
        )
        if cached:
            return {"explanation": cached.explanation, "cached": True}

    reason_labels = [REASON_LABELS.get(code, code.replace("_", " ").lower()) for code in req.reasonCodes]
    prompt = _build_policy_prompt(result, reason_labels)
    try:
        explanation, _ = _generate_content_with_fallback(prompt, "gemini-2.5-flash")
    except AIQuotaExceeded as exc:
        raise HTTPException(status_code=429, detail={"code": "AI_QUOTA_EXCEEDED", "message": str(exc)}) from exc

    with get_db_session() as db:
        # Overwrite any stale cached version for this line (old updated_at) —
        # a line is re-explained, never accumulated, so this stays a single
        # row per line_id regardless of how many times its policy changes.
        db.query(PolicyExplanationCache).filter(PolicyExplanationCache.line_id == line_id).delete()
        db.add(PolicyExplanationCache(
            line_id=line_id,
            line_updated_at=updated_at,
            explanation=explanation.strip(),
            model_used="gemini-2.5-flash",
        ))
        db.commit()

    return {"explanation": explanation.strip(), "cached": False}


def pd_read_one(engine, sql: str, params: dict) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(text(sql), params).mappings().first()
    return dict(row) if row else None
