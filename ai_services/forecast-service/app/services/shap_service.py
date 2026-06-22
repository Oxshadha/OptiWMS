"""
SHAP explanation service for OptiWMS forecast-service.

Computes TreeExplainer SHAP values for all boosting model types
(XGBoost, CatBoost, LightGBM, RandomForest) using the feature matrix
produced at inference time, then persists the top-N contributors per
SKU/horizon into the forecast_shap_explanations table.

Called from publish_online() in forecast_service.py after each horizon's
predictions are computed — i.e. pre-compute mode, not on-demand.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ForecastShapExplanation
from app.services.artifact_service import load_boosting_artifact

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Human-readable labels for the internal feature names the model uses.
# These are the features built by _build_online_feature_row() in artifact_service.py.
# ---------------------------------------------------------------------------
_FEATURE_LABELS: dict[str, str] = {
    "lag_1":  "demand 1 month ago",
    "lag_2":  "demand 2 months ago",
    "lag_3":  "demand 3 months ago",
    "lag_6":  "demand 6 months ago",
    "lag_12": "demand 12 months ago",
    "roll_mean_3":  "3-month average demand",
    "roll_mean_6":  "6-month average demand",
    "roll_mean_12": "12-month average demand",
    "roll_std_3":   "demand volatility (3-month)",
    "roll_std_6":   "demand volatility (6-month)",
    "roll_std_12":  "demand volatility (12-month)",
    "month_num":    "month of year",
    "quarter":      "quarter of year",
    "month_sin":    "seasonal cycle (sin)",
    "month_cos":    "seasonal cycle (cos)",
    "year":         "year trend",
    "on_hand_inventory_lag1":  "stock on hand (prior month)",
    "stockout_days_lag1":      "stockout days (prior month)",
    "promotion_flag_lag1":     "promotion flag (prior month)",
    "price_or_discount_lag1":  "price / discount (prior month)",
    "lead_time_days_lag1":     "supplier lead time (prior month)",
    "supplier_otif_lag1":      "supplier OTIF (prior month)",
    "inbound_po_qty_lag1":     "inbound PO quantity (prior month)",
    "open_sales_orders_lag1":  "open sales orders (prior month)",
    "returns_qty_lag1":        "returns quantity (prior month)",
    "holiday_flag_lag1":       "holiday flag (prior month)",
}


def _label(feature_name: str) -> str:
    """Return a human-readable label for a feature, falling back to the raw name."""
    return _FEATURE_LABELS.get(feature_name, feature_name.replace("_", " "))


def _is_identity_dummy(col: str) -> bool:
    """Skip one-hot encoded SKU/category dummies — they're identifiers, not drivers."""
    return col.startswith("fg_code_") or col.startswith("fg_category_")


def compute_and_persist_shap(
    db: Session,
    run_id: int,
    dataset: str,
    model_name: str,
    horizon: int,
    feature_frame: pd.DataFrame,
    sku_list: list[str],
    predictions: list[float],
    top_n: int | None = None,
    stage: str = "production",
) -> int:
    """
    Compute SHAP values for the given feature_frame and persist the top-N
    contributing features per SKU into forecast_shap_explanations.

    Parameters
    ----------
    db            : SQLAlchemy session (already open, caller commits)
    run_id        : FK to forecast_runs
    dataset       : e.g. "B" or "P"
    model_name    : e.g. "XGBOOST", "CATBOOST", "LIGHTGBM"
    horizon       : forecast horizon (1–12)
    feature_frame : the exact DataFrame that was passed to model.predict()
                    (produced by _build_online_feature_row in artifact_service.py)
    sku_list      : list of SKU codes in the same row-order as feature_frame
    predictions   : model output values in the same row-order as feature_frame
    top_n         : number of top features to store (defaults to config value)
    stage         : artifact stage, typically "production"

    Returns
    -------
    Number of ForecastShapExplanation rows inserted.
    """
    if not settings.shap_explainer_enabled:
        logger.debug("SHAP explainer disabled via config; skipping.")
        return 0

    if feature_frame is None or feature_frame.empty:
        logger.warning("shap_service: empty feature_frame; skipping SHAP computation.")
        return 0

    effective_top_n = top_n if top_n is not None else settings.shap_max_features_to_return

    try:
        import shap  # imported here to keep startup fast if shap is not available
    except ImportError:
        logger.error("shap package not installed; cannot compute SHAP explanations. "
                     "Add shap>=0.45.0 to pyproject.toml.")
        return 0

    try:
        reg, _ = load_boosting_artifact(dataset, model_name, horizon, stage=stage)
    except FileNotFoundError as exc:
        logger.warning("shap_service: artifact not found (%s); skipping SHAP for "
                       "dataset=%s model=%s horizon=%d.", exc, dataset, model_name, horizon)
        return 0
    except Exception as exc:  # noqa: BLE001
        logger.error("shap_service: failed to load artifact: %s", exc)
        return 0

    try:
        explainer = shap.TreeExplainer(reg)
        shap_matrix = explainer.shap_values(feature_frame)  # shape: (n_skus, n_features)
        base_value = float(explainer.expected_value)
    except Exception as exc:  # noqa: BLE001
        logger.error("shap_service: TreeExplainer failed for %s h%d: %s",
                     model_name, horizon, exc)
        return 0

    feature_names: list[str] = list(feature_frame.columns)
    inserted = 0

    for i, (sku, pred) in enumerate(zip(sku_list, predictions)):
        try:
            row_shap: list[float] = (
                shap_matrix[i].tolist()
                if hasattr(shap_matrix[i], "tolist")
                else list(shap_matrix[i])
            )

            contributions: list[dict[str, Any]] = [
                {
                    "feature":       col,
                    "label":         _label(col),
                    "shap_value":    round(float(row_shap[j]), 4),
                    "feature_value": round(float(feature_frame.iloc[i, j]), 4),
                }
                for j, col in enumerate(feature_names)
                if not _is_identity_dummy(col)
            ]

            # Sort by absolute SHAP contribution descending, keep top N
            contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
            top = contributions[:effective_top_n]

            db.add(ForecastShapExplanation(
                run_id=run_id,
                dataset=dataset,
                model_name=model_name,
                sku=sku,
                horizon=horizon,
                top_features_json=json.dumps(top),
                base_value=base_value,
                prediction=float(pred),
            ))
            inserted += 1

        except Exception as exc:  # noqa: BLE001
            logger.warning("shap_service: failed to compute SHAP for sku=%s: %s", sku, exc)
            continue

    logger.info(
        "shap_service: persisted %d SHAP explanations for dataset=%s model=%s horizon=%d",
        inserted, dataset, model_name, horizon,
    )
    return inserted


def query_shap_explanation(
    db: Session,
    sku: str,
    horizon: int,
    dataset: str | None = None,
    model_name: str | None = None,
) -> dict[str, Any] | None:
    """
    Fetch the most recent SHAP explanation for a given SKU and horizon.
    Used by the REST endpoint to serve data to explain_router.py.

    Returns a dict ready for JSON serialization, or None if no data found.
    """
    query = (
        db.query(ForecastShapExplanation)
        .filter(ForecastShapExplanation.sku == sku)
        .filter(ForecastShapExplanation.horizon == horizon)
    )
    if dataset:
        query = query.filter(ForecastShapExplanation.dataset == dataset)
    if model_name:
        query = query.filter(ForecastShapExplanation.model_name == model_name)

    row = query.order_by(ForecastShapExplanation.created_at.desc()).first()
    if not row:
        return None

    try:
        top_features = json.loads(row.top_features_json)
    except (json.JSONDecodeError, TypeError):
        top_features = []

    return {
        "sku":          row.sku,
        "horizon":      row.horizon,
        "dataset":      row.dataset,
        "model_name":   row.model_name,
        "prediction":   row.prediction,
        "base_value":   row.base_value,
        "top_features": top_features,
        "computed_at":  row.created_at.isoformat() if row.created_at else None,
    }
